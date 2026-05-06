/**
 * POST /api/admin/backfill-rapports?days=30&dry=0
 *
 * Rattrape les rapports PMU complets (JSONB) + commentaires pour les courses
 * TERMINEes des N derniers jours qui n'ont pas encore d'entrée enrichie dans
 * la table `arrivees`.
 *
 * Pourquoi : avant le 2026-05-07, la sync `geny-arrivees` ne stockait QUE
 * `ordre_arrivee`. Les courses passées n'ont donc pas de rapports_pmu
 * exploitables côté front. Cet endpoint refait le scrape pour rattraper
 * cet historique.
 *
 * Query params :
 *  - days : nombre de jours à rattraper en arrière (défaut 30, max 90)
 *  - dry  : 1 = mode dry-run (pas d'écriture DB), 0 = vrai backfill
 *
 * Body JSON optionnel : { dateDebut: "YYYY-MM-DD", dateFin: "YYYY-MM-DD" }
 *
 * Auth : Bearer CRON_SECRET OU session admin (cookie).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildGenyUrlFromStored } from "@/lib/geny";
import {
  parseRapportsPMU,
  parseCommentaire,
  type RapportsPMU,
} from "@/lib/sync/geny-rapports-parser";

export const dynamic     = "force-dynamic";
export const maxDuration = 300;

const USER_AGENT       = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 8000;
const CONCURRENCY      = 3; // garder bas pour ne pas saturer Geny ni le worker

interface CourseRow {
  id:             string;
  date_course:    string;
  numero_reunion: number;
  numero_course:  number;
  geny_url:       string | null;
  arrivee_officielle: number[] | null;
}

interface ScrapeOutcome {
  courseId:    string;
  ok:          boolean;
  hasRapports: boolean;
  hasComment:  boolean;
  reason?:     string;
}

async function fetchAndParse(course: CourseRow): Promise<{
  arrivee:     number[] | null;
  rapports:    RapportsPMU | null;
  commentaire: string | null;
} | null> {
  if (!course.geny_url) return null;
  const url = buildGenyUrlFromStored(course.geny_url, "resultats");

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        "User-Agent":      USER_AGENT,
        "Accept":          "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Referer":         "https://www.geny.com/",
      },
      cache:  "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const html = await res.text();

    let rapports: RapportsPMU | null = null;
    let commentaire: string | null = null;
    try {
      const r = parseRapportsPMU(html);
      if (r && Object.keys(r).length > 0) rapports = r;
    } catch { /* defensive */ }
    try {
      commentaire = parseCommentaire(html);
    } catch { /* defensive */ }

    return {
      arrivee:     course.arrivee_officielle ?? null,
      rapports,
      commentaire,
    };
  } catch {
    return null;
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

const CRON_SECRET = process.env.CRON_SECRET || "";

async function authorize(req: NextRequest): Promise<NextResponse | null> {
  // (a) Bearer CRON_SECRET (scripts / cron)
  const auth = req.headers.get("authorization") ?? "";
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return null;

  // (b) Session admin (cookie)
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
  return null;
}

export async function POST(req: NextRequest) {
  const authError = await authorize(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(90, parseInt(url.searchParams.get("days") ?? "30", 10) || 30));
  const dry  = url.searchParams.get("dry") === "1";

  // dateDebut / dateFin via body éventuel, sinon fenêtre N jours rétro
  let dateDebut: string;
  let dateFin: string;
  try {
    const body = await req.json().catch(() => ({}));
    if (body.dateDebut && body.dateFin) {
      dateDebut = body.dateDebut;
      dateFin   = body.dateFin;
    } else {
      const today = new Date();
      dateFin = today.toISOString().split("T")[0];
      const start = new Date(today);
      start.setUTCDate(start.getUTCDate() - days);
      dateDebut = start.toISOString().split("T")[0];
    }
  } catch {
    const today = new Date();
    dateFin = today.toISOString().split("T")[0];
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - days);
    dateDebut = start.toISOString().split("T")[0];
  }

  const supabase = createServiceClient();

  // 1. Lister les courses TERMINE de la fenêtre dont l'entrée arrivees
  //    n'a pas encore de rapports_pmu (c.-à-d. à scraper)
  const { data: courses, error: coursesErr } = await supabase
    .from("courses")
    .select(`
      id, date_course, numero_reunion, numero_course, geny_url,
      arrivee_officielle, statut,
      arrivees(course_id, rapports_pmu)
    `)
    .gte("date_course", dateDebut)
    .lte("date_course", dateFin)
    .eq("statut", "TERMINE")
    .not("geny_url", "is", null);

  if (coursesErr) {
    return NextResponse.json({ error: coursesErr.message }, { status: 500 });
  }

  // Filtrer celles dont rapports_pmu est déjà rempli (skip)
  const candidates: CourseRow[] = (courses ?? []).filter((c: any) => {
    const arrRow = Array.isArray(c.arrivees) ? c.arrivees[0] : c.arrivees;
    const alreadyHasRapports = arrRow?.rapports_pmu
      && Object.keys(arrRow.rapports_pmu).length > 0;
    return !alreadyHasRapports;
  }).map((c: any) => ({
    id:             c.id,
    date_course:    c.date_course,
    numero_reunion: c.numero_reunion,
    numero_course:  c.numero_course,
    geny_url:       c.geny_url,
    arrivee_officielle: c.arrivee_officielle,
  }));

  console.log(`[backfill-rapports] ${candidates.length} courses à rattraper (${dateDebut} → ${dateFin}, dry=${dry})`);

  // 2. Scraper en parallèle (3 workers)
  const outcomes = await processInPool<CourseRow, ScrapeOutcome>(
    candidates,
    CONCURRENCY,
    async (course) => {
      const data = await fetchAndParse(course);
      if (!data) {
        return { courseId: course.id, ok: false, hasRapports: false, hasComment: false, reason: "fetch failed" };
      }
      const hasRapports = !!data.rapports;
      const hasComment  = !!data.commentaire;

      if (!hasRapports && !hasComment) {
        return { courseId: course.id, ok: false, hasRapports, hasComment, reason: "empty parse" };
      }

      if (!dry) {
        try {
          await supabase.from("arrivees").upsert(
            {
              course_id:     course.id,
              ordre_arrivee: course.arrivee_officielle ?? [],
              rapports_pmu: data.rapports ?? null,
              commentaire:  data.commentaire ?? null,
              horodatage:    new Date().toISOString(),
            },
            { onConflict: "course_id" },
          );
        } catch (e) {
          return {
            courseId: course.id,
            ok: false,
            hasRapports,
            hasComment,
            reason: e instanceof Error ? e.message : "upsert failed",
          };
        }
      }

      return { courseId: course.id, ok: true, hasRapports, hasComment };
    },
  );

  const summary = {
    total:        candidates.length,
    enriched:     outcomes.filter((o) => o.ok).length,
    withRapports: outcomes.filter((o) => o.ok && o.hasRapports).length,
    withComment:  outcomes.filter((o) => o.ok && o.hasComment).length,
    failed:       outcomes.filter((o) => !o.ok).length,
  };

  return NextResponse.json({
    ok:        true,
    dry,
    dateDebut,
    dateFin,
    days,
    summary,
    failures:  outcomes.filter((o) => !o.ok).slice(0, 20),
    timestamp: new Date().toISOString(),
  });
}

// GET = même chose, plus pratique pour un curl rapide
export async function GET(req: NextRequest) {
  return POST(req);
}
