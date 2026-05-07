/**
 * app/api/whatsapp/webhook/route.ts
 *
 * Webhook WhatsApp Business Cloud API d'Elite Turf.
 *
 *  - GET  : challenge de vérification Meta (à la première config du webhook).
 *           Meta envoie hub.mode=subscribe + hub.verify_token + hub.challenge ;
 *           on doit rejouer hub.challenge tel quel si le verify_token matche
 *           celui qu'on a configuré côté Meta dashboard.
 *
 *  - POST : événements webhook (messages reçus, statuts envoyés, etc.).
 *           On ack tout de suite avec 200 (sinon Meta retry pendant 7 jours)
 *           et on traite en arrière-plan.
 *
 * Sécurité :
 *  - GET  : verify_token comparé à process.env.WHATSAPP_VERIFY_TOKEN
 *  - POST : signature HMAC SHA-256 dans X-Hub-Signature-256, comparée
 *           au secret de l'app Meta (process.env.WHATSAPP_APP_SECRET).
 *
 * État dormant : si les env vars ne sont pas configurées, l'endpoint
 * répond proprement (501 ou message clair) sans crasher. Permet de
 * merger la PR en avance sans casser la prod.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { sendText, markRead, getWhatsAppEnv } from "@/lib/whatsapp/client";
import { invokeAgent, type ChatMessage } from "@/lib/whatsapp/agent";

export const dynamic = "force-dynamic";

// ── GET : vérification webhook par Meta ──────────────────────────────
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode      = url.searchParams.get("hub.mode");
  const token     = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expectedToken) {
    // Endpoint pas encore configuré : on répond 200 OK mais sans challenge
    // pour que Meta ne rejette pas la création du webhook avant qu'on ait
    // les vars. Permet le déploiement avant config.
    return NextResponse.json({
      status:  "ok",
      service: "elite-turf-whatsapp-webhook",
      ready:   false,
      note:    "WHATSAPP_VERIFY_TOKEN non configuré côté env vars.",
    });
  }

  if (mode === "subscribe" && token === expectedToken && challenge) {
    // Meta exige une réponse texte brute avec le challenge tel quel
    return new NextResponse(challenge, {
      status:  200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// ── POST : événements webhook ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.text();

  // 1) Vérification signature HMAC SHA-256
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  if (!appSecret) {
    // Endpoint dormant — on ack 200 pour que Meta n'accumule pas de retries
    return NextResponse.json({
      received: true,
      ready:    false,
      note:     "WHATSAPP_APP_SECRET non configuré.",
    });
  }

  const expected = "sha256=" + crypto
    .createHmac("sha256", appSecret)
    .update(body)
    .digest("hex");

  let signatureOk = false;
  try {
    signatureOk =
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    signatureOk = false;
  }

  if (!signatureOk) {
    console.warn("[WhatsApp webhook] Signature invalide");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2) Parse body
  let event: WhatsAppWebhookEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 3) Traitement async (mais on attend pour ne pas perdre les erreurs en
  //    edge runtime ; Meta accepte ~10s de réponse, c'est large).
  try {
    await processWebhookEvent(event);
  } catch (err) {
    console.error("[WhatsApp webhook] Error:", err);
    // On ack quand même 200 — sinon Meta retry pendant 7 jours.
    // L'erreur est loggée côté serveur pour debug.
  }

  return NextResponse.json({ received: true });
}

// ── Traitement d'un événement webhook ────────────────────────────────

interface WhatsAppWebhookEvent {
  object: string;
  entry?: Array<{
    id:      string;
    changes: Array<{
      field: string;
      value: {
        messaging_product?: string;
        metadata?: { phone_number_id: string; display_phone_number: string };
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
        messages?: Array<{
          from:      string;
          id:        string;
          timestamp: string;
          type:      string;
          text?:     { body: string };
        }>;
        statuses?: Array<{
          id:        string;
          status:    "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
        }>;
      };
    }>;
  }>;
}

async function processWebhookEvent(event: WhatsAppWebhookEvent): Promise<void> {
  const supabase = createServiceClient();

  for (const entry of event.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value;

      // ── Status updates (sent/delivered/read/failed) → MAJ tracking ──
      for (const status of v.statuses ?? []) {
        await supabase
          .from("whatsapp_messages")
          .update({ delivery_status: status.status })
          .eq("wa_message_id", status.id);
      }

      // ── Messages entrants ─────────────────────────────────────────
      for (const msg of v.messages ?? []) {
        if (msg.type !== "text" || !msg.text?.body) {
          // MVP : on ne traite que le texte. Image/audio plus tard.
          continue;
        }
        await handleIncomingTextMessage({
          fromPhone:    `+${msg.from}`,
          waMessageId:  msg.id,
          text:         msg.text.body,
          contactName:  v.contacts?.[0]?.profile?.name,
        });
      }
    }
  }
}

interface IncomingTextArgs {
  fromPhone:   string;
  waMessageId: string;
  text:        string;
  contactName?: string;
}

async function handleIncomingTextMessage(args: IncomingTextArgs): Promise<void> {
  const supabase = createServiceClient();

  // 1) Marque le message comme "lu" côté Meta (les 2 ticks bleus)
  //    pour rassurer l'utilisateur pendant que le LLM réfléchit.
  try {
    await markRead(args.waMessageId);
  } catch { /* best-effort */ }

  // 2) Trouve ou crée la conversation + log le message entrant
  const { data: existingConv } = await supabase
    .from("whatsapp_conversations")
    .select("id, history, profile_id, escalated, msg_count_in")
    .eq("phone", args.fromPhone)
    .maybeSingle();

  let conversationId: string;
  let history: ChatMessage[] = [];
  let escalated = false;
  let profileId: string | null = null;

  if (existingConv) {
    conversationId = existingConv.id;
    history        = (existingConv.history as ChatMessage[]) ?? [];
    escalated      = existingConv.escalated;
    profileId      = existingConv.profile_id;

    await supabase
      .from("whatsapp_conversations")
      .update({
        last_seen_at: new Date().toISOString(),
        msg_count_in: existingConv.msg_count_in + 1,
      })
      .eq("id", conversationId);
  } else {
    // Nouvelle conversation : tenter un match profil par téléphone
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("telephone", args.fromPhone)
      .maybeSingle();
    profileId = profile?.id ?? null;

    const { data: newConv } = await supabase
      .from("whatsapp_conversations")
      .insert({
        phone:        args.fromPhone,
        profile_id:   profileId,
        history:      [],
        msg_count_in: 1,
      })
      .select("id")
      .single();
    if (!newConv) throw new Error("Failed to create conversation");
    conversationId = newConv.id;
  }

  // Audit du message entrant (idempotent via UNIQUE wa_message_id)
  await supabase.from("whatsapp_messages").insert({
    conversation_id: conversationId,
    direction:       "in",
    wa_message_id:   args.waMessageId,
    content:         args.text,
    message_type:    "text",
  }).select().single().then(() => {}, () => {/* idempotence : déjà reçu */});

  // 3) Si la conv a été escaladée à un humain, on ne répond pas en bot
  if (escalated) {
    console.log(`[WhatsApp] Conv ${conversationId} escaladée — bot silencieux.`);
    return;
  }

  // 4) Récupère le profil enrichi pour le system prompt
  let userProfile = null;
  if (profileId) {
    const { data } = await supabase
      .from("profiles")
      .select("nom_complet, role")
      .eq("id", profileId)
      .maybeSingle();
    if (data) {
      userProfile = {
        prenom:           data.nom_complet?.split(" ")[0] ?? null,
        niveau_acces:     null,           // À enrichir : join abonnements actif
        abonnement_actif: false,
      };
    }
  }

  // 5) Appel LLM
  let agentReply;
  try {
    agentReply = await invokeAgent({
      userMessage: args.text,
      history,
      userProfile,
    });
  } catch (err) {
    console.error("[WhatsApp] LLM error:", err);
    // Fallback : message générique pour ne pas laisser l'utilisateur sans réponse
    await sendText(
      args.fromPhone,
      "Désolé, je rencontre un souci technique. L'équipe a été notifiée et te recontactera rapidement.",
    );
    return;
  }

  // 6) Envoi de la réponse via WhatsApp Cloud API
  const sendResult = await sendText(args.fromPhone, agentReply.reply);

  // 7) Audit + MAJ history conversation
  const newHistory = [
    ...history,
    { role: "user" as const, content: args.text },
    { role: "assistant" as const, content: agentReply.reply },
  ].slice(-20); // borne dure pour ne pas exploser le JSONB

  await supabase
    .from("whatsapp_conversations")
    .update({
      history:       newHistory,
      msg_count_out: existingConv ? (existingConv.msg_count_in /* approx */ + 1) : 1,
      intent_tag:    agentReply.intent,
      escalated:     !!agentReply.escalateReason,
    })
    .eq("id", conversationId);

  await supabase.from("whatsapp_messages").insert({
    conversation_id:   conversationId,
    direction:         "out",
    wa_message_id:     sendResult.waMessageId ?? null,
    content:           agentReply.reply,
    message_type:      "text",
    delivery_status:   sendResult.ok ? "sent" : "failed",
    llm_model:         agentReply.model,
    llm_input_tokens:  agentReply.inputTokens,
    llm_output_tokens: agentReply.outputTokens,
    llm_cost_usd:      agentReply.costUsd,
    error:             sendResult.error ?? null,
  });

  // 8) Escalation : ping admin si l'agent l'a demandé
  if (agentReply.escalateReason) {
    console.warn(
      `[WhatsApp ESCALATE] ${args.fromPhone} → "${agentReply.escalateReason}". Conv: ${conversationId}`,
    );
    // TODO Phase 2 : notifier l'admin via Resend ou WhatsApp template
  }
}
