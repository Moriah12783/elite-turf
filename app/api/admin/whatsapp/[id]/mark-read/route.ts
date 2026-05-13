/**
 * POST /api/admin/whatsapp/[id]/mark-read
 *
 * Marque tous les messages INBOUND d'une conversation comme lus.
 * Appelle aussi WhatsApp Cloud API pour mettre les "double checks bleus"
 * côté client (best-effort, n'échoue pas si Meta plante).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";
import { markAsRead } from "@/lib/whatsapp/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  const id = ctx.params?.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id invalide" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const nowISO   = new Date().toISOString();

  // 1. Récupère les wa_message_id des INBOUND non lus
  const { data: unreadMessages } = await supabase
    .from("whatsapp_messages")
    .select("wa_message_id")
    .eq("conversation_id", id)
    .eq("direction", "INBOUND")
    .is("read_at", null)
    .not("wa_message_id", "is", null)
    .limit(50);

  // 2. Mark them as read en BDD
  const { error: errUpdate } = await supabase
    .from("whatsapp_messages")
    .update({ read_at: nowISO })
    .eq("conversation_id", id)
    .eq("direction", "INBOUND")
    .is("read_at", null);

  if (errUpdate) {
    return NextResponse.json({ error: errUpdate.message }, { status: 500 });
  }

  // 3. Reset unread_count sur la conversation
  await supabase
    .from("whatsapp_conversations")
    .update({ unread_count: 0, updated_at: nowISO })
    .eq("id", id);

  // 4. Best-effort : envoie le "lu" à WhatsApp Cloud (max 5 messages)
  // pour économiser les appels API. Les autres seront marqués implicitement.
  const toMark = (unreadMessages ?? []).slice(0, 5);
  for (const msg of toMark) {
    if (msg.wa_message_id) {
      markAsRead({ message_id: msg.wa_message_id }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, marked: toMark.length });
}
