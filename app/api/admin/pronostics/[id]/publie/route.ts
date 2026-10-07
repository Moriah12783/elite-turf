import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";

/**
 * PATCH /api/admin/pronostics/[id]/publie
 * Bascule le statut publié/brouillon d'un pronostic.
 * Utilise le service client (bypass RLS) : réservé aux admins (session admin
 * ou Bearer CRON_SECRET). Le middleware ne protège que les pages /admin, pas
 * /api/admin : sans cette vérification, n'importe qui pouvait publier ou
 * dépublier un pronostic à partir de son identifiant (constat du 07/10/2026).
 * Body: { publie: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const supabase = createServiceClient();
    const { publie } = await req.json();

    if (typeof publie !== "boolean") {
      return NextResponse.json({ error: "Le champ publie doit être un booléen" }, { status: 400 });
    }

    const { error } = await supabase
      .from("pronostics")
      .update({
        publie,
        date_publication: publie ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (error) {
      console.error("[PATCH /api/admin/pronostics/publie] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/admin/pronostics");
    revalidatePath("/pronostics");

    return NextResponse.json({ success: true, publie });
  } catch (err: any) {
    console.error("[PATCH /api/admin/pronostics/publie] Unexpected error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
