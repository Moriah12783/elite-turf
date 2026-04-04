import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * PATCH /api/admin/pronostics/[id]
 * Mise à jour d'un pronostic via service client (bypass RLS).
 * Protégé par vérification du rôle ADMIN.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    const {
      course_id, niveau_acces, type_pari, confiance,
      analyse_courte, analyse_texte, selection, publie,
      resultat, date_publication,
    } = body;

    // Validation minimale
    if (!course_id || !selection?.length || !analyse_courte) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("pronostics")
      .update({
        course_id,
        niveau_acces,
        type_pari,
        confiance,
        analyse_courte,
        analyse_texte,
        selection,
        publie,
        resultat,
        date_publication,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (error) {
      console.error("[PATCH /api/admin/pronostics] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[PATCH /api/admin/pronostics] Unexpected error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/pronostics/[id]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("pronostics").delete().eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
