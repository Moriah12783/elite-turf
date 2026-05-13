/**
 * lib/whatsapp/client.ts
 *
 * Client WhatsApp Cloud API (Meta Graph) pour Elite Turf.
 *
 * 🎯 RÔLE
 *   Wrapper minimaliste autour de l'API graph.facebook.com/v21.0/{phone_number_id}.
 *   Permet d'envoyer des messages texte / templates et de marquer un
 *   message comme lu. Pas de SDK lourd : fetch natif (compatible
 *   Cloudflare Workers).
 *
 * 🔑 CONFIG (cf Cloudflare Variables and Secrets)
 *   - WHATSAPP_ACCESS_TOKEN       : token permanent du System User
 *   - WHATSAPP_PHONE_NUMBER_ID    : ID du numéro WhatsApp Business
 *   - WHATSAPP_BUSINESS_ACCOUNT_ID: ID du WABA (pour endpoints management)
 *
 * 🚧 PHASE A — LOGGING ONLY
 *   Le webhook reçoit + stocke mais n'envoie pas automatiquement.
 *   `sendText()` n'est appelé que depuis l'UI admin (/admin/whatsapp)
 *   où Stéphane répond manuellement à un client. Pas d'envois auto.
 *
 * 📜 Doc Meta : https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE_URL    = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface SendTextParams {
  /** Numéro destinataire E.164 avec ou sans "+" (ex: "33612345678") */
  to:           string;
  /** Texte du message (max 4096 chars selon Meta) */
  body:         string;
  /** Active la preview de liens URL automatique (défaut false) */
  preview_url?: boolean;
}

export interface SendTextResult {
  /** ID Meta du message ("wamid.HBgM...") pour tracking idempotent */
  wa_message_id: string;
  /** Numéro normalisé tel que renvoyé par Meta */
  to_normalized: string;
}

export interface SendTemplateParams {
  to:            string;
  /** Nom exact du template approuvé Meta */
  template_name: string;
  /** Code langue (ex: "fr", "fr_FR", "en_US") */
  language:      string;
  /** Composants du template (header, body, button) — voir doc Meta */
  components?:   unknown[];
}

export interface MarkAsReadParams {
  /** wa_message_id du message INBOUND à marquer lu */
  message_id: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────

function getConfig(): { token: string; phoneNumberId: string } {
  const token         = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token)         throw new Error("WHATSAPP_ACCESS_TOKEN manquant (Cloudflare Variables and Secrets)");
  if (!phoneNumberId) throw new Error("WHATSAPP_PHONE_NUMBER_ID manquant");
  return { token, phoneNumberId };
}

/**
 * Normalise un numéro de téléphone au format E.164 sans préfixe "+".
 * Meta accepte les 2 formats mais on standardise pour la BDD.
 *   "+33 6 12 34 56 78" → "33612345678"
 *   "33612345678"        → "33612345678"
 *   "0612345678"         → "33612345678" (ajout FR par défaut si commence par 0)
 */
