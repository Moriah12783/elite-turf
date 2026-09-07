/**
 * GET /api/cron/calibration-hebdo
 *
 * Cron hebdomadaire (lundi 09h40 UTC, après capture-arrivees-veille 08h30 et
 * l'auditeur Radar 09h20) : scelle la calibration de la semaine précédente
 * dans calibration_hebdo (write-once). Voir lib/calibration/sync-calibration.ts.
 *
 * Paramètre optionnel `?semaine=AAAA-MM-JJ` (un lundi) pour rattraper une
 * semaine manquante — jamais pour réécrire une semaine déjà scellée (la
 * contrainte unique l'interdit de toute façon).
 */

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";
import { runCalibrationSync } from "@/lib/calibration/sync-calibration";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronLog = logCronStart("calibration-hebdo");
  const semaine = req.nextUrl.searchParams.get("semaine") ?? undefined;

  try {
    const result = await runCalibrationSync({ semaine });
    await cronLog.finish(result.statut === "OK" ? "success" : "failure", { ...result });
    return NextResponse.json(result, { status: result.statut === "OK" ? 200 : 202 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await cronLog.finish("failure", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
