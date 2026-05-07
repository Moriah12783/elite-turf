/**
 * lib/whatsapp/client.ts
 *
 * Wrapper minimal autour de l'API WhatsApp Business Cloud (Meta Graph API v18+).
 * Toutes les fonctions sont **côté serveur uniquement** — elles utilisent
 * WHATSAPP_TOKEN qui ne doit JAMAIS leak côté client.
 *
 * Doc Meta : https://developers.facebook.com/docs/whatsapp/cloud-api/reference
 *
 * Convention : on retourne `{ ok, ... }` plutôt que de throw, pour que le
 * webhook handler puisse logger sans casser le flow Meta (qui re-tente si
 * 500 → boucle infinie).
 */

const WHATSAPP_API_VERSION = "v21.0";
const WHATSAPP_GRAPH_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;

export interface WhatsAppEnv {
  token:           string;  // WHATSAPP_TOKEN — token permanent système-utilisateur
  phoneNumberId:   string;  // WHATSAPP_PHONE_NUMBER_ID — ID interne Meta du numéro
  businessAccountId?: string;  // WABA ID (optionnel pour les opérations courantes)
}

/** Charge l'env serveur, throw si vars manquantes (le webhook gère le throw). */
export function getWhatsAppEnv(): WhatsAppEnv {
  const token         = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!token || !phoneNumberId) {
    throw new Error(
      "WhatsApp env vars manquantes : WHATSAPP_TOKEN et WHATSAPP_PHONE_NUMBER_ID requis. "
      + "Config Cloudflare Workers → Settings → Variables and Secrets.",
    );
  }
  return { token, phoneNumberId, businessAccountId };
}

interface SendResult {
  ok:           boolean;
  waMessageId?: string;
  error?:       string;
  status?:      number;
}

/** Envoie un message texte simple. */
export async function sendText(
  toPhone:  string,
  body:     string,
  env?:     WhatsAppEnv,
): Promise<SendResult> {
  const e = env ?? getWhatsAppEnv();

  // Normalisation : Meta veut le numéro en E.164 SANS le "+"
  const to = toPhone.replace(/^\+/, "").replace(/\s+/g, "");

  try {
    const res = await fetch(`${WHATSAPP_GRAPH_URL}/${e.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${e.token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type:    "individual",
        to,
        type: "text",
        text: {
          // Meta limite : 4096 chars par message texte. On tronque par sécurité.
          body: body.slice(0, 4096),
          // Désactive preview URL pour pas que Meta tente de fetcher des liens
          // (latence + risque de leak data si l'URL est sensible).
          preview_url: false,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok:     false,
        status: res.status,
        error:  `Meta HTTP ${res.status}: ${errText.slice(0, 500)}`,
      };
    }

    const data = await res.json() as {
      messages?: { id: string }[];
    };
    return {
      ok:          true,
      waMessageId: data.messages?.[0]?.id,
    };
  } catch (err) {
    return {
      ok:    false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Marque un message reçu comme "lu" (les 2 ticks bleus).
 * Bonne pratique : appeler dès la réception, AVANT le LLM, pour que
 * l'utilisateur voie qu'on a bien reçu son message même si le bot met
 * 2-3s à répondre.
 */
export async function markRead(
  waMessageId: string,
  env?:        WhatsAppEnv,
): Promise<SendResult> {
  const e = env ?? getWhatsAppEnv();

  try {
    const res = await fetch(`${WHATSAPP_GRAPH_URL}/${e.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${e.token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status:    "read",
        message_id: waMessageId,
      }),
    });

    return res.ok
      ? { ok: true }
      : { ok: false, status: res.status, error: `markRead HTTP ${res.status}` };
  } catch (err) {
    return {
      ok:    false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Envoie un "typing indicator" (les 3 points qui s'animent côté user).
 * Utile pour les LLM lents (Sonnet 1-3s) : l'utilisateur voit qu'on
 * est en train de composer, ne croit pas que le bot est mort.
 *
 * Note Meta : le typing s'arrête automatiquement après 25s OU à l'envoi
 * du prochain message. On n'a pas à l'arrêter manuellement.
 */
export async function sendTypingIndicator(
  toPhone: string,
  env?:    WhatsAppEnv,
): Promise<SendResult> {
  const e = env ?? getWhatsAppEnv();
  const to = toPhone.replace(/^\+/, "").replace(/\s+/g, "");

  try {
    const res = await fetch(`${WHATSAPP_GRAPH_URL}/${e.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${e.token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type:    "reaction",
        // L'API "typing" propre arrive en 2025+ ; en attendant, certains
        // intégrateurs envoient une reaction "🤔" qu'ils retirent après
        // la réponse. Conservé en placeholder, désactivable selon retour
        // user (certains trouvent ça bruyant). MVP : on ne l'appelle pas.
        reaction: { message_id: "PLACEHOLDER", emoji: "" },
      }),
    });

    return res.ok ? { ok: true } : { ok: false, status: res.status };
  } catch (err) {
    return {
      ok:    false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
