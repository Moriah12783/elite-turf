/**
 * lib/sms-alerte-jour.ts
 *
 * Alerte SMS QUOTIDIENNE aux abonnés PAYANTS : « nos experts ont parlé, vos
 * analyses du jour sont disponibles ». Déclenchée par le cron
 * /api/cron/alerte-sms-jour quand au moins un pronostic payant (PRO/ELITE) a été
 * publié le jour même — remplace le SMS écrit/collé/envoyé à la main.
 *
 * - Cible : STARTER + PRO + ELITE, actifs, opt-in SMS, non désinscrits, avec numéro.
 * - Idempotence : UNE alerte par abonné par jour, via sms_log UNIQUE(user_id, type)
 *   avec type = `ALERTE_JOUR_<AAAA-MM-JJ>` → plusieurs passages cron/jour = 1 seul envoi.
 * - Best-effort : ne throw jamais. GSM-7 (ASCII) + lien STOP 1-clic (légal).
 */
import { createServiceClient } from "@/lib/supabase/server";
import { sendSequenceSms } from "@/lib/sms-sequence";
import { stopLink, SMS_HOST } from "@/lib/sms-helpers";

export interface AlerteJourStats {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Corps du SMS (ASCII/GSM-7 strict, pas d'accent → segments non gonflés) avec le
 * lien vers l'espace abonné + la désinscription 1-clic obligatoire.
 */
export function smsAlerteJourBody(token: string): string {
  return (
    `ELITE TURF: nos experts ont parle, vos analyses du jour sont disponibles. ` +
    `Connectez-vous: ${SMS_HOST}/pronostics Stop: ${stopLink(token)}`
  );
}

interface PayingProfile {
  id: string;
  phone: string | null;
  pays: string | null;
  sms_unsub_token: string | null;
}

/**
 * Envoie l'alerte du jour aux abonnés payants. `dateISO` = 'AAAA-MM-JJ' (clé de
 * dédup du jour, partagée par tous les passages cron d'une même journée).
 * Ne throw jamais — retourne des stats.
 */
export async function sendDailyPronosticAlertSms(dateISO: string): Promise<AlerteJourStats> {
  const stats: AlerteJourStats = { processed: 0, sent: 0, failed: 0, skipped: 0 };
  const type = `ALERTE_JOUR_${dateISO}`;
  const supabase = createServiceClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, phone, pays, sms_unsub_token")
    .in("statut_abonnement", ["STARTER", "PRO", "ELITE"]) // abonnés PAYANTS uniquement
    .eq("actif", true)
    .neq("role", "ADMIN")          // le staff n'est jamais ciblé par les SMS clients
    .eq("sms_opt_in", true)        // consentement
    .eq("sms_opted_out", false)    // n'a pas répondu STOP
    .not("phone", "is", null);

  if (error || !profiles) return stats;

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i] as PayingProfile;
    stats.processed++;
    const phone = (p.phone || "").trim();
    const token = p.sms_unsub_token || "";
    if (!phone || !token) { stats.skipped++; continue; }

    // sendSequenceSms insère le log PENDING AVANT l'envoi → idempotence garantie
    // par UNIQUE(user_id, type) : un 2e passage cron le même jour = conflit = skip.
    const res = await sendSequenceSms({
      profileId: p.id, phone, pays: p.pays, type, body: smsAlerteJourBody(token),
    });
    if (res.ok) stats.sent++;
    else if (res.skipped) stats.skipped++;
    else stats.failed++;

    await new Promise((r) => setTimeout(r, 250)); // throttle léger (rate-limit Twilio)
  }
  return stats;
}
