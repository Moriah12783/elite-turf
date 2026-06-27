/**
 * GET /api/cron/lead-sequence
 *
 * Drip de bienvenue pour les LEADS (téléchargeurs du guide gratuit, table `leads`).
 * J0 = email du guide (déjà envoyé à la capture, app/api/guide/telechargement).
 * Ce cron ajoute :
 *   - J+2 (48-72 h) : email « passez à la pratique »      → LEAD_UPGRADE_J2
 *   - J+5 (120-144 h) : email « transparence / anti-arnaque » → LEAD_PROOF_J5
 *
 * Idempotence : email_sent_log UNIQUE(email, type) — les leads n'ont pas de
 * user_id (insert sans user_id → l'unicité par email+type s'applique).
 * Skip les leads désabonnés (leads.unsubscribed_at).
 *
 * Miroir de app/api/cron/welcome-emails (qui cible les profils inscrits).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmailDetailed, DEFAULT_BULK_RATE_PER_SECOND, APP_URL } from "@/lib/email";
import { logCronStart } from "@/lib/cron-logger";
import { logger } from "@/lib/observability/logger";
import { templateLeadUpgradeJ2 } from "@/lib/email/templates/lead-upgrade-j2";
import { templateLeadProofJ5 } from "@/lib/email/templates/lead-proof-j5";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

type LeadEmailType = "LEAD_UPGRADE_J2" | "LEAD_PROOF_J5";

interface Lead {
  id:         string;
  email:      string;
  prenom:     string | null;
  created_at: string;
}

const STEPS: Array<{
  type:     LeadEmailType;
  minHours: number;
  maxHours: number;
  render:   (lead: Lead, unsubscribeUrl: string) => { subject: string; html: string };
}> = [
  {
    type:     "LEAD_UPGRADE_J2",
    minHours: 48,
    maxHours: 72,
    render:   (l, u) => templateLeadUpgradeJ2({ prenom: l.prenom || "Turfiste", unsubscribeUrl: u }),
  },
  {
    type:     "LEAD_PROOF_J5",
    minHours: 120,
    maxHours: 144,
    render:   (l, u) => templateLeadProofJ5({ prenom: l.prenom || "Turfiste", unsubscribeUrl: u }),
  },
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronLog = logCronStart("lead-sequence");
  const supabase = createServiceClient();
  const stats = { processed: 0, sent: 0, failed: 0, skipped: 0 };
  const now = Date.now();

  try {
    // Fenêtre globale couvrant J2 (48-72 h) et J5 (120-144 h) + marge.
    const minDate = new Date(now - 150 * 3600 * 1000).toISOString();
    const maxDate = new Date(now - 47 * 3600 * 1000).toISOString();

    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, email, prenom, created_at")
      .gte("created_at", minDate)
      .lte("created_at", maxDate)
      .is("unsubscribed_at", null)
      .not("email", "is", null);

    if (error) {
      await cronLog.finish("failure", { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = (leads ?? []) as Lead[];

    for (const lead of list) {
      stats.processed++;
      const to = (lead.email || "").trim().toLowerCase();
      if (!to) continue;

      const ageHours = (now - new Date(lead.created_at).getTime()) / 3600000;
      const step = STEPS.find((s) => ageHours >= s.minHours && ageHours < s.maxHours);
      if (!step) {
        stats.skipped++;
        continue;
      }

      // Idempotence : on n'envoie jamais 2× le même type au même email.
      // On ne loggue QUE les envois réussis → un échec transitoire (rate-limit,
      // 5xx Resend) est ré-essayé au passage suivant tant que la fenêtre de
      // l'étape est ouverte (≈24 h). NB : ne pas déclencher ce cron en
      // concurrence avec lui-même (check→envoi non atomique → double envoi).
      const { data: existing } = await supabase
        .from("email_sent_log")
        .select("id")
        .eq("email", to)
        .eq("type", step.type)
        .maybeSingle();
      if (existing) {
        stats.skipped++;
        continue;
      }

      const unsubscribeUrl = `${APP_URL}/api/leads/desabonnement?id=${lead.id}`;
      const { subject, html } = step.render(lead, unsubscribeUrl);
      const sendRes = await sendEmailDetailed({ to, subject, html });

      if (sendRes.ok) {
        stats.sent++;
        const { error: logErr } = await supabase.from("email_sent_log").insert({
          email:  to,
          type:   step.type,
          status: "SENT",
        });
        if (logErr) logger.warn("lead-sequence", `Insert log failed: ${logErr.message}`, { email: to });
      } else {
        // Pas de ligne email_sent_log → ré-essai au prochain passage dans la fenêtre.
        stats.failed++;
        logger.error("lead-sequence", `Send failed: ${sendRes.error}`, { email: to, type: step.type });
      }

      // Throttle Resend (5/sec par défaut).
      await new Promise((r) => setTimeout(r, Math.ceil(1000 / DEFAULT_BULK_RATE_PER_SECOND)));
    }

    await cronLog.finish(stats.failed > 0 ? "failure" : "success", stats);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("lead-sequence", err, {});
    await cronLog.finish("failure", { error: msg, ...stats });
    return NextResponse.json({ error: msg, ...stats }, { status: 500 });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
