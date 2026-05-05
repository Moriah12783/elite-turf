/**
 * GET /api/cron/enrichir-partants
 *
 * Cron — déclenché à 9h27 et 11h47 UTC (heures cibles audit / sprint 1).
 * Enrichit les partants de toutes les courses du jour avec les données Geny :
 * cote, musique, poids, jockey, entraîneur.
 *
 * STRATÉGIE GENY PRIMARY (depuis 2026-05-05) :
 * - L'API PMU rate-limite massivement les IPs Cloudflare/Vercel (HTTP 420
 *   à 100% sur les 3 derniers jours d'après cron_logs). Le scraping Geny
 *   public est resté solide (cf fix parser PR #1).
 * - On scrape Geny en source primaire, sans tenter PMU. Plus rapide
 *   (1 req au lieu de 5 timeouts × 1.5s) et plus fiable.
 * - PMU API reste utilisable manuellement via l'admin force-sync, mais
 *   plus dans les crons automatiques.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchGenyPartants } from "@/lib/geny";
import { logCronStart } from "@/lib/cron-logger";
import { logger } from "@/lib/observability/logger";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

/** Concurrence : combien de scrapes Geny en parallèle. Geny est public,
 *  6 simultanés est sain (≈ 1 req/s par scrape, bursts < 10/s). */
const CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 6000;

interface CourseRow {
  id:             string;
  numero_reunion: number;
  numero_course:  number;
  libelle:        string;
  statut:         string;
  geny_url:       string | null;
  date_course:    string;
}

interface EnrichResult {
  courseId: string;
  libelle:  string;
  status:   "ok" | "no_data" | "error";
  nb?:      number;
  detail?:  string;
}

/** Enrichit une course depuis Geny. Retourne le résultat structuré. */
async function enrichCourseFromGeny(
  course: CourseRow,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<EnrichResult> {
  if (!course.geny_url) {
    return {
      courseId: course.id,
      libelle:  course.libelle,
      status:   "no_data",
      detail:   "geny_url manquante (course probablement LONACI Afrique sans équivalent Geny)",
    };
  }

  let genyPartants;
  try {
    genyPartants = await fetchGenyPartants(
      course.date_course,
      course.numero_reunion,
      course.numero_course,
      FETCH_TIMEOUT_MS,
      course.geny_url,
    );
  } catch (err) {
    return {
      courseId: course.id,
      libelle:  course.libelle,
      status:   "error",
      detail:   err instanceof Error ? err.message : String(err),
    };
  }

  if (genyPartants.length === 0) {
    return {
      courseId: course.id,
      libelle:  course.libelle,
      status:   "no_data",
      detail:   "Geny scrape retourné 0 partants",
    };
  }

  const toInsert = genyPartants
    .filter((g) => !g.nom?.toUpperCase().includes("NON_PARTANT"))
    .map((g) => ({
      course_id:   course.id,
      numero:      g.numPmu,
      nom_cheval:  g.nom,
      jockey:      g.jockey?.nom ?? null,
      entraineur:  g.entraineur?.nom ?? null,
      cote:        g.coteProbable ?? null,
      musique:     g.musique ?? null,
      poids_kg:    g.poids ?? null,
      place_corde: g.placeCorde ?? null,
      age:         g.age ?? null,
      sexe:        g.sexe ?? null,
      non_partant: g.nonPartant ?? false,
      scraped_at:  new Date().toISOString(),
    }));

  if (toInsert.length === 0) {
    return { courseId: course.id, libelle: course.libelle, status: "no_data" };
  }

  // Replace : delete + insert (transaction de fait au sein de Supabase RLS)
  await supabase.from("partants").delete().eq("course_id", course.id);
  const { error: insErr } = await supabase.from("partants").insert(toInsert);

  if (insErr) {
    return {
      courseId: course.id,
      libelle:  course.libelle,
      status:   "error",
      detail:   `insert: ${insErr.message}`,
    };
  }

  // Mettre à jour nb_partants sur la course
  await supabase
    .from("courses")
    .update({ nb_partants: toInsert.length })
    .eq("id", course.id);

  return {
    courseId: course.id,
    libelle:  course.libelle,
    status:   "ok",
    nb:       toInsert.length,
  };
}

/** Limite la concurrence de Promise.all à `n` workers en parallèle. */
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
  // Auth cron
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronLog  = logCronStart("enrichir-partants");
  const supabase = createServiceClient();
  const today    = new Date().toISOString().split("T")[0];

  try {
    // 1. Courses du jour non annulées
    const { data: courses, error: coursesErr } = await supabase
      .from("courses")
      .select("id, numero_reunion, numero_course, libelle, statut, geny_url, date_course")
      .eq("date_course", today)
      .neq("statut", "ANNULE");

    if (coursesErr) {
      await cronLog.finish("failure", { error: `Query courses: ${coursesErr.message}` });
      return NextResponse.json({ error: coursesErr.message }, { status: 500 });
    }

    if (!courses || courses.length === 0) {
      await cronLog.finish("skip", { reason: "Aucune course du jour", date: today });
      return NextResponse.json({ ok: true, message: "Aucune course à enrichir", date: today });
    }

    // 2. Identifier celles déjà enrichies (avec partants ET musique = vrai enrichissement Geny)
    const { data: enrichies } = await supabase
      .from("partants")
      .select("course_id")
      .in("course_id", courses.map((c: CourseRow) => c.id))
      .not("musique", "is", null);
    const enrichieIds = new Set((enrichies ?? []).map((p) => p.course_id));

    const aEnrichir = (courses as CourseRow[]).filter((c) => !enrichieIds.has(c.id));

    if (aEnrichir.length === 0) {
      await cronLog.finish("skip", {
        reason:       "Toutes les courses sont déjà enrichies",
        date:         today,
        total:        courses.length,
      });
      return NextResponse.json({
        ok:      true,
        message: "Toutes les courses sont déjà enrichies",
        date:    today,
        total:   courses.length,
      });
    }

    // 3. Enrichir en parallèle (6 workers)
    const results = await processInPool(aEnrichir, CONCURRENCY, (course) =>
      enrichCourseFromGeny(course, supabase),
    );

    const ok      = results.filter((r) => r.status === "ok").length;
    const noData  = results.filter((r) => r.status === "no_data").length;
    const errors  = results.filter((r) => r.status === "error").length;
    const totalPartants = results.reduce((s, r) => s + (r.nb ?? 0), 0);

    const status = errors > aEnrichir.length / 2 ? "failure" : "success";

    await cronLog.finish(status, {
      date:          today,
      total_courses: courses.length,
      processed:     aEnrichir.length,
      ok,
      no_data:       noData,
      errors,
      total_partants: totalPartants,
      ...(errors > 0 ? {
        error: `${errors} courses en erreur`,
        sample_errors: results.filter(r => r.status === "error").slice(0, 3),
      } : {}),
    });

    return NextResponse.json({
      ok:           true,
      date:         today,
      total:        courses.length,
      processed:    aEnrichir.length,
      enriched:     ok,
      no_data:      noData,
      errors,
      total_partants: totalPartants,
      details:      results,
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
