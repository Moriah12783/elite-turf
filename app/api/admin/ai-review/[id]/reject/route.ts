/**
 * POST /api/admin/ai-review/:id/reject
 *
 * Rejet manuel d'un draft IA. N'affecte PAS la table `pronostics` —
 * marque simplement le draft comme rejeté par l'admin (audit trail).
 *
 * Pipeline :
 *   1. Charger le draft
 *   2. UPDATE `ai_pronostic_drafts.human_review.decision = 'REJECTED'`
 *      avec commentaire admin obligatoire (pourquoi rejeté ?)
 *
 * 🔐 Auth : Bearer CRON_SECRET OU session admin
 *
 * 📦 Body : { human_comment: string }   ← obligatoire
 *
 * 📦 Response : { ok: true, draft_id: "..." }
 *
 * 📜 Conforme cahier §17.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";

export const dynamic     = "force-dynamic";
export const maxDuration = 10;

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  const draftId = ctx.params?.id;
  if (!draftId || !/^[0-9a-f-]{36}$/i.test(draftId)) {
    return NextResponse.json({ error: "id de draft invalide (UUID attendu)" }, { status: 400 });
  }

  let body: { human_comment?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  // Commentaire admin obligatoire pour rejet (pourquoi ?) → audit trail
  const comment = (body.human_comment ?? "").trim();
  if (comment.length < 3) {
    return NextResponse.json({ error: "human_comment requis (≥ 3 chars) pour audit du rejet" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Vérif d'existence + statut actuel
  const { data: draft, error: errDraft } = await supabase
    .from("ai_pronostic_drafts")
    .select("id, human_review")
    .eq("id", draftId)
    .single();

  if (errDraft || !draft) {
    return NextResponse.json({ error: `Draft introuvable : ${errDraft?.message ?? "not found"}` }, { status: 404 });
  }

  if (draft.human_review?.decision === "PUBLISHED") {
    return NextResponse.json({ error: "Ce draft est déjà publié — utiliser DELETE du pronostic publié pour le retirer" }, { status: 409 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  const adminUserId = user?.id ?? null;
  const nowISO = new Date().toISOString();

  const { error: errUpdate } = await supabase
    .from("ai_pronostic_drafts")
    .update({
      human_review: {
        edited_by:     adminUserId,
        edited_at:     nowISO,
        decision:      "REJECTED",
        human_comment: comment,
      },
      updated_at: nowISO,
    })
    .eq("id", draftId);

  if (errUpdate) {
    return NextResponse.json({ error: `UPDATE failed: ${errUpdate.message}` }, { status: 500 });
  }

  try { revalidatePath("/admin/pronostics/ai-review"); } catch { /* non bloquant */ }

  return NextResponse.json({ ok: true, draft_id: draftId });
}
