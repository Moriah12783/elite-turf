/**
 * POST /api/admin/whatsapp/reply
 *
 * Envoie une réponse manuelle (mode MANUAL) depuis le dashboard admin
 * vers un contact WhatsApp.
 *
 * Flow :
 *   1. Charge la conversation (récupère wa_id du destinataire)
 *   2. Appelle WhatsApp Cloud API via sendText()
 *   3. Insère le message OUTBOUND en BDD avec replied_via=MANUAL
 *   4. Marque les INBOUND comme lus (reset unread_count)
 *
 * 🔐 Auth : Bearer CRON_SECRET OU session admin
 *
 * 📦 Body : { conversation_id: string, body: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";
import { sendText } from "@/lib/whatsapp/client";

export const dynamic     = "force-dynamic";
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  let body: { conversation_id?: string; body?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const conversation_id = body.conversation_id?.trim();
  const text            = body.body?.trim();

  if (!conversation_id || !/^[0-9a-f-]{36}$/i.test(conversation_id)) {
    return NextResponse.json({ error: "conversation_id invalide (UUID attendu)" }, { status: 400 });
  }
  if (!text || text.length === 0) {
    return NextResponse.json({ error: "body vide" }, { status: 400 });
  }
  if (text.length > 4096) {
    return NextResponse.json({ error: `Message trop long (${text.length} > 4096 chars max WhatsApp)` }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ── 1. Charge la conversation ────────────────────────────────────────
  const { data: conv, error: errConv } = await supabase
    .from("whatsapp_conversations")
    .select("id, wa_id, status")
    .eq("id", conversation_id)
    .single();

  if (errConv || !conv) {
    return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
  }
  if (conv.status === "ARCHIVED" || conv.status === "SPAM") {
    return NextResponse.json({ error: `Impossible de répondre à une conversation ${conv.status}` }, { status: 409 });
  }

  // ── 2. Appel WhatsApp Cloud API ──────────────────────────────────────
  let sendResult;
  try {
    sendResult = await sendText({ to: conv.wa_id, body: text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("[whatsapp/reply] sendText error:", msg);
    return NextResponse.json({ error: `WhatsApp API : ${msg}` }, { status: 502 });
  }

  // ── 3. Insert le message OUTBOUND en BDD ─────────────────────────────
  const nowISO = new Date().toISOString();
  const { data: inserted, error: errIns } = await supabase
    .from("whatsapp_messages")
    .insert({
      conversation_id,
      wa_message_id: sendResult.wa_message_id,
      wa_id_contact: conv.wa_id,
      direction:     "OUTBOUND",
      type:          "text",
      text_body:     text,
      status:        "sent",
      replied_via:   "MANUAL",
      sent_at:       nowISO,
    })
    .select("id")
    .single();

  if (errIns) {
    // L'envoi WhatsApp a réussi mais le log BDD a planté — on remonte
    // l'erreur pour que l'admin sache. Le client a quand même reçu le message.
    return NextResponse.json({
      ok:            false,
      error:         `Message envoyé sur WhatsApp mais échec log BDD : ${errIns.message}`,
      wa_message_id: sendResult.wa_message_id,
    }, { status: 500 });
  }

  // ── 4. Reset unread_count + mark as read (best-effort) ───────────────
  await supabase
    .from("whatsapp_conversations")
    .update({ unread_count: 0, updated_at: nowISO })
    .eq("id", conversation_id);

  await supabase
    .from("whatsapp_messages")
    .update({ read_at: nowISO })
    .eq("conversation_id", conversation_id)
    .eq("direction", "INBOUND")
    .is("read_at", null);

  return NextResponse.json({
    ok:            true,
    message_id:    inserted.id,
    wa_message_id: sendResult.wa_message_id,
  });
}
