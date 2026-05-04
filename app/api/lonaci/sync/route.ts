/**
 * POST /api/lonaci/sync  (v2)
 *
 * Synchronise le programme LONACI du jour dans Supabase.
 * Logique extraite dans lib/sync/lonaci.ts pour appel direct depuis force-sync
 * (Cloudflare Workers interdisent le self-fetch sur custom domain → HTTP 522).
 */

import { NextRequest, NextResponse } from "next/server";
import { runLonaciSync } from "@/lib/sync/lonaci";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  try {
    const result = await runLonaciSync();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[LONACI Sync] Erreur :", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "LONACI Sync endpoint actif" });
}
