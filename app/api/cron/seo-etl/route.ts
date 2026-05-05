/**
 * GET /api/cron/seo-etl
 *
 * Cron quotidien (3h45 UTC = après tous les arrivees du jour) qui rafraîchit
 * les tables chevaux/jockeys/entraineurs depuis l'historique partants.
 *
 * Appel direct à runSeoEtl (pas de self-fetch HTTP — Cloudflare Workers
 * timeout 522 sur self-fetch loops).
 */

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";
import { runSeoEtl } from "@/lib/sync/seo-etl";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronLog = logCronStart("seo-etl");

  try {
    const result = await runSeoEtl();
    await cronLog.finish("success", result);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await cronLog.finish("failure", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
