import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  const admin = createServiceClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  }
  return { user, admin };
}

/**
 * GET /api/admin/consensus/drafts       → brouillons en attente (draft + reviewed)
 * GET /api/admin/consensus/drafts?id=x  → un brouillon (pour pré-remplir l'atelier)
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const { data, error } = await auth.admin.from("consensus_drafts").select("*").eq("id", id).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Brouillon introuvable" }, { status: 404 });
    return NextResponse.json({ draft: data });
  }

  const { data, error } = await auth.admin
    .from("consensus_drafts")
    .select("id, date_course, reunion_course, hippodrome, nb_partants, course_id, run_type, type_pari, nb_sources, echantillon_reduit, citations, commentaires, status, created_at")
    .in("status", ["draft", "reviewed"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[drafts] list", error);
    return NextResponse.json({ drafts: [] });
  }
  return NextResponse.json({ drafts: data ?? [] });
}

/**
 * PATCH /api/admin/consensus/drafts  { id, status: 'reviewed'|'rejected'|'published' }
 * Transitions de la machine à états, déclenchées par l'admin.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const id = typeof body?.id === "string" ? body.id : "";
  const status = body?.status;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  if (["reviewed", "rejected", "published"].indexOf(status) === -1) {
    return NextResponse.json({ error: "status invalide" }, { status: 400 });
  }

  const { error } = await auth.admin
    .from("consensus_drafts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[drafts] patch", error);
    return NextResponse.json({ error: "Erreur mise à jour" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
