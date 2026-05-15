/**
 * POST /api/admin/backfill-historique-courses
 *
 * Backfill historique des courses Geny manquantes pour une plage de dates.
 * Pour chaque date, appelle runGenyProgrammeSync() qui scrape la page
 * programme et upsert les courses + hippodromes (idempotent).
 *
 * Contexte : table `courses` ne contient que ~370 courses sur 62 jours
 * distincts (audit 2026-05-15). Pour activer le SEO programmatique des
 * pages /chevaux/[slug] etc., il faut backfiller 3-6 mois d'historique
 * pour avoir un volume suffisant de partants → stats nb_courses >= 3.
 *
 * Architecture rate-limit :
 *   - Sequentiel (pas parallele) pour respecter Geny + ~1.5s entre fetches
 *   - Max 15 dates par invocation (CF Workers : 50 subrequests limit,
 *     ~3 subrequests par date = 45)
 *   - `has_more: true` si plus de dates a traiter -> re-appeler
 *
 * Body JSON ou query :
 *   { dateDebut?: "YYYY-MM-DD", dateFin?: "YYYY-MM-DD", maxDates?: 15 }
 *
 * Defaults :
 *   - dateDebut = J-90, dateFin = J-1 (J = aujourd'hui)
 *   - maxDates = 15
 *
 * Apres run : appeler manuellement
 *   - /api/admin/backfill-partants?days=90 (en plusieurs passes)
 *   - /api/admin/backfill-resultats avec { dateDebut, dateFin }
 *   - Le cron seo-etl (3h45 UTC) tournera automatiquement le lendemain.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";
import { runGenyProgrammeSync, type GenyProgrammeResult } from "@/lib/sync/geny-programme";
import { todayParisISO } from "@/lib/paris-date";
import { logger } from "@/lib/observability/logger";

export const dynamic     = "force-dynamic";
export const maxDuration = 300; // 5 min cap (Vercel Pro / CF Worker bundled)

const DEFAULT_MAX_DATES   = 15;
const HARD_CAP_MAX_DATES  = 30;
const RATE_LIMIT_DELAY_MS = 1500; // entre 2 fetches Geny

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00Z").getTime());
}

function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(start + "T00:00:00Z");
  const fin = new Date(end + "T00:00:00Z");
  while (cur <= fin) {
    out.push(cur.toISOString().split("T")[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function defaultDateRange(): { dateDebut: string; dateFin: string } {
  const today = todayParisISO();
  const dateFinDate = new Date(today + "T00:00:00Z");
  dateFinDate.setUTCDate(dateFinDate.getUTCDate() - 1); // J-1 (pas aujourd'hui : geree par autre cron)
  const dateDebutDate = new Date(today + "T00:00:00Z");
  dateDebutDate.setUTCDate(dateDebutDate.getUTCDate() - 90); // J-90
  return {
    dateDebut: dateDebutDate.toISOString().split("T")[0],
    dateFin:   dateFinDate.toISOString().split("T")[0],
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Route ─────────────────────────────────────────────────────────────────

async function runBackfill(req: NextRequest): Promise<NextResponse> {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  // Params : POST body OR GET query
  const defaults = defaultDateRange();
  let dateDebut = defaults.dateDebut;
  let dateFin   = defaults.dateFin;
  let maxDates  = DEFAULT_MAX_DATES;

  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (typeof body?.dateDebut === "string") dateDebut = body.dateDebut;
      if (typeof body?.dateFin   === "string") dateFin   = body.dateFin;
      if (typeof body?.maxDates  === "number") {
        maxDates = Math.min(HARD_CAP_MAX_DATES, Math.max(1, Math.floor(body.maxDates)));
      }
    } catch { /* body optionnel */ }
  } else {
    const url = new URL(req.url);
    const qDebut = url.searchParams.get("dateDebut");
    const qFin   = url.searchParams.get("dateFin");
    const qMax   = url.searchParams.get("maxDates");
    if (qDebut) dateDebut = qDebut;
    if (qFin)   dateFin   = qFin;
    if (qMax) maxDates = Math.min(HARD_CAP_MAX_DATES, Math.max(1, parseInt(qMax, 10) || DEFAULT_MAX_DATES));
  }

  if (!isValidDate(dateDebut) || !isValidDate(dateFin)) {
    return NextResponse.json({ error: "Format date invalide (attendu YYYY-MM-DD)" }, { status: 400 });
  }
  if (dateDebut > dateFin) {
    return NextResponse.json({ error: "dateDebut > dateFin" }, { status: 400 });
  }

  const today = todayParisISO();
  if (dateFin >= today) {
    return NextResponse.json({
      error: "dateFin doit etre < aujourd'hui (les courses du jour/futur sont gerees par geny-arrivees / pmu-demain)",
      today,
    }, { status: 400 });
  }

  const allDates = dateRange(dateDebut, dateFin);
  const datesBatch = allDates.slice(0, maxDates);
  const hasMore = allDates.length > maxDates;

  // Traitement sequentiel avec delay pour respecter Geny
  const perDate: Array<{ date: string; result: Partial<GenyProgrammeResult>; error?: string }> = [];
  let totalInserted = 0;
  let totalUpdated  = 0;
  let totalCourses  = 0;
  let errors = 0;
  const startMs = Date.now();

  for (let i = 0; i < datesBatch.length; i++) {
    const date = datesBatch[i];
    try {
      const result = await runGenyProgrammeSync(date);
      perDate.push({ date, result });
      totalInserted += result.inserted ?? 0;
      totalUpdated  += result.updated  ?? 0;
      totalCourses  += result.courses  ?? 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors++;
      perDate.push({ date, result: {}, error: msg });
      logger.warn("backfill-historique-courses", `Date ${date} failed: ${msg}`);
    }
    // Rate limit : delay sauf apres la derniere
    if (i < datesBatch.length - 1) await sleep(RATE_LIMIT_DELAY_MS);
  }

  return NextResponse.json({
    ok: true,
    dateDebut,
    dateFin,
    total_dates_in_range:   allDates.length,
    dates_processed:        datesBatch.length,
    courses_total:          totalCourses,
    courses_inserted:       totalInserted,
    courses_updated:        totalUpdated,
    errors,
    has_more:               hasMore,
    elapsed_ms:             Date.now() - startMs,
    next_dates_to_process:  hasMore ? allDates.slice(maxDates, maxDates + 5) : [],
    per_date:               perDate,
    ...(hasMore ? {
      note: `${allDates.length - maxDates} dates restantes — relancer avec dateDebut=${allDates[maxDates]}`,
    } : {
      note_followup: "Backfill courses terminé. Etapes suivantes : /api/admin/backfill-partants?days=90 (plusieurs passes), puis /api/admin/backfill-resultats",
    }),
  });
}

export async function GET(req: NextRequest)  { return runBackfill(req); }
export async function POST(req: NextRequest) { return runBackfill(req); }
