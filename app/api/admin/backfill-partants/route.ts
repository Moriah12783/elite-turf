/**
 * POST /api/admin/backfill-partants?days=14
 *
 * Backfill admin one-shot : scrape Geny pour toutes les courses des N
 * derniers jours qui n'ont pas de partants en DB. Comble le trou data
 * accumulé pendant que pmu-sync échouait à 100%.
 *
 * Architecture bulk (cf enrichir-partants) :
 *  - 40 fetches Geny en parallèle (lecture seule)
 *  - 1 bulk DELETE
 *  - 1 bulk INSERT
 *  Total ≤ 42 subrequests ≤ 50 (Cloudflare Workers Free limit).
 *
 * Body optionnel :
 *   { days?: 14 }   nb jours (max 30, défaut 14)
 *   { date?: "YYYY-MM-DD" }   ne traiter qu'une date précise
 *
 * Retourne `has_more: true` si plus de 40 courses à backfiller — ré-appeler.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";
import { fetchGenyPartants, safeCote, safePoids, safeSmallInt, type GenyParticipant } from "@/lib/geny";
import { fetchLonaciPartantsMap } from "@/lib/sync/lonaci-partants";
import { fetchPmuCotesMap, resolvePmuCote, sameHorse, coteSource } from "@/lib/cotes/pmu-csv";
import { logger } from "@/lib/observability/logger";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const CONCURRENCY        = 5;
const FETCH_TIMEOUT_MS   = 6000;
const MAX_COURSES_PER_RUN = 40;

interface CourseRow {
  id:             string;
  numero_reunion: number;
  numero_course:  number;
  libelle:        string;
  geny_url:       string | null;
  date_course:    string;
}

type ScrapeOutcome =
  | { courseId: string; status: "ok"; partants: GenyParticipant[] }
  | { courseId: string; status: "no_data" | "error"; detail?: string };

async function scrapeOne(course: CourseRow): Promise<ScrapeOutcome> {
  if (!course.geny_url) {
    return { courseId: course.id, status: "no_data", detail: "geny_url absente" };
  }
  try {
    const partants = await fetchGenyPartants(
      course.date_course, course.numero_reunion, course.numero_course,
      FETCH_TIMEOUT_MS, course.geny_url,
    );
    if (partants.length === 0) {
      return { courseId: course.id, status: "no_data", detail: "Geny scrape vide" };
    }
    return { courseId: course.id, status: "ok", partants };
  } catch (err) {
    return {
      courseId: course.id, status: "error",
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

async function runBackfill(req: NextRequest): Promise<NextResponse> {
  // 🔒 Auth admin : Bearer CRON_SECRET (scripts) OU session ADMIN (cookie navigateur)
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  const adminClient = createServiceClient();

  // Params (POST body OU GET query params, pour permettre l'usage navigateur direct)
  let days = 14;
  let onlyDate: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (typeof body?.days === "number") days = Math.min(30, Math.max(1, body.days));
      if (typeof body?.date === "string") onlyDate = body.date;
    } catch {}
  } else {
    const url = new URL(req.url);
    const daysParam = url.searchParams.get("days");
    if (daysParam) days = Math.min(30, Math.max(1, parseInt(daysParam, 10) || 14));
    onlyDate = url.searchParams.get("date");
  }

  const today = new Date();
  const fromDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];

  // Sélection
  let coursesQuery = adminClient
    .from("courses")
    .select("id, numero_reunion, numero_course, libelle, geny_url, date_course")
    .neq("statut", "ANNULE")
    .order("date_course", { ascending: false })
    .limit(500); // cap pour ne pas exploser le filter

  if (onlyDate) {
    coursesQuery = coursesQuery.eq("date_course", onlyDate);
  } else {
    coursesQuery = coursesQuery.gte("date_course", fromDate);
  }

  const { data: courses, error: cErr } = await coursesQuery;
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!courses || courses.length === 0) {
    return NextResponse.json({ ok: true, message: "Aucune course dans la fenêtre", days, fromDate });
  }

  // Filtrer celles déjà scrapées dans les dernières 24h (backfill = one-shot
  // quotidien, pas besoin de re-scraper plusieurs fois par jour les mêmes
  // courses). Utiliser scraped_at au lieu de "musique not null" pour ne pas
  // tourner en boucle sur les courses où Geny ne donne pas de musique.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await adminClient
    .from("partants")
    .select("course_id")
    .in("course_id", courses.map((c: CourseRow) => c.id))
    .gte("scraped_at", dayAgo);
  const enrichedIds = new Set((existing ?? []).map((p) => p.course_id));

  const remainingAll = (courses as CourseRow[]).filter((c) => !enrichedIds.has(c.id));
  const toBackfill   = remainingAll.slice(0, MAX_COURSES_PER_RUN);
  const has_more     = remainingAll.length > MAX_COURSES_PER_RUN;

  if (toBackfill.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "Toutes les courses dans la fenêtre sont déjà enrichies",
      days,
      total_in_window: courses.length,
    });
  }

  // Étape 1 : fetch Geny en parallèle (lecture seule)
  const outcomes = await processInPool(toBackfill, CONCURRENCY, scrapeOne);
  const okOutcomes = outcomes.filter((o): o is Extract<ScrapeOutcome, { status: "ok" }> => o.status === "ok");

  // Fallback LONACI (jour courant uniquement — LONACI ne sert que le jour) :
  // comble les courses que Geny n'a pas pu enrichir (429 ou pas de geny_url car
  // chargées via PMU/LONACI). 1 requête pour toutes les courses du jour.
  const todayStr = new Date().toISOString().split("T")[0];
  const okSet = new Set(okOutcomes.map((o) => o.courseId));
  const failedToday = toBackfill.filter((c) => !okSet.has(c.id) && c.date_course === todayStr);
  if (failedToday.length > 0) {
    try {
      const lonaciMap = await fetchLonaciPartantsMap(todayStr);
      for (const c of failedToday) {
        const parts = lonaciMap.get(`${c.numero_reunion}|${c.numero_course}`);
        if (parts && parts.length > 0) {
          okOutcomes.push({ courseId: c.id, status: "ok", partants: parts as unknown as GenyParticipant[] });
        }
      }
    } catch (e) {
      logger.warn("backfill-partants", "Fallback LONACI KO", { error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Cotes PMU OFFICIELLES (CSV public, IP Google non bloquée) = source
  // PRIORITAIRE des cotes (comme le cron). Écrase la cote par la cote_directe
  // PMU (repli référence) appariée par (réunion, course, num) + garde-fou nom.
  // Course hors CSV → cote existante conservée. NP/absente → NULL (jamais 1,2).
  try {
    const pmuCotes = await fetchPmuCotesMap();
    if (pmuCotes.size > 0) {
      const rcById = new Map(
        toBackfill.map((c) => [c.id, { reunion: c.numero_reunion, course: c.numero_course }] as const),
      );
      for (const o of okOutcomes) {
        const rc = rcById.get(o.courseId);
        if (!rc) continue;
        for (const g of o.partants as any[]) {
          const row = pmuCotes.get(`${rc.reunion}|${rc.course}|${g.numPmu}`);
          if (!row || !sameHorse(g.nom ?? "", row.cheval)) continue;
          const cote = resolvePmuCote(row);
          // PARTANT sans cote PMU encore publiée → garder la cote existante (LONACI).
          if (cote == null && !row.nonPartant) continue;
          g.coteProbable = cote == null ? undefined : cote;
          if (row.nonPartant) g.nonPartant = true;
          g.coteFromPmu = true; // provenance : cote (ou statut NP) autoritaire depuis le CSV PMU
        }
      }
    }
  } catch (e) {
    logger.warn("backfill-partants", "Cotes PMU CSV KO", { error: e instanceof Error ? e.message : String(e) });
  }

  // Étape 2 : bulk delete + bulk insert
  let inserted = 0;
  if (okOutcomes.length > 0) {
    const okIds = okOutcomes.map((o) => o.courseId);
    const { error: delErr } = await adminClient.from("partants").delete().in("course_id", okIds);
    if (delErr) {
      logger.error("backfill-partants", "Bulk delete failed", { error: delErr.message });
    }

    const allRows = okOutcomes.flatMap((o) =>
      o.partants
        .filter((g) => !g.nom?.toUpperCase().includes("NON_PARTANT"))
        .map((g) => {
          const cote = safeCote(g.coteProbable);
          return {
            course_id:   o.courseId,
            numero:      g.numPmu,
            nom_cheval:  g.nom,
            jockey:      g.jockey?.nom ?? null,
            entraineur:  g.entraineur?.nom ?? null,
            cote,
            cote_source: coteSource(cote, !!(g as any).coteFromPmu),
            musique:     g.musique ?? null,
            poids_kg:    safePoids(g.poids),
            place_corde: safeSmallInt(g.placeCorde, 1, 30),
            age:         safeSmallInt(g.age, 1, 30),
            sexe:        g.sexe ?? null,
            non_partant: g.nonPartant ?? false,
            scraped_at:  new Date().toISOString(),
          };
        }),
    );

    if (allRows.length > 0) {
      const { error: insErr, count } = await adminClient
        .from("partants")
        .insert(allRows, { count: "exact" });
      if (insErr) {
        logger.error("backfill-partants", "Bulk insert failed", { error: insErr.message, rows: allRows.length });
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      inserted = count ?? allRows.length;
    }
  }

  const ok      = okOutcomes.length;
  const noData  = outcomes.filter((o) => o.status === "no_data").length;
  const errors  = outcomes.filter((o) => o.status === "error").length;

  if (errors > 0) {
    logger.warn("backfill-partants", `${errors} erreurs sur ${toBackfill.length} courses`, {
      days,
      sample_errors: outcomes.filter((o) => o.status === "error").slice(0, 3),
    });
  }

  return NextResponse.json({
    ok:                true,
    days,
    fromDate,
    total_in_window:   courses.length,
    remaining:         remainingAll.length,
    processed:         toBackfill.length,
    enriched:          ok,
    no_data:           noData,
    errors,
    partants_inserted: inserted,
    has_more,
    ...(has_more ? {
      note: `${remainingAll.length - toBackfill.length} courses restantes — relancer cet endpoint pour traiter le reste`,
    } : {}),
  });
}

// Accepte GET et POST. GET pratique pour usage navigateur direct :
//   https://www.elite-turf.fr/api/admin/backfill-partants?days=14
export async function GET(req: NextRequest)  { return runBackfill(req); }
export async function POST(req: NextRequest) { return runBackfill(req); }