export function normalizeWaId(input: string, defaultCountryCode = "33"): string {
  if (!input) return "";
  let cleaned = input.replace(/[^\d]/g, "");
  if (cleaned.startsWith("0") && defaultCountryCode) {
    cleaned = defaultCountryCode + cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Décode HTTP error → message lisible (gère cas Meta avec error.message).
 */
async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json() as { error?: { message?: string; code?: number; type?: string } };
    if (data.error) {
      return `Meta API ${res.status} (${data.error.code ?? "?"}/${data.error.type ?? "?"}): ${data.error.message ?? "no message"}`;
    }
    return `Meta API ${res.status} : ${JSON.stringify(data).slice(0, 300)}`;
  } catch {
    return `Meta API ${res.status} : (non-JSON response)`;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Send text message
// ─────────────────────────────────────────────────────────────────────────

/**
 * Envoie un message texte simple via l'API WhatsApp Cloud.
 *
 * ⚠️ RÈGLE FENÊTRE 24H (Meta) : on ne peut envoyer un message libre (texte)
 *   que si le client nous a écrit dans les 24 dernières heures. Sinon il
 *   faut passer par un TEMPLATE pré-approuvé (cf sendTemplate).
 *
 * @throws Error si l'API retourne une erreur (token invalide, fenêtre 24h
 *   expirée, numéro non WhatsApp, etc.)
 *
 * @example
 *   const r = await sendText({
 *     to: "33612345678",
 *     body: "Bonjour, merci pour votre message. On vous répond rapidement."
 *   });
 *   console.log(r.wa_message_id); // "wamid.HBgM..."
 */
export async function sendText(params: SendTextParams): Promise<SendTextResult> {
  const { token, phoneNumberId } = getConfig();

  const to = normalizeWaId(params.to);
  if (!to) throw new Error("Numéro destinataire vide ou invalide");
  if (!params.body || params.body.trim().length === 0) {
    throw new Error("Body vide");
  }
  if (params.body.length > 4096) {
    throw new Error(`Body trop long (${params.body.length} > 4096 chars max Meta)`);
  }

  const res = await fetch(`${GRAPH_BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type:    "individual",
      to,
      type:              "text",
      text: {
        body:        params.body,
        preview_url: params.preview_url ?? false,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  const data = await res.json() as {
    messaging_product?: string;
    contacts?: Array<{ input: string; wa_id: string }>;
    messages?: Array<{ id: string }>;
  };

  const wa_message_id = data.messages?.[0]?.id;
  if (!wa_message_id) {
    throw new Error(`Meta API response malformée : pas de messages[0].id. Body : ${JSON.stringify(data).slice(0, 300)}`);
  }

  return {
    wa_message_id,
    to_normalized: data.contacts?.[0]?.wa_id ?? to,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Send template (hors fenêtre 24h)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Envoie un template pré-approuvé. Obligatoire pour les messages
 * marketing / hors fenêtre conversation 24h.
 *
 * Les templates doivent être créés dans WhatsApp Manager
 * (https://business.facebook.com/wa/manage/message-templates) puis
 * validés par Meta (~24-48h).
 *
 * @example
 *   await sendTemplate({
 *     to: "33612345678",
 *     template_name: "elite_turf_bienvenue",
 *     language: "fr",
 *     components: [{ type: "body", parameters: [{ type: "text", text: "Stéphane" }] }]
 *   });
 */
export async function sendTemplate(params: SendTemplateParams): Promise<SendTextResult> {
  const { token, phoneNumberId } = getConfig();
  const to = normalizeWaId(params.to);

  const res = await fetch(`${GRAPH_BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type:              "template",
      template: {
        name:       params.template_name,
        language:   { code: params.language },
        components: params.components ?? [],
      },
    }),
  });

  if (!res.ok) throw new Error(await readErrorMessage(res));

  const data = await res.json() as { messages?: Array<{ id: string }>; contacts?: Array<{ wa_id: string }> };
  const wa_message_id = data.messages?.[0]?.id;
  if (!wa_message_id) throw new Error("Meta API : pas de wa_message_id retourné pour le template");

  return {
    wa_message_id,
    to_normalized: data.contacts?.[0]?.wa_id ?? to,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Mark as read
// ─────────────────────────────────────────────────────────────────────────

/**
 * Marque un message INBOUND comme lu côté WhatsApp (les "doubles checks bleus").
 * Appelé depuis le dashboard admin quand Stéphane ouvre une conversation.
 *
 * Best-effort : si l'API plante, on log mais on ne throw pas (pas critique).
 */
export async function markAsRead(params: MarkAsReadParams): Promise<{ ok: boolean }> {
  try {
    const { token, phoneNumberId } = getConfig();

    const res = await fetch(`${GRAPH_BASE_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status:            "read",
        message_id:        params.message_id,
      }),
    });

    return { ok: res.ok };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[whatsapp] markAsRead failed (non-critique):", err);
    return { ok: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Webhook signature verification (sécurité)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Vérifie la signature HMAC-SHA256 d'un webhook Meta.
 * Si WHATSAPP_APP_SECRET est défini → vérification stricte.
 * Si non défini → bypass (log warning) — utile pour démarrer mais à
 * compléter dès que possible.
 *
 * Meta envoie le header `x-hub-signature-256` au format "sha256=<hex>".
 *
 * @returns true si signature valide OU si vérification désactivée
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret) {
    // eslint-disable-next-line no-console
    console.warn("[whatsapp] WHATSAPP_APP_SECRET non défini — signature webhook NON vérifiée. Configurer dès que possible.");
    return true;
  }

  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expectedSignature = signatureHeader.substring("sha256=".length);

  // HMAC-SHA256 via Web Crypto API (compatible Cloudflare Workers)
  const encoder = new TextEncoder();
  const key     = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const hex       = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Comparaison constant-time pour éviter timing attacks
  return constantTimeEqual(hex, expectedSignature);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Detection pays depuis numéro
// ─────────────────────────────────────────────────────────────────────────

/**
 * Devine le code pays ISO-2 depuis un numéro WhatsApp.
 * Utilisé pour pré-tagger la conversation (analytics Afrique vs France).
 * Pas exhaustif — couvre les pays cibles Elite Turf.
 */
export function detectCountryFromWaId(wa_id: string): string | null {
  if (!wa_id) return null;
  const n = wa_id.replace(/^\+/, "");
  if (n.startsWith("33"))  return "FR";
  if (n.startsWith("32"))  return "BE";
  if (n.startsWith("41"))  return "CH";
  if (n.startsWith("212")) return "MA";  // Maroc
  if (n.startsWith("213")) return "DZ";  // Algérie
  if (n.startsWith("216")) return "TN";  // Tunisie
  if (n.startsWith("221")) return "SN";  // Sénégal
  if (n.startsWith("222")) return "MR";  // Mauritanie
  if (n.startsWith("223")) return "ML";  // Mali
  if (n.startsWith("224")) return "GN";  // Guinée
  if (n.startsWith("225")) return "CI";  // Côte d'Ivoire
  if (n.startsWith("226")) return "BF";  // Burkina Faso
  if (n.startsWith("227")) return "NE";  // Niger
  if (n.startsWith("228")) return "TG";  // Togo
  if (n.startsWith("229")) return "BJ";  // Bénin
  if (n.startsWith("237")) return "CM";  // Cameroun
  if (n.startsWith("241")) return "GA";  // Gabon
  if (n.startsWith("242")) return "CG";  // Congo
  if (n.startsWith("243")) return "CD";  // RDC
  if (n.startsWith("235")) return "TD";  // Tchad
  if (n.startsWith("262")) return "RE";  // Réunion / Mayotte
  if (n.startsWith("509")) return "HT";  // Haïti
  if (n.startsWith("261")) return "MG";  // Madagascar
  if (n.startsWith("1"))   return "US";  // USA/Canada (souvent sandbox)
  return null;
}
