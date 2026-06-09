/**
 * lib/sms-welcome.ts
 *
 * SMS de bienvenue (J0) + template, appelé par /api/welcome-email.
 * Réutilise le client Twilio existant `sendSMS` de lib/sms.ts.
 *
 * Garde-fous :
 *   - Destinataire = le `phone` du PROFIL (lu en base par email), JAMAIS un
 *     numéro fourni par le client → empêche d'envoyer à un numéro arbitraire.
 *   - Feature OFF si Twilio non configuré (aucune ligne sms_log créée).
 *   - Idempotence : UNIQUE(user_id, type) sur `sms_log` → 1 SMS de bienvenue max.
 *   - Respecte l'opt-out (`profiles.sms_opted_out`) et l'opt-in du formulaire.
 *   - Best-effort : ne throw jamais (n'impacte pas l'inscription).
 */

import { createServiceClient } from "@/lib/supabase/server";
import { sendSMS } from "@/lib/sms";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

/** true si Twilio est configuré (SID + token + un expéditeur). */
function isTwilioConfigured(): boolean {
  return (
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!process.env.TWILIO_AUTH_TOKEN &&
    (!!process.env.TWILIO_MESSAGING_SERVICE_SID || !!process.env.TWILIO_PHONE_NUMBER)
  );
}

/** Normalise un numéro en E.164 sans espaces ("+225 07 00…" → "+2250700…"). */
function normalizeE164(input: string): string {
  const s = (input || "").trim().replace(/[\s().\-]/g, "");
  if (!s) return "";
  if (s.startsWith("+")) return "+" + s.slice(1).replace(/\D/g, "");
  const digits = s.replace(/\D/g, "");
  return digits ? "+" + digits : "";
}

/**
 * Corps du SMS de bienvenue. GSM-7 strict (PAS d'accents/emoji) pour rester
 * 1 segment. Pousse vers "Notre Sélection" gratuite (hameçon top-of-funnel).
 */
export function welcomeSmsBody(): string {
  const link = APP_URL.replace(/^https?:\/\//, "").replace(/\/$/, "") + "/programme";
  return (
    `ELITE TURF: bienvenue ! Profitez de NOTRE SELECTION gratuite pour ` +
    `structurer vos paris du jour: ${link} STOP pour ne plus etre contacte.`
  );
}

export async function sendWelcomeSms(params: {
  email: string;
  /** Choix de la case "recevoir par SMS" du formulaire (pré-cochée → true). */
  smsOptIn?: boolean;
}): Promise<void> {
  // Feature OFF tant que Twilio n'est pas configuré : on ne touche à rien.
  if (!isTwilioConfigured()) return;

  try {
    const supabase = createServiceClient();

    // 1. Profil (numéro autoritatif + état opt-out)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, phone, sms_opted_out")
      .eq("email", params.email)
      .single();

    if (!profile) return;
    const phone = normalizeE164(profile.phone || "");
    if (!phone) return;                  // pas de numéro → rien (numéro optionnel)
    if (profile.sms_opted_out) return;   // a déjà fait STOP

    // 2. Mémoriser le choix d'opt-in (future séquence / WhatsApp)
    if (typeof params.smsOptIn === "boolean") {
      await supabase
        .from("profiles")
        .update({ sms_opt_in: params.smsOptIn })
        .eq("id", profile.id);
    }
    if (params.smsOptIn === false) return; // a décoché → on ne l'envoie pas

    // 3. Idempotence : insertion du log AVANT envoi (UNIQUE user_id+type)
    const { data: logRow, error: logErr } = await supabase
      .from("sms_log")
      .insert({ user_id: profile.id, phone, type: "WELCOME", status: "PENDING" })
      .select("id")
      .single();

    if (logErr || !logRow) return;       // conflit = déjà envoyé → skip

    // 4. Envoi + mise à jour du statut
    const r = await sendSMS(phone, welcomeSmsBody());
    await supabase
      .from("sms_log")
      .update({
        status:     r.sid ? "SENT" : "FAILED",
        twilio_sid: r.sid ?? null,
        error:      r.error ?? null,
      })
      .eq("id", logRow.id);

    console.log(`[Welcome SMS] ${r.sid ? "envoyé" : "échec"} → ${phone}${r.error ? " : " + r.error : ""}`);
  } catch (err: any) {
    console.error("[Welcome SMS] erreur:", err?.message);
  }
}
