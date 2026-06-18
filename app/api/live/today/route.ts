/**
 * GET /api/live/today
 *
 * Payload « Le Direct » du jour (courses + bilan de nos pronostics), rappelé
 * par le composant client toutes les ~60 s pendant la fenêtre courses.
 * Réutilise exactement la logique du rendu SSR (lib/live/today).
 */

import { NextResponse } from "next/server";
import { buildLivePayload } from "@/lib/live/today";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await buildLivePayload();
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e) {
    console.error("[live/today]", (e as Error)?.message);
    return NextResponse.json({ error: "Live indisponible." }, { status: 500 });
  }
}
