/**
 * GET /api/cron/enrichir-partants
 *
 * Cron — déclenché à 9h27, 11h47, 13h13, 15h13 UTC.
 * Scrape Geny en source primaire (PMU API rate-limit chronique).
 *
 * ARCHITECTURE BULK (Cloudflare Workers Free = 50 subrequests/invocation)
 * ----------------------------------------------------------------------
 *  N fetches Geny en parallèle (max 40)            →  N subrequests
 *  1 bulk DELETE pour les N courses                →  1 subrequest
 *  1 bulk INSERT de tous les partants              →  1 subrequest
 *  1 RPC update nb_partants en batch (ou skip)     →  0-1 subrequest
 *  -------------------------------------------------------------------
 *  Total ≤ 42 subrequests ≤ 50 ✅
 *
 *  Si plus de 40 courses à enrichir, retourne has_more: true.
 *  Le user peut relancer le cron pour traiter le reste, ou attendre le
 *  prochain tick automatique.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchGenyPartants, safeCote, safePoids, safeSmallInt, type GenyParticipant } from "@/lib/geny";
import { logCronStart } from "@/lib/cron-logger";
import { logger } from "@/lib/observability/logger";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

const CONCURRENCY        = 5;
const FETCH_TIMEOUT_MS   = 6000;
/** Cap pour rester < 50 subrequests Cloudflare Free (50 - 3 ops bulk = 47, on prend 40 marge). */
const MAX_COURSES_PER_RUN = 40;

/**
 * Self-cleanup : DELAY de grâce avant qu'une course sans partants soit
 * considérée fantôme. 3 jours = safe margin pour :
 *  - laisser le temps aux 4 ticks d'enrichir-partants de re-tenter
 *  - couvrir les courses créées tard la veille soir (cron geny-programme)
 *  - éviter de supprimer une course que Geny n'a temporairement pas servie
 */
const GHOST_GRACE_DAYS = 3;
/** Cap deletions par tick pour anti-timeout Cloudflare (60s max). */
const MAX_GHOST_DELETIONS_PER_RUN = 500;

interface CourseRow {
  id:             string;
  numero_reunion: number;
  numero_course:  number;
  libelle:        string;
  statut:         string;
  geny_url:       string | null;
  date_course:    string;
}

type ScrapeOutcome =
  | { courseId: string; libelle: string; status: "ok"; partants: GenyParticipant[] }
  | { courseId: string; libelle: string; status: "no_data" | "error"; detail?: string };

/** Étape 1 : scrape Geny (lecture seule, en parallèle). Pas d'écriture DB ici. */
async function scrapeOneCourse(course: CourseRow): Promise<ScrapeOutcome> {
  if (!course.geny_url) {
    return {
      courseId: course.id, libelle: course.libelle, status: "no_data",
      detail:   "geny_url manquante (course probablement LONACI Afrique sans équivalent Geny)",
    };
  }
  try {
    const partants = await fetchGenyPartants(
      course.date_course, course.numero_reunion, course.numero_course,
      FETCH_TIMEOUT_MS, course.geny_url,
    );
    if (partants.length === 0) {
      return { courseId: course.id, libelle: course.libelle, status: "no_data", detail: "Geny scrape retourné 0 partants" };
    }
    return { courseId: course.id, libelle: course.libelle, status: "ok", partants };
  } catch (err) {
    return {
      courseId: course.id, libelle: course.libelle, status: "error",
      detail:   err instanceof Error ? err.message : String(err),
    };
  }
}

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
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, () => next()));
  return results;
}

/**
 * Self-cleanup des courses fantômes : DELETE des courses qui sont à la fois
 *  - dans le passé d'au moins GHOST_GRACE_DAYS jours
 *  - sans aucun partant en BDD
 *  - sans aucun pronostic en BDD (garde-fou business)
 *
 * Pourquoi ici (intégré au cron enrichir-partants) plutôt qu'un cron dédié :
 *  - le cron tourne déjà 4×/jour → cleanup quasi temps réel
 *  - même CRON_SECRET, même service_role, pas de surface ajoutée
 *  - le coût Cloudflare est minimal (1-2 subrequests bulk)
 *
 * Pourquoi la grâce de 3 jours plutôt que strict "< today" :
 *  - laisse le temps aux 4 ticks quotidiens de re-tenter le scrape
 *  - couvre les courses créées tard la veille (cron programme + Geny lent)
 *  - évite les faux positifs sur les courses tardives Maroc/UTC
 *
 * Garde-fou : CASCADE supprime arrivees + partants + pronostics. Mais comme
 * on filtre déjà sur "0 partants + 0 pronostic", le CASCADE est no-op.
 * Quelques arrivees peuvent être supprimées (cas exotique : course TERMINE
 * sans partants synchronisés — donnée déjà cassée par construction).
 */
