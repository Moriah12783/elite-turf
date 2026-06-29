import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireAdmin(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  const adminClient = createServiceClient();
  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  }
  return { user, adminClient };
}

/**
 * GET /api/admin/consensus?date=YYYY-MM-DD
 * Liste les courses du jour (pour rattacher le consensus à une course).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ courses: [] });

  const { data, error } = await auth.adminClient
    .from("courses")
    .select("id, libelle, numero_reunion, numero_course, hippodrome:hippodromes(nom)")
    .eq("date_course", date)
    .order("numero_reunion", { ascending: true })
    .order("numero_course", { ascending: true });
  if (error) return NextResponse.json({ courses: [] });

  const courses = (data ?? []).map((c: any) => ({
    id: c.id,
    libelle: c.libelle,
    numero_reunion: c.numero_reunion,
    numero_course: c.numero_course,
    hippodrome: c.hippodrome?.nom ?? null,
  }));
  return NextResponse.json({ courses });
}

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
  const rawPartants = Array.isArray(body?.partants) ? body.partants : [];
  if (rawPartants.length === 0) {
    return NextResponse.json({ error: "Aucun partant à enregistrer" }, { status: 400 });
  }

  // Anti-fabrication : un nombre de sources réel est requis (jamais 0/inventé).
  const nbSources = Number(meta.nb_sources);
  if (!Number.isFinite(nbSources) || nbSources < 1) {
    return NextResponse.json({ error: "Nombre de sources presse requis (≥ 1)" }, { status: 400 });
  }

  // Normalise/whitelist les partants (données ensuite affichées aux abonnés) + borne la taille.
  const partants = rawPartants
    .map((p: any) => {
      const numero = Number(p?.numero);
      const citations = Number(p?.citations);
      if (!Number.isFinite(numero) || !Number.isFinite(citations)) return null;
      const out: { numero: number; citations: number; bases?: number; cote?: number } = { numero, citations };
      const bases = Number(p?.bases);
      if (Number.isFinite(bases) && p?.bases != null) out.bases = bases;
      const cote = Number(p?.cote);
      if (Number.isFinite(cote) && p?.cote != null) out.cote = cote;
      return out;
    })
    .filter(Boolean)
    .slice(0, 40);

  if (partants.length === 0) {
    return NextResponse.json({ error: "Aucun partant valide" }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from("consensus_presse")
    .insert({
      date_course: meta.date_course || null,
      hippodrome:  meta.hippodrome || null,
      course:      meta.course || null,
      type_pari:   meta.type_pari || null,
      nb_partants: meta.nb_partants ?? null,
      nb_sources:  nbSources,
      course_id:   meta.course_id || null,
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
