import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * PATCH /api/admin/courses/[id]
 * Mise à jour d'une course via service client (bypass RLS).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    if (!body.hippodrome_id || !body.libelle?.trim()) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    const { error } = await supabase
      .from("courses")
      .update(body)
      .eq("id", params.id);

    if (error) {
      console.error("[PATCH /api/admin/courses] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/admin/courses");
    revalidatePath("/courses");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[PATCH /api/admin/courses] Unexpected error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/courses/[id]
 * Supprime une course via service client (bypass RLS).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("courses").delete().eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    revalidatePath("/admin/courses");
    revalidatePath("/courses");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
