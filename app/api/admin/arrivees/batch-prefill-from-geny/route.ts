import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { buildGenyUrlFromStored } from "@/lib/geny";
import { parseArrivee, maxHorsesForParis } from "@/lib/sync/geny-arrivees";
import {
  parseRapportsPMU,
  parseCommentaire,
  type RapportsPMU,
} from "@/lib/sync/geny-rapports-parser";

/**
 * POST /api/admin/arrivees/batch-prefill-from-geny
 *
 * Body : { "date": "YYYY-MM-DD" }
 *
 * Bulk equivalent de /api/admin/arrivees/prefill-from-geny, mais traite
 * toutes les courses éligibles d'une date d'un coup :
 *   - geny_url présent
 *   - arrivee_officielle IS NULL
 *   - date passée OU date du jour avec heure_depart + 30min écoulée
 *
 * Pour chaque course, fait :
 *   1. Fetch HTML Geny
 *   2. parseArrivee avec cap dynamique (7 Quinté+ / 6 autres)
 *   3. parseRapportsPMU + parseCommentaire (best-effort)
 *   4. Upsert dans `arrivees` → le trigger SQL trg_sync_arrivee_to_course
 *      sync automatiquement courses.arrivee_officielle + statut=TERMINE
 *
 * Concurrence : pool de 4 workers en parallèle pour ne pas spam Geny.
 *
 * Retour : résumé {ok, total, succeeded, failed, skipped, details: [...]}
 *
 * Auth : protégée par middleware /admin (cookies session).
 *
 * UX : l'éditeur clique "🪄 Tout pré-remplir & publier" sur /admin/arrivees,
 * attend ~30-60s (selon nb de courses), puis voit toutes les arrivées
 * éligibles publiées automatiquement.
 */

const FETCH_TIMEOUT_MS = 8000;
const CONCURRENCY = 4;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";

interface PostBody {
  date: string; // "YYYY-MM-DD"
}

interface CourseEligible {
  id:                string;
  numero_reunion:    number;
  numero_course:     number;
  libelle:           string;
  heure_depart:      string | null;
  geny_url:          string;
  paris_disponibles: string[] | null;
  partants:          { numero: number }[] | null;
}

interface CourseResult {
  course_id:     string;
  reference:     string;
  status:        "saved" | "skipped" | "failed";
  arrivee?:      number[];
  error?:        string;
}

/** Pool de workers limité à `n` parallèles. */
async function processInPool<T, R>(
  items: T[],
  workerCount: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function next(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(workerCount, items.length) }, () => next()),
  );
  return results;
}

/**
 * Fetch + parse une seule course. Retourne null si pas de HTML ou arrivée
 * non parsable. Le caller décide quoi en faire.
 */
