// GET /api/cron/geny-arrivees
// Cron Vercel : toutes les 15 min de 13h00 à 19h00 UTC
// vercel.json schedule : "*/15 13-19 * * *"

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.vercel.app";

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

  try {
    const res = await fetch(`${APP_URL}/api/geny/arrivees`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${CRON_SECRET}`,
      },
    });
    const data = await res.json();
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
