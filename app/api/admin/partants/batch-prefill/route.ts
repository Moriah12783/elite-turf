import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchGenyPartants } from "@/lib/geny";
import { todayParisISO } from "@/lib/paris-date";
import type { GenyParticipant } from "@/lib/geny";

/**
 * POST /api/admin/partants/batch-prefill?date=YYYY-MM-DD[&force=1]
 *
 * Pré-remplit en BATCH les partants de toutes les courses d'une date
 * donnée qui n'ont pas encore de partants en DB et qui ont un geny_url.
 *
 * Utilité :
 *   - Préparation rapide du programme du jour à 6h du matin (1 clic au
 *     lieu de 30 sur /admin/courses/[id]/partants)
 *   - Récupération si le cron auto enrichir-partants tombe en panne
 *   - Backfill (mode `force=1`) après correction d'un bug parser :
 *     supprime les partants existants et re-scrape Geny.
 *
 * Stratégie :
 *   1. SELECT courses where date = X AND statut != ANNULE AND geny_url
 *      NOT NULL
 *   2. SELECT partants count par course
 *   3. Filtrer les courses (sans `force` : seulement celles avec 0 partants ;
 *      avec `force=1` : toutes)
 *   4. Pool de 4 workers en parallèle (limite Geny rate-limit + CPU
 *      Cloudflare Worker 30s)
 *   5. Pour chaque course : fetchGenyPartants → [DELETE si force] → INSERT
 *   6. Retour récap { ok, total, success, failed, errors[] }
 *
 * Auth : protégée par middleware (/api/admin/* nécessite session admin
 * via cookies). Les middlewares vérifient déjà.
 */

const CONCURRENCY = 4;
const PER_COURSE_TIMEOUT_MS = 8000;

interface BatchResult {
  ok:        true;
  date:      string;
  force:     boolean;
  total:     number;
  success:   number;
  failed:    number;
  duration:  number;
  details:   Array<{
    course_id: string;
    reference: string;       // "R1C4" pour identifier
    libelle:   string;
    status:    "success" | "failed";
    partants?: number;       // Si success
    error?:    string;       // Si failed
  }>;
}

interface CourseToProcess {
  id:             string;
  numero_reunion: number;
  numero_course:  number;
  libelle:        string;
  date_course:    string;
  geny_url:       string;
}

/**
 * Map un GenyParticipant vers le format INSERT partants Supabase.
 * Aligné sur le cron `enrichir-partants` pour inclure place_corde / age /
 * sexe / scraped_at (FieldAnalyzer s'en sert pour data_completeness_score).
 */
function mapToDbInsert(courseId: string, p: GenyParticipant) {
  return {
    course_id:    courseId,
    numero:       p.numPmu,
    nom_cheval:   (p.nom || "").trim().toUpperCase(),
    jockey:       p.jockey?.nom?.trim() || null,
    entraineur:   p.entraineur?.nom?.trim() || null,
    cote:         typeof p.coteProbable === "number" && Number.isFinite(p.coteProbable)
                    ? p.coteProbable
                    : null,
    musique:      p.musique?.trim() || null,
    poids_kg:     typeof p.poids === "number" && Number.isFinite(p.poids) ? p.poids : null,
    place_corde:  typeof p.placeCorde === "number" && Number.isFinite(p.placeCorde) ? p.placeCorde : null,
    age:          typeof p.age === "number" && Number.isFinite(p.age) ? p.age : null,
    sexe:         p.sexe ?? null,
    deferre:      false,
    non_partant:  !!p.nonPartant,
    scraped_at:   new Date().toISOString(),
  };
}

/**
 * Process une seule course : fetch Geny + (delete +) insert partants.
 *
 * Si `force=true`, on supprime les partants existants avant insert (mode
 * backfill : ré-écrase les données corrompues par un ancien bug parser).
 * Sinon on insère directement (le filtrage des courses déjà peuplées se
 * fait en amont via SELECT).
 *
 * Retourne le résultat (success ou failed) sans throw.
 */
