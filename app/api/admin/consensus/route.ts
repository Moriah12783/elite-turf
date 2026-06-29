import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/consensus
 * Enregistre une saisie de consensus presse (admin) dans `consensus_presse`.
 * Body : { meta:{ date_course, hippodrome, course, type_pari, nb_partants, nb_sources },
 *          partants:[{numero,citations,bases?,cote?}], resultat:{...} }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const adminClient = createServiceClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const meta = body?.meta || {};
  const partants = Array.isArray(body?.partants) ? body.partants : [];
  if (partants.length === 0) {
    return NextResponse.json({ error: "Aucun partant à enregistrer" }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from("consensus_presse")
    .insert({
      date_course: meta.date_course || null,
      hippodrome:  meta.hippodrome || null,
      course:      meta.course || null,
      type_pari:   meta.type_pari || null,
      nb_partants: meta.nb_partants ?? null,
      nb_sources:  meta.nb_sources ?? 0,
      partants,
      resultat:    body?.resultat ?? null,
      created_by:  user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[consensus] insert", error);
    return NextResponse.json({ error: "Erreur enregistrement" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}
