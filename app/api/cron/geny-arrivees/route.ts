/**
 * GET /api/cron/geny-arrivees
 *
 * Cron Vercel : déclenché toutes les heures de 13h00 à 19h00 UTC pour
 * scraper progressivement les arrivées du jour au fur et à mesure que
 * les courses se terminent.
 *
 * Refactor 2026-05-05 : appel direct à `runGenyArriveesSync` au lieu d'un
 * self-fetch HTTP vers /api/geny/arrivees. Le self-fetch causait des
 * timeouts HTTP 522 sur Cloudflare Workers (auto-loop).
 */

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";
import { runGenyArriveesSync } from "@/lib/sync/geny-arrivees";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Skipper en dehors de la fenêtre 13h-19h UTC (heures où les courses tombent)
  const hour = new Date().getUTCHours();
  if (hour < 13 || hour > 19) {
    return NextResponse.json({
      ok:      true,
      skipped: true,
      reason:  `Hors plage horaire (${hour}h UTC, fenêtre cible 13-19h)`,
    });
  }

  const cronLog = logCronStart("geny-arrivees");

  try {
    const result = await runGenyArriveesSync();
    const status = result.scraped === 0 && result.not_found > 5
      ? "skip"   // probablement courses pas encore terminées, pas un bug
      : "success";
    await cronLog.finish(status, { ...result });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    await cronLog.finish("failure", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
