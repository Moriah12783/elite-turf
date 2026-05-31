/**
 * GET /api/cron/pmu-demain
 *
 * Charge le programme du LENDEMAIN (J+1) dans `courses` — préparation
 * "overnight" pour le pipeline IA du matin. Déclenché par le cron-worker
 * Cloudflare ("0 20 * * *").
 *
 * 🛡️ Fix self-fetch 522 (2026-05-31)
 *   Avant : `fetch(${APP_URL}/api/pmu/sync)`. Un Worker Cloudflare qui fetch
 *   son PROPRE custom domain = loop de routing rejetée INSTANTANÉMENT par
 *   Cloudflare ("error code: 522" en ~16ms) → échec déterministe chaque soir,
 *   le programme J+1 n'était jamais chargé (incident 31/05 : 0 course →
 *   0 preuve → 0 pronostic). Le parse défensif + retry "fix Cause A" évitaient
 *   le crash mais pas l'échec (la loop 522 est déterministe). On appelle
 *   désormais runGenyProgrammeSync("demain") EN PROCESS — le même chemin
 *   in-process que /api/admin/force-sync, le seul qui réussissait (d'où les
 *   logs "manual":true).
 *
 * Auth : aucune (comportement historique conservé — appelé par le cron-worker).
 */
import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";
import { runGenyProgrammeSync } from "@/lib/sync/geny-programme";
import { tomorrowParisISO } from "@/lib/paris-date";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  void req;
  const logger = logCronStart("pmu-demain");
  const targetDate = tomorrowParisISO();

  try {
    const result = await runGenyProgrammeSync("demain");
    await logger.finish("success", { ...result, targetDate });
    return NextResponse.json({ ...result, targetDate });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await logger.finish("failure", { error: msg, targetDate });
    return NextResponse.json({ error: msg, targetDate }, { status: 500 });
  }
}
