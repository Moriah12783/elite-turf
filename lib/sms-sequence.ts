/**
 * lib/sms-sequence.ts
 *
 * Séquence SMS de nurturing (post-inscription), envoyée par le cron
 * /api/cron/sms-sequence :
 *   - J2 « preuve »   : N pronostics gagnants sur 14j → /performances
 *   - J5 « upgrade »  : pont vers le Pack Starter      → /abonnements
 *
 * Chaque SMS est GSM-7 strict (1 segment) et porte le lien de désinscription
 * 1-clic /stop?t=<token>. Idempotence garantie par UNIQUE(user_id, type) sur
 * `sms_log`. Best-effort : ne throw jamais.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { sendSMS } from "@/lib/sms";
import { normalizeE164, stopLink, SMS_HOST } from "@/lib/sms-helpers";

/** J2 — preuve par les chiffres RÉELS (nbGagnants vient de computeRecentPerf). */
export function smsJ2Body(token: string, nbGagnants: number): string {
  return (
    `ELITE TURF: ${nbGagnants} pronostics gagnants en 14 jours. ` +
    `Bilan verifiable en clair: ${SMS_HOST}/performances Stop: ${stopLink(token)}`
  );
}

/** J5 — conversion vers l'offre payante. */
export function smsJ5Body(token: string): string {
  return (
    `ELITE TURF: l analyse experte (base, appuis, mises) avec le Pack Starter 7j: ` +
    `${SMS_HOST}/abonnements Stop: ${stopLink(token)}`
  );
}

/**
 * Envoie un SMS de séquence à un profil déjà sélectionné par le cron.
 * Insère le log PENDING AVANT l'envoi (idempotence), puis met à jour le statut.
 */
export async function sendSequenceSms(params: {
  profileId: string;
  phone: string;
  type: string;   // 'SEQUENCE_J2' | 'SEQUENCE_J5'
  body: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const phone = normalizeE164(params.phone);
  if (!phone) return { ok: false, skipped: true };

  const supabase = createServiceClient();

  const { data: logRow, error: logErr } = await supabase
    .from("sms_log")
    .insert({ user_id: params.profileId, phone, type: params.type, status: "PENDING" })
    .select("id")
    .single();

  if (logErr || !logRow) return { ok: false, skipped: true }; // conflit = déjà envoyé

  const r = await sendSMS(phone, params.body);
  await supabase
    .from("sms_log")
    .update({
      status:     r.sid ? "SENT" : "FAILED",
      twilio_sid: r.sid ?? null,
      error:      r.error ?? null,
    })
    .eq("id", logRow.id);

  return { ok: !!r.sid, error: r.error };
}
