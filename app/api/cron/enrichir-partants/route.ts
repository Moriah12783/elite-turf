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

    // 2. Filtrer celles déjà enrichies (avec partants ET musique)
    const { data: enrichies } = await supabase
      .from("partants")
      .select("course_id")
      .in("course_id", courses.map((c: CourseRow) => c.id))
      .not("musique", "is", null);
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
