/**
 * GET /api/cron/sms-sequence
 *
 * Cron quotidien qui orchestre la séquence SMS de nurturing post-inscription :
 *   - J2 « preuve »  : N pronostics gagnants sur 14j → /performances
 *   - J5 « upgrade » : pont vers le Pack Starter      → /abonnements
 *
 * Cible : inscrits récents NON-abonnés (GRATUIT/EXPIRE), opt-in SMS, non
 * désinscrits, avec numéro. Idempotence via sms_log UNIQUE(user_id, type).
 * → La séquence ne touche QUE les inscrits récents (fenêtre date_inscription),
 *   donc aucun blast des anciens profils / numéros backfillés.
 *
 * Fenêtres (larges, ≥24h, pour qu'un cron quotidien attrape chaque profil une
 * fois sans trou — l'idempotence couvre les recouvrements) :
 *   - J2 : compte créé il y a 47h–73h
 *   - J5 : compte créé il y a 119h–145h
 *
 * Feature OFF tant que Twilio n'est pas configuré.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isTwilioConfigured } from "@/lib/sms-helpers";
import { smsJ2Body, smsJ5Body, sendSequenceSms } from "@/lib/sms-sequence";
import { computeRecentPerf } from "@/lib/stats/recent-perf";
import { logCronStart } from "@/lib/cron-logger";
import { logger } from "@/lib/observability/logger";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

type SeqType = "SEQUENCE_J2" | "SEQUENCE_J5";

interface Prof {
  id:               string;
  phone:            string | null;
  pays:             string | null;
  sms_unsub_token:  string | null;
  date_inscription: string;
}

const STEPS: Array<{ type: SeqType; minHours: number; maxHours: number }> = [
  { type: "SEQUENCE_J2", minHours: 47,  maxHours: 73  },
  { type: "SEQUENCE_J5", minHours: 119, maxHours: 145 },
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Feature OFF tant que Twilio n'est pas configuré.
  if (!isTwilioConfigured()) {
    return NextResponse.json({ ok: true, skipped: "twilio_not_configured" });
  }

  const cronLog  = logCronStart("sms-sequence");
  const supabase = createServiceClient();
  const stats    = { processed: 0, sent: 0, failed: 0, skipped: 0 };
  const now      = Date.now();

  try {
    // ── Preuve (J2) : pronostics gagnants RÉELS sur 14 jours ──────────────
    const since14 = new Date(now - 14 * 24 * 3600 * 1000).toISOString();
    const { data: perfRows } = await supabase
      .from("pronostics")
      .select("resultat, gains_theoriques, rapport_gagnant")
      .eq("publie", true)
      .neq("resultat", "EN_ATTENTE")
      .gte("date_publication", since14)
      .limit(300);
    const nbGagnants = computeRecentPerf(perfRows ?? []).gagnants;

    // ── Inscrits récents, gratuits, opt-in, non désinscrits, avec numéro ──
    const minDate = new Date(now - 146 * 3600 * 1000).toISOString();
    const maxDate = new Date(now -  46 * 3600 * 1000).toISOString();

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, phone, pays, sms_unsub_token, date_inscription")
      .gte("date_inscription", minDate)
      .lte("date_inscription", maxDate)
      .in("statut_abonnement", ["GRATUIT", "EXPIRE"])
      .eq("sms_opt_in", true)
      .eq("sms_opted_out", false)
      .not("phone", "is", null);

    if (error) {
      await cronLog.finish("failure", { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = (profiles ?? []) as Prof[];

    for (const p of list) {
      stats.processed++;
      const phone = (p.phone || "").trim();
      const token = p.sms_unsub_token || "";
      if (!phone || !token) { stats.skipped++; continue; }

      const ageHours = (now - new Date(p.date_inscription).getTime()) / 3600000;
      const step = STEPS.find((s) => ageHours >= s.minHours && ageHours < s.maxHours);
      if (!step) { stats.skipped++; continue; }

      // J2 sans preuve à montrer → on n'envoie pas de message creux.
      if (step.type === "SEQUENCE_J2" && nbGagnants < 1) { stats.skipped++; continue; }

      // Idempotence : déjà envoyé ce type ?
      const { data: existing } = await supabase
        .from("sms_log")
        .select("id")
        .eq("user_id", p.id)
        .eq("type", step.type)
        .maybeSingle();
      if (existing) { stats.skipped++; continue; }

      const body = step.type === "SEQUENCE_J2"
        ? smsJ2Body(token, nbGagnants)
        : smsJ5Body(token);

      const res = await sendSequenceSms({ profileId: p.id, phone, pays: p.pays, type: step.type, body });
      if (res.ok) {
        stats.sent++;
      } else if (res.skipped) {
        stats.skipped++;
      } else {
        stats.failed++;
        logger.error("sms-sequence", `Send failed: ${res.error}`, { user_id: p.id, type: step.type });
      }

      await new Promise((r) => setTimeout(r, 250)); // throttle léger
    }

    await cronLog.finish(stats.failed > 0 ? "failure" : "success", { ...stats, nbGagnants });
    return NextResponse.json({ ok: true, ...stats, nbGagnants });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("sms-sequence", err, {});
    await cronLog.finish("failure", { error: msg, ...stats });
    return NextResponse.json({ error: msg, ...stats }, { status: 500 });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
