/**
 * POST /api/admin/backfill-partants?days=14
 *
 * Backfill admin one-shot : scrape Geny pour toutes les courses des N
 * derniers jours qui n'ont pas de partants en DB. Comble le trou data
 * accumulé pendant que pmu-sync échouait à 100% (HTTP 420 chronique).
 *
 * Auth : ADMIN session (cookie) + CRON_SECRET pour éviter les abus.
 * Le cron alerte à 50% partants → on appelle ça pour passer de 11% à 90%+.
 *
 * Body optionnel :
 *   { days?: number }   nombre de jours à backfiller (défaut 14, max 30)
 *   { date?: string }   ne traiter qu'une date YYYY-MM-DD
 *
 * Limite : 200 courses par appel (timeout Cloudflare Workers ~60s).
 *          Pour backfill > 200 courses, ré-appeler plusieurs fois.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fetchGenyPartants } from "@/lib/geny";
import { logger } from "@/lib/observability/logger";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 6000;
const MAX_COURSES_PER_RUN = 200;

interface CourseRow {
  id:             string;
  numero_reunion: number;
  numero_course:  number;
  libelle:        string;
  geny_url:       string | null;
  date_course:    string;
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

async function backfillOne(
  course: CourseRow,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<{ courseId: string; status: "ok" | "no_data" | "error"; nb?: number; detail?: string }> {
  if (!course.geny_url) {
    return { courseId: course.id, status: "no_data", detail: "geny_url absente" };
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
      status:   "error",
      detail:   err instanceof Error ? err.message : String(err),
    };
  }

  if (genyPartants.length === 0) {
    return { courseId: course.id, status: "no_data", detail: "Geny scrape vide" };
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
    return { courseId: course.id, status: "no_data" };
  }

  await supabase.from("partants").delete().eq("course_id", course.id);
  const { error: insErr } = await supabase.from("partants").insert(toInsert);
  if (insErr) {
    return { courseId: course.id, status: "error", detail: `insert: ${insErr.message}` };
  }

  await supabase
    .from("courses")
    .update({ nb_partants: toInsert.length })
    .eq("id", course.id);

  return { courseId: course.id, status: "ok", nb: toInsert.length };
}

export async function POST(req: NextRequest) {
  // ── Auth : ADMIN session ────────────────────────────────────────────────
  const supabaseClient = await createClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const adminClient = createServiceClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Params ─────────────────────────────────────────────────────────────
  let days = 14;
  let onlyDate: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.days === "number") days = Math.min(30, Math.max(1, body.days));
    if (typeof body?.date === "string") onlyDate = body.date;
  } catch {
    // pas de body : utiliser les défauts
  }

  // ── Sélectionner les courses à backfiller ──────────────────────────────
  const today = new Date();
  const fromDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];

  let coursesQuery = adminClient
    .from("courses")
    .select("id, numero_reunion, numero_course, libelle, geny_url, date_course")
    .neq("statut", "ANNULE")
    .not("geny_url", "is", null)
    .order("date_course", { ascending: false })
    .limit(MAX_COURSES_PER_RUN * 3); // marge pour filtrer les déjà enrichies

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

  // Filtrer celles déjà enrichies (avec partants en DB)
  const { data: existing } = await adminClient
    .from("partants")
    .select("course_id")
    .in("course_id", courses.map((c: CourseRow) => c.id));
  const enrichedIds = new Set((existing ?? []).map((p) => p.course_id));

  const toBackfill = (courses as CourseRow[])
    .filter((c) => !enrichedIds.has(c.id))
    .slice(0, MAX_COURSES_PER_RUN);

  if (toBackfill.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "Toutes les courses dans la fenêtre sont déjà enrichies",
      days,
      total_in_window: courses.length,
    });
  }

  // ── Process en parallèle ───────────────────────────────────────────────
  const results = await processInPool(toBackfill, CONCURRENCY, (c) => backfillOne(c, adminClient));

  const ok      = results.filter((r) => r.status === "ok").length;
  const noData  = results.filter((r) => r.status === "no_data").length;
  const errors  = results.filter((r) => r.status === "error").length;
  const totalPartants = results.reduce((s, r) => s + (r.nb ?? 0), 0);

  if (errors > 0) {
    logger.warn("backfill-partants", `${errors} erreurs sur ${toBackfill.length} courses`, {
      days,
      sample_errors: results.filter((r) => r.status === "error").slice(0, 3),
    });
  }

  return NextResponse.json({
    ok:                true,
    days,
    fromDate,
    total_in_window:   courses.length,
    processed:         toBackfill.length,
    enriched:          ok,
    no_data:           noData,
    errors,
    total_partants:    totalPartants,
    has_more:          (courses.length - enrichedIds.size) > MAX_COURSES_PER_RUN,
    note:              (courses.length - enrichedIds.size) > MAX_COURSES_PER_RUN
      ? "Plus de 200 courses à backfiller — relancer cet endpoint pour traiter le reste"
      : undefined,
  });
}
