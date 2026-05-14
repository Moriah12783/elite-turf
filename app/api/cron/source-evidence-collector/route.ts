/**
 * GET /api/cron/source-evidence-collector
 *
 * Cron de collecte des preuves source pour le système Multi-Agents IA.
 *
 * 🎯 RÔLE
 *   Pour chaque course du jour en BDD, génère des preuves
 *   `course_source_evidence` à partir des sources externes auxquelles
 *   on a accès (LONACI, PMU.fr…). Sans ces preuves, le pipeline
 *   ia-pronostics-v2 ne peut pas valider la disponibilité Afrique
 *   d'une course (rejette tout par défaut).
 *
 * 🕐 PLANNING RECOMMANDÉ
 *   3h30 Paris (avant ia-pronostics-v2 4h Paris).
 *   Cron Cloudflare = "30 1 * * *" (UTC hiver) + "30 2 * * *" (UTC été)
 *   ou Vercel Cron.
 *
 * 🔐 AUTH
 *   Bearer CRON_SECRET (script automatisé).
 *
 * 📊 QUERY PARAMS
 *   - dry_run=1            → simule sans INSERT BDD
 *   - date=YYYY-MM-DD      → cible autre date que Paris today
 *
 * 📦 RESPONSE
 *   {
 *     ok: true,
 *     date: "2026-05-13",
 *     courses_processed: 28,
 *     evidence_inserted: 56,
 *     lonaci_available: true,
 *     lonaci_matches: 22,
 *     lonaci_missing: 6,
 *     pmu_heuristic_count: 28,
 *     errors: [],
 *     duration_ms: 1843
 *   }
 *
 * 📜 Conforme cahier des charges §5 (sources autorisées) + §22 (table preuves).
 */

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";
import { requireBearerOnly } from "@/lib/auth/checkAdminAuth";
import { todayParisISO } from "@/lib/paris-date";
import { collectSourceEvidenceForDate } from "@/lib/ai-pronostics/source-crawlers";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;   // crawl LONACI + INSERTs ≤ 5s en moyenne

export async function GET(req: NextRequest) {
  const authError = requireBearerOnly(req);
  if (authError) return authError;

  const url       = new URL(req.url);
  const dryRun    = url.searchParams.get("dry_run") === "1";
  const dateParam = url.searchParams.get("date");
  const dateISO   = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : todayParisISO();

  const cronLog = logCronStart("source-evidence-collector");

  try {
    const result = await collectSourceEvidenceForDate({
      date:   dateISO,
      dryRun,
    });

    const status =
      result.errors.length === 0 && result.courses_processed > 0 ? "success"
      : result.errors.length === 0                                ? "skip"
      :                                                              "failure";

    await cronLog.finish(status, {
      date:                           result.date,
      courses_processed:              result.courses_processed,
      evidence_inserted:              result.evidence_inserted,
      lonaci_available:               result.lonaci_available,
      lonaci_matches:                 result.lonaci_matches,
      lonaci_missing:                 result.lonaci_missing,
      pmu_heuristic_count:            result.pmu_heuristic_count,
      pmu_international_count:        result.pmu_international_count,
      pmu_international_by_criterion: result.pmu_international_by_criterion,
      errors_count:                   result.errors.length,
      duration_ms:                    result.duration_ms,
      dry_run:                        dryRun,
    });

    return NextResponse.json(
      { ok: result.errors.length === 0, ...result },
      { status: result.errors.length === 0 ? 200 : 500 },
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await cronLog.finish("failure", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
