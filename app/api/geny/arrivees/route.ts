/**
 * GET/POST /api/geny/arrivees?date=YYYY-MM-DD
 *
 * Scrape les arrivées depuis Geny.com et les stocke dans Supabase.
 * Logique extraite dans lib/sync/geny-arrivees.ts pour appel direct
 * depuis force-sync (évite Cloudflare self-fetch loop).
 */

import { NextRequest, NextResponse } from "next/server";
import { runGenyArriveesSync } from "@/lib/sync/geny-arrivees";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dateISO = body?.date || undefined;
    const result = await runGenyArriveesSync(dateISO);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url  = new URL(req.url);
    const date = url.searchParams.get("date") || undefined;
    const result = await runGenyArriveesSync(date);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
