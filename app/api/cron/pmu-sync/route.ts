// GET /api/cron/pmu-sync
//
// Cron job Vercel — déclenché automatiquement selon vercel.json :
//   - 06:00 Europe/Paris (05:00 UTC) = synchronisation du programme du jour
//   - 06:30, 07:00, 07:30 = rafraîchissements supplémentaires
//
// Header Vercel : Authorization: Bearer CRON_SECRET

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || "https://www.elite-turf.fr";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logger = logCronStart("pmu-sync");

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
