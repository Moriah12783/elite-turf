/**
 * GET /api/cron/ia-pronostics-v2
 *
 * Cron Multi-Agents IA — version 2 du système de génération automatique
 * des pronostics quotidiens (3 pronostics : Elite + Pro + Gratuit).
 *
 * ⚠️ Phase 1 — Fondations uniquement.
 * Cet endpoint EXISTE mais ne génère encore RIEN tant que les agents
 * worker ne sont pas implémentés (Phase 2). L'ancien cron `ia-pronostics`
 * (1 agent monolithique, 2 pronostics) reste actif en attendant.
 *
 * Quand Phase 2 + 3 seront terminées :
 *   1. Activer ce cron dans wrangler/cron-triggers à 4h00 Paris (02h UTC)
 *   2. Désactiver l'ancien cron `ia-pronostics`
 *   3. Stéphane reçoit Slack notif "3 pronostics à valider"
 *   4. Il review/édite/publie depuis /admin/pronostics/bulk
 *
 * Auth : Bearer CRON_SECRET (script automatisé)
 *
 * Query params :
 *   - dry_run=1  → simule sans INSERT en BDD (debug)
 *   - date=YYYY-MM-DD → cible une date différente (défaut = aujourd'hui Paris)
 */

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";
import { runDirector } from "@/lib/ai-pronostics/director";
import { requireBearerOnly } from "@/lib/auth/checkAdminAuth";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // 🔒 Auth — Bearer uniquement (pas de session admin, c'est un cron)
  const authError = requireBearerOnly(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const dateParam = url.searchParams.get("date");

  const cronLog = logCronStart("ia-pronostics-v2");

  try {
    const result = await runDirector({
      date:   dateParam ?? undefined,
      dryRun,
    });

    await cronLog.finish(result.ok ? "success" : "failure", {
      date:                  result.date,
      drafts_saved:          result.drafts_saved,
      drafts_blocked:        result.drafts_blocked,
      drafts_needs_review:   result.drafts_needs_review,
      errors_count:          result.errors.length,
      duration_ms:           result.duration_ms,
      tokens:                result.tokens_used,
      dry_run:               dryRun,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await cronLog.finish("failure", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
