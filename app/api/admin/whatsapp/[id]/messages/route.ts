/**
 * GET /api/admin/whatsapp/[id]/messages
 *
 * Récupère les messages d'une conversation (ordre chronologique).
 * Limit 500 derniers messages pour éviter de surcharger la UI.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  const id = ctx.params?.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id invalide" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id, conversation_id, wa_message_id, direction, type, text_body, media_caption, status, error_message, replied_via, received_at, meta_timestamp")
    .eq("conversation_id", id)
    .order("received_at", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}
