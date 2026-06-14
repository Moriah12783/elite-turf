/**
 * POST /api/admin/sms-welcome-backfill   (auth : Bearer CRON_SECRET)
 *
 * One-off — renvoie le SMS de bienvenue aux inscrits dont le WELCOME avait
 * ÉCHOUÉ à cause du bug de normalisation (numéro local sans indicatif, corrigé
 * dans lib/sms-helpers le 14/06). Re-normalise pays-aware et met à jour la ligne
 * `sms_log` existante (pas de doublon).
 *
 * Sûr à relancer : seuls les WELCOME encore `FAILED` sont re-sélectionnés ; les
 * numéros irrécupérables (incomplets) restent FAILED. Respecte l'opt-out.
 *
 * ⚠️ TEMPORAIRE : à supprimer une fois le backfill effectué.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireBearerOnly } from "@/lib/auth/checkAdminAuth";
import { isTwilioConfigured, normalizeE164 } from "@/lib/sms-helpers";
import { sendSMS } from "@/lib/sms";
import { welcomeSmsBody } from "@/lib/sms-welcome";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authErr = requireBearerOnly(req);
  if (authErr) return authErr;

  if (!isTwilioConfigured()) {
    return NextResponse.json({ ok: false, reason: "twilio_not_configured" }, { status: 503 });
  }

  const supabase = createServiceClient();

  // 1. Tous les SMS de bienvenue encore en échec
  const { data: logs, error: logsErr } = await supabase
    .from("sms_log")
    .select("id, user_id")
    .eq("type", "WELCOME")
    .eq("status", "FAILED");

  if (logsErr) {
    return NextResponse.json({ ok: false, error: logsErr.message }, { status: 500 });
  }
  if (!logs || logs.length === 0) {
    return NextResponse.json({ ok: true, recovered: 0, stillFailed: 0, skipped: 0, details: [] });
  }

  // 2. Profils correspondants (numéro autoritatif + pays + opt-out + token)
  const ids = logs.map((l) => l.user_id);
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, phone, pays, sms_opt_in, sms_opted_out, sms_unsub_token")
    .in("id", ids);
  const byId = new Map((profs ?? []).map((p) => [p.id, p]));

  let recovered = 0, stillFailed = 0, skipped = 0;
  const details: Array<Record<string, unknown>> = [];

  for (const log of logs) {
    const p = byId.get(log.user_id);
    if (!p || p.sms_opt_in === false || p.sms_opted_out) {
      skipped++; details.push({ user_id: log.user_id, result: "skipped_optout" }); continue;
    }

    const phone = normalizeE164(p.phone || "", p.pays);
    if (!phone) {
      skipped++; details.push({ user_id: log.user_id, result: "no_phone" }); continue;
    }

    const res = await sendSMS(phone, welcomeSmsBody(p.sms_unsub_token || ""));
    await supabase
      .from("sms_log")
      .update({
        phone,
        status:     res.sid ? "SENT" : "FAILED",
        twilio_sid: res.sid ?? null,
        error:      res.error ?? null,
      })
      .eq("id", log.id);

    if (res.sid) {
      recovered++;
      details.push({ user_id: log.user_id, phone, result: "SENT" });
    } else {
      stillFailed++;
      details.push({ user_id: log.user_id, phone, result: "FAILED", error: res.error });
    }

    await new Promise((r) => setTimeout(r, 300)); // throttle léger
  }

  return NextResponse.json({ ok: true, recovered, stillFailed, skipped, details });
}
