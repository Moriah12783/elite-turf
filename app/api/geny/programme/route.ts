/**
 * POST /api/geny/programme
 *
 * Scrape le programme PMU depuis Geny.com et sync dans Supabase.
 * Body JSON optionnel : { date: "YYYY-MM-DD" | "today" | "demain" }
 *
 * NOTE : la logique a été extraite dans lib/sync/geny-programme.ts pour
 * être appelable directement (sans fetch HTTP) depuis force-sync —
 * Cloudflare Workers interdisent aux Workers de fetch leur propre
 * custom domain (loop de routing → HTTP 522 instantané).
 */

import { NextRequest, NextResponse } from "next/server";
import { runGenyProgrammeSync } from "@/lib/sync/geny-programme";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawDate = body?.date || "today";
    const result = await runGenyProgrammeSync(rawDate);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[Geny Programme] Erreur:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || "today";
  return POST(new NextRequest(req.url, {
    method: "POST",
    body: JSON.stringify({ date }),
    headers: { "Content-Type": "application/json" },
  }));
}
