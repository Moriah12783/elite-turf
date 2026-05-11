/**
 * POST /api/admin/seo-etl
 *
 * ETL one-shot pour peupler/rafraîchir les tables `chevaux`, `jockeys`,
 * `entraineurs` à partir de l'historique `partants` joint à `courses`.
 *
 * Auth : Bearer CRON_SECRET (cron daily) OR ADMIN session (one-shot navigateur).
 *
 * Body POST optionnel :
 *   { entites?: ["chevaux", "jockeys", "entraineurs"], dry_run?: bool }
 *
 * Aussi accessible en GET pour usage navigateur direct :
 *   ?entite=chevaux&dry_run=1
 *
 * Logique métier dans lib/sync/seo-etl.ts (partagée avec /api/cron/seo-etl).
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/observability/logger";
import { runSeoEtl, type EntiteType } from "@/lib/sync/seo-etl";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

async function runEndpoint(req: NextRequest): Promise<NextResponse> {
  // 🔒 Auth admin : Bearer CRON_SECRET OU session admin (cookie)
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  // ── Params ─────────────────────────────────────────────────────────
  let entites: EntiteType[] | undefined;
  let dryRun  = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (Array.isArray(body?.entites) && body.entites.length > 0) {
        entites = body.entites.filter((e: any): e is EntiteType =>
          e === "chevaux" || e === "jockeys" || e === "entraineurs",
        );
      }
      if (typeof body?.dry_run === "boolean") dryRun = body.dry_run;
    } catch {}
  } else {
    const url = new URL(req.url);
    if (url.searchParams.get("dry_run") === "1") dryRun = true;
    const e = url.searchParams.get("entite");
    if (e === "chevaux" || e === "jockeys" || e === "entraineurs") entites = [e];
  }

  try {
    const result = await runSeoEtl({ entites, dryRun });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("seo-etl", err, {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest)  { return runEndpoint(req); }
export async function POST(req: NextRequest) { return runEndpoint(req); }
