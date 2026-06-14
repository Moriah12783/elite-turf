/**
 * lib/sms-helpers.ts
 *
 * Helpers SMS partagés (config Twilio, normalisation E.164, liens courts).
 * Aucune dépendance vers sms-welcome / sms-sequence → pas de cycle d'import.
 */

import { INDICATIF_BY_PAYS } from "@/lib/utils/pays";

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

/**
 * Normalise un numéro en E.164.
 *
 * Si `pays` (nom du pays du profil, ex. "Maroc") est fourni, on utilise son
 * indicatif (`INDICATIF_BY_PAYS`) pour reconstruire un E.164 valide à partir d'un
 * numéro saisi en format LOCAL. INDISPENSABLE : sans ça, "0626…" (Maroc) ou
 * "0780…" (France) devenaient "+0626…"/"+0780…" = invalides → SMS rejetés par
 * Twilio (bug constaté 14/06 : 0 SMS reçu au Maroc/France, 100 % au Burkina car
 * les numéros y étaient déjà saisis en "+226…").
 */
export function normalizeE164(
  input: string | null | undefined,
  pays?: string | null,
): string {
  let s = (input || "").trim().replace(/[\s().\-]/g, "");
  if (!s) return "";

  // Préfixe d'appel international "00…" → "+…"
  if (s.startsWith("00")) s = "+" + s.slice(2);

  // Indicatif du pays (ex. "Maroc" → "212"). Vide si pays inconnu / "Autre".
  const cc = pays ? (INDICATIF_BY_PAYS[pays] || "").replace(/\D/g, "") : "";

  // Déjà au format international (+…)
  if (s.startsWith("+")) {
    let digits = s.slice(1).replace(/\D/g, "");
    // Retire un 0 d'appel national parasite juste après l'indicatif
    // (ex. "+212 06 26…" → "+2120626…" → "+212626…").
    if (cc && digits.startsWith(cc + "0")) {
      digits = cc + digits.slice(cc.length).replace(/^0+/, "");
    }
    return digits ? "+" + digits : "";
  }

  const digits = s.replace(/\D/g, "");
  if (!digits) return "";

  if (cc) {
    // Numéro déjà préfixé par l'indicatif mais sans le "+" (ex. "212626…").
    if (digits.startsWith(cc)) {
      return "+" + cc + digits.slice(cc.length).replace(/^0+/, "");
    }
    // Numéro LOCAL : on retire le 0 d'appel national et on ajoute l'indicatif.
    return "+" + cc + digits.replace(/^0+/, "");
  }

  // Pays inconnu / "Autre" : best-effort (on préfixe juste "+").
  return "+" + digits;
}

/** Lien de désinscription 1-clic (token opaque par profil). */
export function stopLink(token: string): string {
  return `${SMS_HOST}/stop?t=${token}`;
}