async function fetchAndParseOne(course: CourseEligible): Promise<{
  arrivee:     number[];
  rapports:    RapportsPMU | null;
  commentaire: string | null;
} | null> {
  const url = buildGenyUrlFromStored(course.geny_url, "resultats");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":      USER_AGENT,
        Accept:            "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9",
        Referer:           "https://www.geny.com/",
      },
      cache:  "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    clearTimeout(timer);
    return null;
  }

  const validNumbers = Array.isArray(course.partants)
    ? course.partants.map((p) => p.numero).filter((n) => Number.isInteger(n))
    : [];

  const maxHorses = maxHorsesForParis(course.paris_disponibles);
  const arrivee = parseArrivee(
    html,
    validNumbers.length > 0 ? validNumbers : undefined,
    maxHorses,
  );
  if (!arrivee) return null;

  let rapports: RapportsPMU | null = null;
  try {
    const r = parseRapportsPMU(html);
    if (r && Object.keys(r).length > 0) rapports = r;
  } catch { /* defensive */ }

  let commentaire: string | null = null;
  try {
    commentaire = parseCommentaire(html);
  } catch { /* defensive */ }

  return { arrivee, rapports, commentaire };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = (await req.json()) as PostBody;

    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json(
        { error: "date invalide (format YYYY-MM-DD attendu)" },
        { status: 400 },
      );
    }

    // ── Calcul fenêtre temporelle Paris ──────────────────────────────────
    const now = new Date();
    const todayParis = now.toLocaleDateString("fr-CA", {
      timeZone: "Europe/Paris",
    });
    const nowParisHHMM = now.toLocaleTimeString("fr-FR", {
      timeZone: "Europe/Paris",
      hour:     "2-digit",
      minute:   "2-digit",
      hour12:   false,
    });
    const [nh, nm] = nowParisHHMM.split(":").map((s) => parseInt(s, 10));
    const nowMins = (nh || 0) * 60 + (nm || 0);

    // Bloquer les dates futures
    if (body.date > todayParis) {
      return NextResponse.json(
        { error: `Date dans le futur (${body.date}). Patientez.` },
        { status: 422 },
      );
    }

    // ── Lister les courses éligibles ─────────────────────────────────────
    const { data: rawCourses, error: queryErr } = await supabase
      .from("courses")
      .select(`
        id, numero_reunion, numero_course, libelle, heure_depart,
        geny_url, paris_disponibles,
        partants(numero)
      `)
      .eq("date_course", body.date)
      .is("arrivee_officielle", null)
      .not("geny_url", "is", null);

    if (queryErr) {
      return NextResponse.json(
        { error: `Query courses failed: ${queryErr.message}` },
        { status: 500 },
      );
    }

    const allCandidates = (rawCourses ?? []) as unknown as CourseEligible[];

    // Filtre temporel : seules les courses dont heure_depart + 30min est passée
    const MARGE_FIN_MIN = 30;
    const eligibles = allCandidates.filter((c) => {
      // Si date < aujourd'hui → toujours éligible
      if (body.date < todayParis) return true;
      // Si date == aujourd'hui → vérifier heure
      if (!c.heure_depart) return false;
      const [hh, mm] = c.heure_depart.split(":").map((s) => parseInt(s, 10));
      const departMins = (hh || 0) * 60 + (mm || 0);
      return nowMins >= departMins + MARGE_FIN_MIN;
    });

    if (eligibles.length === 0) {
      return NextResponse.json({
        ok:          true,
        date:        body.date,
        total:       allCandidates.length,
        succeeded:   0,
        failed:      0,
        skipped:     allCandidates.length,
        details:     [],
        message:     allCandidates.length > 0
          ? `${allCandidates.length} courses sans arrivée mais aucune n'est encore terminée (heure + 30min).`
          : "Aucune course sans arrivée pour cette date.",
      });
    }

    // ── Fetch + parse en parallèle ───────────────────────────────────────
    const fetchResults = await processInPool(eligibles, CONCURRENCY, async (course) => {
      const ref = `R${course.numero_reunion}C${course.numero_course}`;
      try {
        const parsed = await fetchAndParseOne(course);
        if (!parsed) {
          return {
            course_id: course.id,
            reference: ref,
            status:    "failed" as const,
            error:     "Geny indisponible ou arrivée non parsable",
          };
        }
        return {
          course_id:   course.id,
          reference:   ref,
          status:      "pending" as const,
          arrivee:     parsed.arrivee,
          rapports:    parsed.rapports,
          commentaire: parsed.commentaire,
        };
      } catch (e) {
        return {
          course_id: course.id,
          reference: ref,
          status:    "failed" as const,
          error:     e instanceof Error ? e.message : String(e),
        };
      }
    });

    // ── Upsert dans arrivees (le trigger SQL sync vers courses) ──────────
    const toSave = fetchResults.filter(
      (r): r is Extract<typeof r, { status: "pending" }> => r.status === "pending",
    );
    const failed = fetchResults.filter(
      (r): r is Extract<typeof r, { status: "failed" }> => r.status === "failed",
    );

    const results: CourseResult[] = [...failed.map((f) => ({
      course_id: f.course_id,
      reference: f.reference,
      status:    "failed" as const,
      error:     f.error,
    }))];

    if (toSave.length > 0) {
      const arriveeRows = toSave.map((r) => ({
        course_id:       r.course_id,
        ordre_arrivee:   r.arrivee,
        rapport_quinte:  r.rapports?.quinte_plus?.ordre ?? null,
        rapport_quarte:  r.rapports?.quarte_plus?.ordre ?? null,
        rapport_tierce:  r.rapports?.tierce?.ordre ?? null,
        rapports_pmu:    r.rapports,
        commentaire:     r.commentaire?.trim() || null,
        horodatage:      new Date().toISOString(),
      }));

      // Upsert one-shot. Le trigger SQL trg_sync_arrivee_to_course met à jour
      // courses.arrivee_officielle + statut=TERMINE automatiquement.
      const { error: upsertErr } = await supabase
        .from("arrivees")
        .upsert(arriveeRows, { onConflict: "course_id" });

      if (upsertErr) {
        // Échec global : on marque toutes les "pending" comme failed
        for (const r of toSave) {
          results.push({
            course_id: r.course_id,
            reference: r.reference,
            status:    "failed",
            error:     `DB upsert failed: ${upsertErr.message}`,
          });
        }
      } else {
        for (const r of toSave) {
          results.push({
            course_id: r.course_id,
            reference: r.reference,
            status:    "saved",
            arrivee:   r.arrivee,
          });
        }
      }
    }

    // ── Revalidate pages publiques (1 fois par date, pas par course) ─────
    try {
      revalidatePath(`/arrivees/${body.date}`);
      revalidatePath(`/quinte-plus/${body.date}`);
      revalidatePath(`/programme/${body.date}`);
      revalidatePath("/sitemap-news.xml");
    } catch { /* best-effort */ }

    const skipped = allCandidates.length - eligibles.length;
    const succeeded = results.filter((r) => r.status === "saved").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    return NextResponse.json({
      ok:        true,
      date:      body.date,
      total:     allCandidates.length,
      succeeded,
      failed:    failedCount,
      skipped,
      details:   results,
      message:   `${succeeded} arrivées publiées, ${failedCount} échecs, ${skipped} ignorées (pas encore terminées).`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[POST batch-prefill-from-geny] exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
