/**
 * GET /api/cron/pmu-demain
 *
 * Cron Vercel : 18h00 UTC (19h Paris heure d'été) — chaque jour
 * Récupère le programme PMU du LENDEMAIN pour que les parieurs
 * puissent préparer leurs jeux 24h à l'avance.
 *
 * Schedule vercel.json : "0 18 * * *"
 */

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

/** Formate une date en YYYYMMDD */
function toDateStr(d: Date): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}${mo}${da}`;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logger = logCronStart("pmu-demain");

  try {
    // Calcul du lendemain
    const demain = new Date();
    demain.setDate(demain.getDate() + 1);
    const dateStr = toDateStr(demain);

    const res = await fetch(`${APP_URL}/api/pmu/sync`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({ date: dateStr }),
    });

    const data = await res.json();

    if (!res.ok) {
      await logger.finish("failure", { error: data?.error ?? `HTTP ${res.status}`, date: dateStr });
      return NextResponse.json({ error: data?.error }, { status: 500 });
    }

    await logger.finish("success", { ...data, targetDate: dateStr });
    return NextResponse.json({ ok: true, targetDate: dateStr, ...data });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    await logger.finish("failure", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
