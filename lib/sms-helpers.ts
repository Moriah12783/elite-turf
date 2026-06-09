/**
 * lib/sms-helpers.ts
 *
 * Helpers SMS partagés (config Twilio, normalisation E.164, liens courts).
 * Aucune dépendance vers sms-welcome / sms-sequence → pas de cycle d'import.
 */

// Hôte court pour les liens SMS : économise des caractères (1 segment GSM-7).
// elite-turf.fr redirige vers www en conservant la query string (?t=…).
export const SMS_HOST = "elite-turf.fr";

/** true si Twilio est configuré (SID + token + un expéditeur). */
export function isTwilioConfigured(): boolean {
  return (
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!process.env.TWILIO_AUTH_TOKEN &&
    (!!process.env.TWILIO_MESSAGING_SERVICE_SID || !!process.env.TWILIO_PHONE_NUMBER)
  );
}

/** Normalise un numéro en E.164 sans espaces ("+225 07 00…" → "+2250700…"). */
export function normalizeE164(input: string | null | undefined): string {
  const s = (input || "").trim().replace(/[\s().\-]/g, "");
  if (!s) return "";
  if (s.startsWith("+")) return "+" + s.slice(1).replace(/\D/g, "");
  const digits = s.replace(/\D/g, "");
  return digits ? "+" + digits : "";
}

/** Lien de désinscription 1-clic (token opaque par profil). */
export function stopLink(token: string): string {
  return `${SMS_HOST}/stop?t=${token}`;
}
