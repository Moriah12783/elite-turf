// GET /api/cron/pmu-sync
//
// Cron job Vercel — déclenché automatiquement selon vercel.json :
//   - 06:00 Europe/Paris (05:00 UTC) = synchronisation du programme du jour
//   - 06:30, 07:00, 07:30 = rafraîchissements supplémentaires
//
// Header Vercel : Authorization: Bearer CRON_SECRET

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.vercel.app";

export async function GET(req: NextRequest) {
  // Vercel cron envoie le secret dans l'header Authorization
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${APP_URL}/api/pmu/sync`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({}),
    });

    const data = await res.json();
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