async function processCourse(
  course: CourseToProcess,
  supabase: ReturnType<typeof createServiceClient>,
  force: boolean,
): Promise<BatchResult["details"][number]> {
  const reference = `R${course.numero_reunion}C${course.numero_course}`;

  try {
    const partants = await fetchGenyPartants(
      course.date_course,
      course.numero_reunion,
      course.numero_course,
      PER_COURSE_TIMEOUT_MS,
      course.geny_url,
    );

    if (partants.length === 0) {
      return {
        course_id: course.id,
        reference,
        libelle:   course.libelle,
        status:    "failed",
        error:     "Geny n'a retourné aucun partant (page vide ou parsing échoué)",
      };
    }

    // En mode force, on supprime les partants existants avant réinsertion.
    // Indispensable pour le backfill : sinon l'insert violerait la PK
    // (course_id, numero).
    if (force) {
      const { error: delErr } = await supabase
        .from("partants")
        .delete()
        .eq("course_id", course.id);
      if (delErr) {
        return {
          course_id: course.id,
          reference,
          libelle:   course.libelle,
          status:    "failed",
          error:     `DB delete (force): ${delErr.message}`,
        };
      }
    }

    // INSERT bulk
    const rows = partants.map((p) => mapToDbInsert(course.id, p));
    const { error } = await supabase.from("partants").insert(rows);
    if (error) {
      return {
        course_id: course.id,
        reference,
        libelle:   course.libelle,
        status:    "failed",
        error:     `DB error: ${error.message}`,
      };
    }

    // Update nb_partants côté courses (cohérence affichage)
    await supabase
      .from("courses")
      .update({ nb_partants: partants.length })
      .eq("id", course.id);

    return {
      course_id: course.id,
      reference,
      libelle:   course.libelle,
      status:    "success",
      partants:  partants.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return {
      course_id: course.id,
      reference,
      libelle:   course.libelle,
      status:    "failed",
      error:     message,
    };
  }
}

/**
 * Pool d'exécution avec concurrence limitée. Évite de saturer Geny
 * (rate-limit) et de dépasser la limite CPU Cloudflare Worker.
 */
async function processInPool<T, R>(
  items: T[],
  workerCount: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
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

export async function POST(req: NextRequest) {
  const startGlobal = Date.now();
  try {
    const supabase = createServiceClient();
    const date = req.nextUrl.searchParams.get("date") || todayParisISO();
    // ?force=1 : re-scrape toutes les courses du jour (même celles déjà
    // peuplées). Utile pour backfiller des partants corrompus par un
    // ancien bug parser. Sans force, on saute les courses non-vides.
    const force = ["1", "true", "yes"].includes(
      (req.nextUrl.searchParams.get("force") || "").toLowerCase(),
    );

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Paramètre 'date' invalide (format YYYY-MM-DD attendu)" },
        { status: 400 },
      );
    }

    // ── Étape 1 : SELECT courses du jour avec geny_url ──────────────────
    const { data: rawCourses, error: cErr } = await supabase
      .from("courses")
      .select(`
        id, numero_reunion, numero_course, libelle, date_course, geny_url,
        partants(id)
      `)
      .eq("date_course", date)
      .neq("statut", "ANNULE")
      .not("geny_url", "is", null)
      .order("numero_reunion", { ascending: true })
      .order("numero_course", { ascending: true });

    if (cErr) {
      return NextResponse.json(
        { error: `DB error: ${cErr.message}` },
        { status: 500 },
      );
    }

    // ── Étape 2 : Sélection des courses à traiter ──────────────────────
    // Sans `force` : on saute les courses ayant déjà des partants (comportement
    //   historique — utile pour "remplir les trous" sans toucher au reste).
    // Avec `force=1` : on inclut tout — utilisé pour backfill après bug parser.
    const toProcess: CourseToProcess[] = (rawCourses ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((c: any) => force || (Array.isArray(c.partants) && c.partants.length === 0))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => ({
        id:             c.id,
        numero_reunion: c.numero_reunion,
        numero_course:  c.numero_course,
        libelle:        c.libelle,
        date_course:    c.date_course,
        geny_url:       c.geny_url,
      }));

    if (toProcess.length === 0) {
      return NextResponse.json({
        ok:       true,
        date,
        force,
        total:    0,
        success:  0,
        failed:   0,
        duration: Date.now() - startGlobal,
        details:  [],
        message:  force
          ? "Aucune course pour cette date (date_course inconnu ou ANNULE)."
          : "Aucune course à traiter (toutes ont déjà des partants).",
      });
    }

    // ── Étape 3 : Process en pool (concurrence 4) ──────────────────────
    const details = await processInPool(toProcess, CONCURRENCY, (course) =>
      processCourse(course, supabase, force),
    );

    const success = details.filter((d) => d.status === "success").length;
    const failed = details.length - success;

    // ── Étape 4 : Revalidate les pages publiques impactées ─────────────
    try {
      revalidatePath(`/programme/${date}`);
      revalidatePath(`/quinte-plus/${date}`);
      // Pages courses individuelles : trop nombreuses, skip
    } catch {
      // best-effort
    }

    const result: BatchResult = {
      ok:       true,
      date,
      force,
      total:    details.length,
      success,
      failed,
      duration: Date.now() - startGlobal,
      details,
    };
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[POST batch-prefill partants] exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
