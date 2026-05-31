/**
 * GET /api/cron/ia-auto-publish-v2
 *
 * Filet de sécurité de publication AUTONOME (serveur — Cloudflare Cron).
 *
 * RAISON D'ÊTRE
 *   Publie les brouillons IA du jour (`ai_pronostic_drafts`) les jours où
 *   l'admin est indisponible. Tourne 100% côté serveur, SANS Claude connecté
 *   (remplace l'ancienne tâche Claude locale `elite-turf-auto-publish`,
 *   désactivée le 2026-05-31).
 *
 * RÈGLE "JOUR ENTIER" (décision PO 2026-05-31)
 *   Si l'admin a DÉJÀ publié quoi que ce soit aujourd'hui → on ne republie
 *   RIEN (anti-doublon). Garde-fous :
 *
 *     GUARD A — un brouillon du jour a human_review.decision='PUBLISHED'
 *               (l'admin a validé via /admin/pronostics/ai-review) → SKIP.
 *     GUARD B — une publication PREMIUM manuelle/non-IA existe pour le jour
 *               (pronostics.publie=true, niveau PRO/ELITE, source<>'AI-MULTI-AGENT')
 *               → SKIP. (Le prono GRATUIT auto quotidien est ignoré : il est
 *               automatisé par /api/cron/pronostic-gratuit, pas "manuel".)
 *
 *   Sinon → promeut chaque brouillon PENDING non-REJECTED du jour en
 *   réutilisant la route admin existante POST /api/admin/ai-review/:id/publish
 *   (logique IDENTIQUE à la validation humaine, source='AI-MULTI-AGENT').
 *
 * IDEMPOTENT : un 2e passage retrouve les brouillons en 'PUBLISHED' (GUARD A)
 *              → SKIP. Aucune double publication possible.
 *
 * 🔐 Auth : Bearer CRON_SECRET (requireBearerOnly).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireBearerOnly } from "@/lib/auth/checkAdminAuth";
import { logCronStart } from "@/lib/cron-logger";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET || "";

type DraftRow = {
  id: string;
  access_level: string;
  course_id: string;
  status: string;
  human_review: { decision?: string } | null;
};

export async function GET(req: NextRequest) {
  // 🔒 Auth — Bearer uniquement (cron automatisé)
  const authError = requireBearerOnly(req);
  if (authError) return authError;

  const logger   = logCronStart("ia-auto-publish-v2");
  const supabase = createServiceClient();
  const today    = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).split(" ")[0];

  try {
    // ── 1. Brouillons IA du jour ──────────────────────────────────────────
    const { data: draftsRaw, error: draftsErr } = await supabase
      .from("ai_pronostic_drafts")
      .select("id, access_level, course_id, status, human_review")
      .eq("draft_date", today);

    if (draftsErr) throw new Error(`Lecture ai_pronostic_drafts: ${draftsErr.message}`);
    const drafts = (draftsRaw ?? []) as DraftRow[];

    // ── GUARD A — l'admin a déjà validé un brouillon aujourd'hui ──────────
    const adminPublishedADraft = drafts.some(
      (d) => d.human_review?.decision === "PUBLISHED",
    );
    if (adminPublishedADraft) {
      await logger.finish("skip", { reason: "admin_already_published_draft", date: today });
      return NextResponse.json({
        ok: true, skipped: true, reason: "admin_already_published", date: today,
      });
    }

    // ── GUARD B — publication PREMIUM manuelle/non-IA déjà présente ───────
    // On ignore le niveau GRATUIT (automatisé par /api/cron/pronostic-gratuit)
    // et les lignes source='AI-MULTI-AGENT' (publiées par ce filet ou la
    // review admin — déjà couvertes par GUARD A).
    const { data: pubsRaw, error: pubErr } = await supabase
      .from("pronostics")
      .select("id, source, niveau_acces, courses!inner(date_course)")
      .eq("publie", true)
      .eq("courses.date_course", today);

    if (pubErr) throw new Error(`Lecture pronostics publiés: ${pubErr.message}`);

    const manualPremiumPubs = (pubsRaw ?? []).filter((p) => {
      const niveau = (p as { niveau_acces?: string }).niveau_acces;
      const source = (p as { source?: string | null }).source;
      return source !== "AI-MULTI-AGENT" && (niveau === "PRO" || niveau === "ELITE");
    });

    if (manualPremiumPubs.length > 0) {
      await logger.finish("skip", {
        reason: "manual_premium_publication_exists", date: today, count: manualPremiumPubs.length,
      });
      return NextResponse.json({
        ok: true, skipped: true, reason: "manual_publication_exists", date: today,
      });
    }

    // ── 2. Brouillons publiables (PENDING, non rejetés) ───────────────────
    const publishable = drafts.filter(
      (d) => d.status !== "REJECTED" && (d.human_review?.decision ?? "PENDING") === "PENDING",
    );

    if (publishable.length === 0) {
      await logger.finish("skip", {
        reason: "no_pending_drafts", date: today, drafts_total: drafts.length,
      });
      return NextResponse.json({
        ok: true, skipped: true, reason: "no_pending_drafts", date: today, drafts_total: drafts.length,
      });
    }

    // ── 3. Promotion via la route admin existante (logique = publish humain)
    const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || "https://www.elite-turf.fr";
    const results: Array<{ draft_id: string; ok: boolean; status: number; detail?: string }> = [];

    for (const draft of publishable) {
      try {
        const res = await fetch(`${origin}/api/admin/ai-review/${draft.id}/publish`, {
          method:  "POST",
          headers: {
            "Authorization": `Bearer ${CRON_SECRET}`,
            "Content-Type":  "application/json",
          },
          body: JSON.stringify({
            human_comment: "Publication automatique (filet de sécurité — admin indisponible)",
          }),
        });
        const detail = res.ok ? undefined : (await res.text().catch(() => "")).slice(0, 200);
        results.push({ draft_id: draft.id, ok: res.ok, status: res.status, detail });
      } catch (e) {
        results.push({
          draft_id: draft.id, ok: false, status: 0,
          detail: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const published = results.filter((r) => r.ok).length;
    const failed    = results.length - published;
    const stats     = { date: today, auto_published: published, failed, drafts_total: drafts.length, results };

    await logger.finish(failed === 0 ? "success" : "failure", stats);
    return NextResponse.json({ ok: failed === 0, ...stats });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ia-auto-publish-v2] Erreur:", msg);
    await logger.finish("failure", { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
