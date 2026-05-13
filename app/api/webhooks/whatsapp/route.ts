/**
 * /api/webhooks/whatsapp
 *
 * Webhook Meta WhatsApp Business — réception des événements en temps réel.
 *
 * 🎯 RÔLE
 *   Meta POST sur cet endpoint à CHAQUE :
 *     - message reçu d'un client (INBOUND)
 *     - changement de statut d'un message envoyé (sent/delivered/read/failed)
 *     - notification système (template_status_update, account_alerts, etc.)
 *
 *   On stocke tout en BDD (`whatsapp_conversations` + `whatsapp_messages`).
 *
 * 🚧 PHASE A — LOGGING ONLY
 *   On reçoit, on stocke, mais on n'envoie PAS de réponse automatique.
 *   Stéphane répond toujours à la main via WhatsApp Web (UX inchangée
 *   pour les clients), mais maintenant avec un dashboard structuré
 *   côté Elite Turf.
 *
 * 🔐 SÉCURITÉ
 *   - GET : vérification du verify_token (handshake initial avec Meta)
 *   - POST : vérification de la signature HMAC-SHA256 si APP_SECRET défini
 *
 * 📜 Doc Meta : https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 *               https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  verifyWebhookSignature,
  detectCountryFromWaId,
} from "@/lib/whatsapp/client";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

// ─────────────────────────────────────────────────────────────────────────
// GET — Hub verification (handshake initial Meta)
// ─────────────────────────────────────────────────────────────────────────
//
// Quand on configure le webhook dans Meta Developers, Meta envoie une
// requête GET avec :
//   ?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY
//
// On doit comparer hub.verify_token avec notre WHATSAPP_WEBHOOK_VERIFY_TOKEN
// et retourner hub.challenge tel quel si ça matche.
// ─────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url       = new URL(req.url);
  const mode      = url.searchParams.get("hub.mode");
  const token     = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!expectedToken) {
    // eslint-disable-next-line no-console
    console.error("[whatsapp/webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN non configuré");
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  if (mode === "subscribe" && token === expectedToken && challenge) {
    // eslint-disable-next-line no-console
    console.log("[whatsapp/webhook] Verification handshake OK");
    return new NextResponse(challenge, {
      status:  200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // eslint-disable-next-line no-console
  console.warn(`[whatsapp/webhook] Verification failed — mode=${mode}, token_match=${token === expectedToken}`);
  return new NextResponse("Forbidden", { status: 403 });
}

// ─────────────────────────────────────────────────────────────────────────
// POST — Réception événements Meta
// ─────────────────────────────────────────────────────────────────────────

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: Array<MetaIncomingMessage>;
        statuses?: Array<MetaStatusUpdate>;
      };
    }>;
  }>;
}

interface MetaIncomingMessage {
  id?:        string;
  from?:      string;
  timestamp?: string;
  type?:      string;
  text?:      { body?: string };
  image?:     { id?: string; mime_type?: string; caption?: string };
  audio?:     { id?: string; mime_type?: string };
  video?:     { id?: string; mime_type?: string; caption?: string };
  document?:  { id?: string; mime_type?: string; caption?: string; filename?: string };
  sticker?:   { id?: string; mime_type?: string };
  location?:  { latitude?: number; longitude?: number; name?: string; address?: string };
  interactive?: unknown;
  reaction?:  unknown;
  button?:    unknown;
}

interface MetaStatusUpdate {
  id?:        string;
  recipient_id?: string;
  status?:    string;       // sent / delivered / read / failed
  timestamp?: string;
  errors?:    Array<{ code?: number; title?: string; message?: string }>;
}

export async function POST(req: NextRequest) {
  // ── 1. Lecture du body brut (nécessaire pour vérifier la signature) ──
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  // ── 2. Vérification signature (best-effort si APP_SECRET non défini) ──
  const signatureOk = await verifyWebhookSignature(rawBody, signature);
  if (!signatureOk) {
    // eslint-disable-next-line no-console
    console.warn("[whatsapp/webhook] Invalid signature");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  // ── 3. Parse JSON ──
  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  // ── 4. Acknowledge IMMÉDIATEMENT (Meta veut un 200 sous 20s) ─────────
  // Le traitement asynchrone va ensuite stocker en BDD.
  // En mode Cloudflare Workers, on ne peut pas vraiment "fire-and-forget"
  // sans ctx.waitUntil — on traite donc en synchrone mais on garde le code
  // efficient.

  try {
    await processWebhook(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[whatsapp/webhook] Processing error:", err);
    // On retourne quand même 200 pour ne pas que Meta retry indéfiniment.
    // L'erreur est loggée dans Cloudflare logs pour debug.
  }

  return new NextResponse("ok", { status: 200 });
}

// ─────────────────────────────────────────────────────────────────────────
// Traitement métier
// ─────────────────────────────────────────────────────────────────────────

async function processWebhook(payload: MetaWebhookPayload): Promise<void> {
  if (payload.object !== "whatsapp_business_account" || !payload.entry) {
    return;
  }

  const supabase = createServiceClient();

  for (const entry of payload.entry) {
    for (const change of entry.changes ?? []) {
      // On ne traite que les events liés aux messages WhatsApp
      if (change.field !== "messages") continue;
      const value = change.value;
      if (!value) continue;

      // ── A. Messages entrants (clients qui nous écrivent) ────────────
      for (const msg of value.messages ?? []) {
        await ingestInboundMessage(supabase, msg, value.contacts ?? []);
      }

      // ── B. Status updates (sent/delivered/read pour nos OUTBOUND) ───
      for (const status of value.statuses ?? []) {
        await applyStatusUpdate(supabase, status);
      }
    }
  }
}

/**
 * Stocke un message entrant en BDD : upsert conversation + insert message.
 * Idempotent via UNIQUE(wa_message_id).
 */
