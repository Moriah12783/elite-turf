/**
 * POST /api/admin/backfill-rapport-gagnant?days=90&dry=0&all=0
 *
 * Calcule et persiste le `rapport_gagnant` (€) pour les pronostics
 * GAGNANT / PARTIEL des N derniers jours dont l'arrivée a un `rapports_pmu`
 * rempli mais dont `pronostics.rapport_gagnant` est encore null.
 *
 * Cœur de logique partagé dans lib/pmu-backfill-rapport-gagnant.ts (même
 * fonction que le bouton admin /api/admin/dividendes/remplir).
 *
 * Déclenché par : le cron Cloudflare "40 22 * * *" (cron-worker) + appel curl
 * manuel. Auth : Bearer CRON_SECRET OU session admin (cookie).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";
import { runBackfillRapportGagnant } from "@/lib/pmu-backfill-rapport-gagnant";

export const dynamic     = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get("days") ?? "90", 10) || 90));
  const dry  = url.searchParams.get("dry") === "1";
  const includeAll = url.searchParams.get("all") === "1"; // si =1, ne skip pas ceux déjà remplis

  const supabase = createServiceClient();
  const result = await runBackfillRapportGagnant(supabase, { days, dry, includeAll });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok:         true,
    dry:        result.dry,
    days:       result.days,
    includeAll: result.includeAll,
    dateFrom:   result.dateFrom,
    summary:    result.summary,
    outcomes:   result.outcomes.slice(0, 50), // limite pour ne pas exploser la réponse
    timestamp:  new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
