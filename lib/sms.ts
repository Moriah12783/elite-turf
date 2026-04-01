/**
 * Utilitaire SMS — Twilio REST API (sans SDK, zéro dépendance).
 * Couvre France, Belgique, Côte d'Ivoire, Sénégal, Maroc et toute l'Afrique de l'Ouest.
 * Variables d'environnement requises :
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_MESSAGING_SERVICE_SID  (recommandé — Messaging Service Twilio)
 *   TWILIO_PHONE_NUMBER           (fallback si pas de Messaging Service)
 */

const TWILIO_BASE = `https://api.twilio.com/2010-04-01/Accounts`;

export interface SMSResult {
  to: string;
  sid?: string;
  error?: string;
}

/** Envoie un SMS à un seul numéro. Retourne le SID Twilio ou l'erreur. */
export async function sendSMS(to: string, body: string): Promise<SMSResult> {
  const accountSid        = process.env.TWILIO_ACCOUNT_SID;
  const authToken         = process.env.TWILIO_AUTH_TOKEN;
  const messagingService  = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber        = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || (!messagingService && !fromNumber)) {
    return { to, error: "Twilio non configuré (variables manquantes)" };
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  try {
    // Construit les paramètres selon la source disponible
    const params = new URLSearchParams();
    params.append("To", to);
    params.append("Body", body);
    if (messagingService) {
      params.append("MessagingServiceSid", messagingService);
    } else {
      params.append("From", fromNumber!);
    }

    const res = await fetch(`${TWILIO_BASE}/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      // Retourne le message d'erreur Twilio détaillé pour faciliter le diagnostic
      return { to, error: data.message || `Erreur Twilio ${res.status} (code: ${data.code})` };
    }

    return { to, sid: data.sid };
  } catch (err) {
    return { to, error: err instanceof Error ? err.message : "Erreur réseau" };
  }
}

/** Formate le message final (préfixe + corps + lien). Max 160 chars. */
export function formatSMSMessage(corps: string): string {
  const prefix = "EliteTurf : ";
  const suffix = " elite-turf.fr";
  const truncated = corps.slice(0, 160 - prefix.length - suffix.length);
  return `${prefix}${truncated}${suffix}`;
}
