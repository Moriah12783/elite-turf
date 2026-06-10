/**
 * PATCH  /api/admin/temoignages/[id] — modération (statut pending/approved/rejected).
 * DELETE /api/admin/temoignages/[id] — suppression définitive.
 *
 * `approved` pose approved_at ; la home (PreuveSection, ISR 60s) n'affiche que
 * les approved — section témoignages masquée s'il n'y en a aucun.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";

const STATUTS = ["pending", "approved", "rejected"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    if (!STATUTS.includes(body.statut)) {
      return NextResponse.json({ error: "statut invalide" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("testimonials")
      .update({
        statut:      body.statut,
        approved_at: body.statut === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    revalidatePath("/admin/temoignages");
    revalidatePath("/");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erreur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  const supabase = createServiceClient();
  const { error } = await supabase.from("testimonials").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/admin/temoignages");
  revalidatePath("/");
  return NextResponse.json({ success: true });
}
