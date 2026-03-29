// GET /api/cron/lonaci-sync
//
// Cron job Vercel — déclenché automatiquement chaque matin à 6h30 UTC.
// Lance le sync LONACI pour récupérer les courses du jour disponibles
// pour les parieurs africains (LONACI-CI, LONASE-SN, PMU-MA…)
//
// Header Vercel : Authorization: Bearer CRON_SECRET

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.vercel.app";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${APP_URL}/api/lonaci/sync`, {
      method:  "POST",
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
