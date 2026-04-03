// GET /api/cron/geny-arrivees
// Cron Vercel : toutes les 15 min de 13h00 à 19h00 UTC
// vercel.json schedule : "*/15 13-19 * * *"

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Vérifier l'heure UTC : seulement entre 13h et 19h
  const hour = new Date().getUTCHours();
  if (hour < 13 || hour > 19) {
    return NextResponse.json({ ok: true, skipped: true, reason: `Hors plage horaire (${hour}h UTC)` });
  }

  const logger = logCronStart("geny-arrivees");

  try {
    const res = await fetch(`${APP_URL}/api/geny/arrivees`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${CRON_SECRET}`,
      },
    });
    const data = await res.json();

    if (!res.ok) {
      await logger.finish("failure", { error: data?.error ?? `HTTP ${res.status}` });
      return NextResponse.json({ error: data?.error }, { status: 500 });
    }

    await logger.finish("success", data);
    return NextResponse.json({ ok: true, ...data });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    await logger.finish("failure", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
