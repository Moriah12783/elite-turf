// GET /api/cron/pmu-sync
//
// Synchronise le programme du JOUR dans Supabase, AVANT le pipeline IA du matin
// (source-evidence-collector 06:15 + ia-pronostics-v2 06:45). Déclenché par le
// cron-worker Cloudflare ("10 5 * * *").
//
// 🛡️ Fix self-fetch 522 (2026-05-31)
//   Avant : `fetch(${APP_URL}/api/pmu/sync)`. Un Worker Cloudflare qui fetch
//   son PROPRE custom domain = loop de routing rejetée INSTANTANÉMENT par
//   Cloudflare ("error code: 522" en ~16ms) → échec déterministe chaque matin,
//   0 course chargée. Le parse défensif "fix Cause A" évitait le crash mais
//   pas l'échec. On appelle désormais runGenyProgrammeSync() EN PROCESS — le
//   même chemin in-process que /api/admin/force-sync, le seul qui réussissait
//   (d'où les logs "manual":true).
//
// Auth : Authorization: Bearer CRON_SECRET

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";
import { requireBearerOnly } from "@/lib/auth/checkAdminAuth";
import { runGenyProgrammeSync } from "@/lib/sync/geny-programme";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const authError = requireBearerOnly(req);
  if (authError) return authError;

  const logger = logCronStart("pmu-sync");

  try {
    const result = await runGenyProgrammeSync("today");
    await logger.finish("success", { ...result });
    return NextResponse.json({ ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await logger.finish("failure", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