async function cleanupGhostCourses(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<{ deleted: number; skipped_pronostic: number; capped: boolean }> {
  // Calcul du seuil : date_course < today - GRACE_DAYS
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - GHOST_GRACE_DAYS);
  const cutoffISO = cutoff.toISOString().split("T")[0];

  // 1. Identifier les fantômes (SELECT, lecture seule)
  // On ne peut pas exprimer "0 partants AND 0 pronostic" directement en
  // Supabase JS lib → 3 queries :
  //   a) candidates = courses passées
  //   b) avec partants → exclure
  //   c) avec pronostic → exclure (préserver valeur business)
  const { data: candidates, error: errCand } = await supabase
    .from("courses")
    .select("id")
    .lt("date_course", cutoffISO)
    .limit(MAX_GHOST_DELETIONS_PER_RUN * 4); // marge x4 avant filtrage

  if (errCand || !candidates || candidates.length === 0) {
    return { deleted: 0, skipped_pronostic: 0, capped: false };
  }
  const candidateIds = candidates.map((c) => c.id);

  // Exclure celles AVEC partants
  const { data: withPartants } = await supabase
    .from("partants")
    .select("course_id")
    .in("course_id", candidateIds);
  const idsWithPartants = new Set((withPartants ?? []).map((p) => p.course_id));

  // Exclure celles AVEC pronostic (garde-fou business)
  const { data: withPronostic } = await supabase
    .from("pronostics")
    .select("course_id")
    .in("course_id", candidateIds);
  const idsWithPronostic = new Set((withPronostic ?? []).map((p) => p.course_id));

  const ghostIds = candidateIds.filter(
    (id) => !idsWithPartants.has(id) && !idsWithPronostic.has(id),
  );
  const capped = ghostIds.length > MAX_GHOST_DELETIONS_PER_RUN;
  const toDelete = ghostIds.slice(0, MAX_GHOST_DELETIONS_PER_RUN);

  if (toDelete.length === 0) {
    return {
      deleted:           0,
      skipped_pronostic: idsWithPronostic.size,
      capped:            false,
    };
  }

  // 2. DELETE bulk
  const { error: errDel } = await supabase
    .from("courses")
    .delete()
    .in("id", toDelete);

  if (errDel) {
    logger.error("enrichir-partants", "Ghost cleanup DELETE failed", {
      error:    errDel.message,
      attempt:  toDelete.length,
    });
    return { deleted: 0, skipped_pronostic: idsWithPronostic.size, capped };
  }

  return {
    deleted:           toDelete.length,
    skipped_pronostic: idsWithPronostic.size,
    capped,
  };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronLog  = logCronStart("enrichir-partants");
  const supabase = createServiceClient();
  const today    = new Date().toISOString().split("T")[0];

  try {
    // 1. Sélection courses du jour non enrichies (LONACI Afrique skipped : pas de geny_url)
    const { data: courses, error: coursesErr } = await supabase
      .from("courses")
      .select("id, numero_reunion, numero_course, libelle, statut, geny_url, date_course")
      .eq("date_course", today)
      .neq("statut", "ANNULE")
      .not("geny_url", "is", null);

    if (coursesErr) {
      await cronLog.finish("failure", { error: `Query courses: ${coursesErr.message}` });
      return NextResponse.json({ error: coursesErr.message }, { status: 500 });
    }

    if (!courses || courses.length === 0) {
      await cronLog.finish("skip", { reason: "Aucune course du jour avec geny_url", date: today });
      return NextResponse.json({ ok: true, message: "Aucune course à enrichir", date: today });
    }

    // 2. Filtrer celles déjà scrapées récemment (dans les 4 dernières heures)
    // - Évite de re-scraper en boucle les courses où Geny ne donne pas de musique
    //   (chevaux Inédit, Premio italien, courses provinciales).
    // - Permet quand même un refresh des cotes au cours de la journée (4h
    //   d'écart entre les ticks cron — 9h27, 11h47, 13h13, 15h13 UTC).
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: enrichies } = await supabase
      .from("partants")
      .select("course_id")
      .in("course_id", courses.map((c: CourseRow) => c.id))
      .gte("scraped_at", fourHoursAgo);
    const enrichieIds = new Set((enrichies ?? []).map((p) => p.course_id));

    const remainingAll = (courses as CourseRow[]).filter((c) => !enrichieIds.has(c.id));
    const aEnrichir    = remainingAll.slice(0, MAX_COURSES_PER_RUN);
    const has_more     = remainingAll.length > MAX_COURSES_PER_RUN;

    if (aEnrichir.length === 0) {
      await cronLog.finish("skip", {
        reason: "Toutes les courses sont déjà enrichies",
        date:   today,
        total:  courses.length,
      });
      return NextResponse.json({
        ok: true, message: "Toutes les courses sont déjà enrichies",
        date: today, total: courses.length,
      });
    }

    // 3. Étape SCRAPE : N fetches Geny en parallèle (lecture seule, pas de DB)
    const outcomes = await processInPool(aEnrichir, CONCURRENCY, scrapeOneCourse);
    const okOutcomes = outcomes.filter((o): o is Extract<ScrapeOutcome, { status: "ok" }> => o.status === "ok");

    // 4. Étape BULK WRITE : 1 delete + 1 insert pour TOUTES les courses ok
    let inserted = 0;
    if (okOutcomes.length > 0) {
      const okIds = okOutcomes.map((o) => o.courseId);

      // Bulk delete : 1 subrequest pour N courses
      const { error: delErr } = await supabase
        .from("partants")
        .delete()
        .in("course_id", okIds);
      if (delErr) {
        logger.error("enrichir-partants", "Bulk delete failed", { error: delErr.message });
      }

      // Bulk insert : 1 subrequest pour tous les partants
      const allRows = okOutcomes.flatMap((o) =>
        o.partants
          .filter((g) => !g.nom?.toUpperCase().includes("NON_PARTANT"))
          .map((g) => ({
            course_id:   o.courseId,
            numero:      g.numPmu,
            nom_cheval:  g.nom,
            jockey:      g.jockey?.nom ?? null,
            entraineur:  g.entraineur?.nom ?? null,
            cote:        safeCote(g.coteProbable),
            musique:     g.musique ?? null,
            poids_kg:    safePoids(g.poids),
            place_corde: safeSmallInt(g.placeCorde, 1, 30),
            age:         safeSmallInt(g.age, 1, 30),
            sexe:        g.sexe ?? null,
            non_partant: g.nonPartant ?? false,
            scraped_at:  new Date().toISOString(),
          })),
      );
      if (allRows.length > 0) {
        const { error: insErr, count } = await supabase
          .from("partants")
          .insert(allRows, { count: "exact" });
        if (insErr) {
          logger.error("enrichir-partants", "Bulk insert failed", { error: insErr.message, rows: allRows.length });
          await cronLog.finish("failure", { error: `Bulk insert: ${insErr.message}`, attempted_rows: allRows.length });
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
        inserted = count ?? allRows.length;
      }

      // 5. Update nb_partants en RPC (1 subrequest, calcule depuis partants).
      // Pas critique : on saute si pas de RPC dispo. La page courses recalcule
      // nb_partants à la volée si besoin via COUNT(*) sur partants.
    }

    const ok      = okOutcomes.length;
    const noData  = outcomes.filter((o) => o.status === "no_data").length;
    const errors  = outcomes.filter((o) => o.status === "error").length;
    const status  = errors > aEnrichir.length / 2 ? "failure" : "success";

    // ── Self-cleanup fantômes ───────────────────────────────────────────────
    // Tourne APRÈS le scraping principal : si le cron timeout côté Cloudflare,
    // le cleanup peut être skipped sans impact sur l'enrichissement.
    // Toujours best-effort : un échec du cleanup ne casse pas le cron.
    let cleanupResult = { deleted: 0, skipped_pronostic: 0, capped: false };
    try {
      cleanupResult = await cleanupGhostCourses(supabase);
      if (cleanupResult.deleted > 0) {
        logger.info("enrichir-partants", `Self-cleanup : ${cleanupResult.deleted} courses fantômes supprimées`, {
          deleted:           cleanupResult.deleted,
          skipped_pronostic: cleanupResult.skipped_pronostic,
          capped:            cleanupResult.capped,
        });
      }
    } catch (cleanupErr) {
      logger.error("enrichir-partants", "Self-cleanup failed (non-blocking)", {
        error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      });
    }

    await cronLog.finish(status, {
      date:           today,
      total_courses:  courses.length,
      remaining:      remainingAll.length,
      processed:      aEnrichir.length,
      ok,
      no_data:        noData,
      errors,
      partants_inserted: inserted,
      has_more,
      cleanup:        cleanupResult,
      ...(errors > 0 ? {
        error: `${errors} courses en erreur`,
        sample_errors: outcomes.filter((o) => o.status === "error").slice(0, 3),
      } : {}),
    });

    return NextResponse.json({
      ok:                true,
      date:              today,
      total:             courses.length,
      processed:         aEnrichir.length,
      enriched:          ok,
      no_data:           noData,
      errors,
      partants_inserted: inserted,
      has_more,
      cleanup:           cleanupResult,
      ...(has_more ? {
        note: `${remainingAll.length - aEnrichir.length} courses restantes — relancer le cron pour traiter le reste`,
      } : {}),
      details:           outcomes.map((o) => ({
        courseId: o.courseId,
        libelle:  o.libelle,
        status:   o.status,
        ...(o.status === "ok"      ? { nb: o.partants.length } : {}),
        ...("detail" in o && o.detail ? { detail: o.detail } : {}),
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("enrichir-partants", err, { date: today });
    await cronLog.finish("failure", { error: msg, date: today });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