async function ingestInboundMessage(
  supabase: ReturnType<typeof createServiceClient>,
  msg:      MetaIncomingMessage,
  contacts: Array<{ wa_id?: string; profile?: { name?: string } }>,
): Promise<void> {
  if (!msg.from || !msg.id) {
    // eslint-disable-next-line no-console
    console.warn("[whatsapp/webhook] Message sans from ou id, skip:", msg);
    return;
  }

  const wa_id        = msg.from;
  const contact      = contacts.find((c) => c.wa_id === wa_id);
  const contact_name = contact?.profile?.name ?? null;
  const country      = detectCountryFromWaId(wa_id);

  // ── 1. Upsert conversation ─────────────────────────────────────────
  // ON CONFLICT (wa_id) DO UPDATE : on met à jour le nom si fourni, et on
  // garde les autres champs intacts. Le trigger touch_wa_conversation_on_message
  // s'occupera de last_message_at / unread_count.
  const { data: conv, error: convErr } = await supabase
    .from("whatsapp_conversations")
    .upsert(
      {
        wa_id,
        contact_name,
        phone_country: country,
        status:        "OPEN",
      },
      { onConflict: "wa_id" },
    )
    .select("id")
    .single();

  if (convErr || !conv) {
    // eslint-disable-next-line no-console
    console.error(`[whatsapp/webhook] Upsert conversation failed for ${wa_id}:`, convErr);
    return;
  }

  // ── 2. Extraction du contenu selon le type ──────────────────────────
  const type = (msg.type ?? "unknown") as
    "text" | "image" | "audio" | "video" | "document" | "sticker"
    | "location" | "contacts" | "template" | "interactive"
    | "reaction" | "button" | "unknown";

  let text_body:      string | null = null;
  let media_id:       string | null = null;
  let media_mime:     string | null = null;
  let media_caption:  string | null = null;

  switch (type) {
    case "text":
      text_body = msg.text?.body ?? null;
      break;
    case "image":
      media_id = msg.image?.id ?? null;
      media_mime = msg.image?.mime_type ?? null;
      media_caption = msg.image?.caption ?? null;
      break;
    case "audio":
      media_id = msg.audio?.id ?? null;
      media_mime = msg.audio?.mime_type ?? null;
      break;
    case "video":
      media_id = msg.video?.id ?? null;
      media_mime = msg.video?.mime_type ?? null;
      media_caption = msg.video?.caption ?? null;
      break;
    case "document":
      media_id = msg.document?.id ?? null;
      media_mime = msg.document?.mime_type ?? null;
      media_caption = msg.document?.caption ?? msg.document?.filename ?? null;
      break;
    case "sticker":
      media_id = msg.sticker?.id ?? null;
      break;
    case "location":
      text_body = `📍 ${msg.location?.name ?? ""} ${msg.location?.address ?? ""} (${msg.location?.latitude}, ${msg.location?.longitude})`.trim();
      break;
    default:
      text_body = `[Message de type ${type} non rendu — voir raw_payload]`;
  }

  // ── 3. Insert message (ON CONFLICT pour idempotence) ────────────────
  const meta_ts = msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * 1000).toISOString() : null;

  const { error: msgErr } = await supabase
    .from("whatsapp_messages")
    .insert({
      conversation_id:  conv.id,
      wa_message_id:    msg.id,
      wa_id_contact:    wa_id,
      direction:        "INBOUND",
      type,
      text_body,
      media_id,
      media_mime_type:  media_mime,
      media_caption,
      raw_payload:      msg,
      meta_timestamp:   meta_ts,
    });

  if (msgErr) {
    // Si erreur "duplicate key" sur wa_message_id, c'est OK : webhook retry de Meta
    if (msgErr.code === "23505") {
      // eslint-disable-next-line no-console
      console.log(`[whatsapp/webhook] Message ${msg.id} déjà reçu (retry Meta), skip`);
      return;
    }
    // eslint-disable-next-line no-console
    console.error(`[whatsapp/webhook] Insert message failed for ${msg.id}:`, msgErr);
  }
}

/**
 * Applique un status update Meta sur un message OUTBOUND existant.
 * Met à jour `status`, `delivered_at`, `read_at`, `error_*`.
 */
async function applyStatusUpdate(
  supabase: ReturnType<typeof createServiceClient>,
  status:   MetaStatusUpdate,
): Promise<void> {
  if (!status.id || !status.status) return;

  const meta_ts = status.timestamp
    ? new Date(parseInt(status.timestamp, 10) * 1000).toISOString()
    : new Date().toISOString();

  const update: Record<string, unknown> = { status: status.status };

  if (status.status === "delivered") update.delivered_at = meta_ts;
  if (status.status === "read")      update.read_at      = meta_ts;
  if (status.status === "failed" && status.errors?.length) {
    update.error_code    = status.errors[0]?.code ?? null;
    update.error_message = status.errors[0]?.message ?? status.errors[0]?.title ?? null;
  }

  const { error } = await supabase
    .from("whatsapp_messages")
    .update(update)
    .eq("wa_message_id", status.id);

  if (error) {
    // eslint-disable-next-line no-console
    console.warn(`[whatsapp/webhook] Status update failed for ${status.id}:`, error);
  }
}
