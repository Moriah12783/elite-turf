/**
 * GET /api/cron/ia-pronostics-v2
 *
 * Cron Multi-Agents IA — version 2 du système de génération automatique
 * des pronostics quotidiens (Elite + Pro + Starter + Gratuit).
 *
 * 🚨 RÔLE
 *   Déclenche le pipeline complet de génération de drafts IA. Les drafts
 *   produits sont stockés dans `public.ai_pronostic_drafts` avec
 *   human_review.decision = "PENDING" — Stéphane les valide depuis
 *   /admin/pronostics/ai-review avant publication.
 *
 *   AUCUNE publication automatique dans la table `pronostics`.
 *
 * 🕐 DÉCLENCHEMENT
 *   - Cloudflare Cron (à activer dans wrangler.toml — voir [triggers])
 *   - Vercel Cron alternativement
 *   - Appel manuel pour test/admin
 *
 *   Le pipeline lui-même contrôle qu'on est bien dans la fenêtre 4h Paris
 *   (cf cahier §15.2) — si l'heure ne correspond pas, le pipeline tourne
 *   quand même (cron Vercel ≠ Cloudflare scheduled event).
 *
 * 🔐 AUTH
 *   Bearer CRON_SECRET (script automatisé / cron).
 *
 * 📊 QUERY PARAMS
 *   - dry_run=1            → simule sans INSERT en BDD (debug)
 *   - date=YYYY-MM-DD      → cible une date différente (défaut = Paris today)
 *   - only_levels=ELITE,PRO → génère uniquement certains niveaux (debug)
 *
 * 📜 Conforme cahier des charges §14 + §15.
 */

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";
import { runDirector } from "@/lib/ai-pronostics/director";
import { requireBearerOnly } from "@/lib/auth/checkAdminAuth";
import type { NiveauAcces } from "@/lib/ai-pronostics/types";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;   // pipeline complet : ~30-45s en moyenne

const VALID_LEVELS: NiveauAcces[] = ["FREE", "STARTER", "PRO", "ELITE"];

function parseOnlyLevels(raw: string | null): NiveauAcces[] | undefined {
  if (!raw) return undefined;
  const parts = raw.split(",").map((p) => p.trim().toUpperCase());
  const filtered = parts.filter((p): p is NiveauAcces =>
    (VALID_LEVELS as readonly string[]).includes(p),
  );
  return filtered.length > 0 ? filtered : undefined;
}

export async function GET(req: NextRequest) {
  // 🔒 Auth — Bearer uniquement (pas de session admin, c'est un cron)
  const authError = requireBearerOnly(req);
  if (authError) return authError;

  const url        = new URL(req.url);
  const dryRun     = url.searchParams.get("dry_run") === "1";
  const dateParam  = url.searchParams.get("date");
  const onlyLevels = parseOnlyLevels(url.searchParams.get("only_levels"));

  const cronLog = logCronStart("ia-pronostics-v2");

  try {
    const result = await runDirector({
      date:       dateParam ?? undefined,
      dryRun,
      onlyLevels,
    });

    const status = result.errors.length === 0 && (result.drafts_saved > 0 || result.drafts_needs_review > 0)
      ? "success"
      : result.errors.length === 0
        ? "skip"     // aucun draft mais pas d'erreur (cas "0 course validée Afrique")
        : "failure";

    await cronLog.finish(status, {
      date:                  result.date,
      drafts_saved:          result.drafts_saved,
      drafts_blocked:        result.drafts_blocked,
      drafts_needs_review:   result.drafts_needs_review,
      errors_count:          result.errors.length,
      duration_ms:           result.duration_ms,
      tokens:                result.tokens_used,
      dry_run:               dryRun,
      notification_message:  result.notification?.message,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await cronLog.finish("failure", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
