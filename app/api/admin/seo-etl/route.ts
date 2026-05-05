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
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { runSeoEtl, type EntiteType } from "@/lib/sync/seo-etl";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

async function runEndpoint(req: NextRequest): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────
  const auth = req.headers.get("authorization") || "";
  const hasCronAuth = CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;

  if (!hasCronAuth) {
    const adminClient    = createServiceClient();
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const { data: profile } = await adminClient
      .from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

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
