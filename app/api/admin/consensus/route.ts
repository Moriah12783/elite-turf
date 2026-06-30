import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCourseStatsEnrichies } from "@/lib/courses/getCourseStatsEnrichies";
import { buildNotreSelection } from "@/lib/courses/notre-selection";

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
 * GET /api/admin/consensus
 *   ?date=YYYY-MM-DD   → liste les courses du jour (pour rattacher le consensus)
 *   ?courseId=<uuid>   → partants (numéro + cote + nom) de la course liée, pour
 *                        enrichir le consensus à NOTRE niveau (cote = PMU/Geny
 *                        déjà en base, jamais saisie par Cowork).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const courseId = req.nextUrl.searchParams.get("courseId");
  if (courseId) {
    const { data, error } = await auth.adminClient
      .from("partants")
      .select("id, numero, cote, nom_cheval, jockey, entraineur, musique, non_partant")
      .eq("course_id", courseId);
    if (error) { console.error("[consensus] partants", error); return NextResponse.json({ partants: [] }); }

    const runners = (data ?? []).filter((p: any) => !p.non_partant);

    // Sélection stats (réutilise le moteur public : score composite + réputation
    // driver/entraîneur). Deuxième couche de signal, à côté du consensus presse.
    const statByNumero: Record<number, { rank: number; label: string }> = {};
    try {
      const input = runners.map((p: any) => ({
        id:         p.id,
        numero:     p.numero,
        nom_cheval: p.nom_cheval ?? "",
        jockey:     p.jockey ?? null,
        entraineur: p.entraineur ?? null,
        cote:       p.cote != null ? Number(p.cote) : null,
        musique:    p.musique ?? null,
      }));
      const enrichies = await getCourseStatsEnrichies(input);
      buildNotreSelection(enrichies.partants).forEach((s) => {
        statByNumero[s.numero] = { rank: s.rank, label: s.label };
      });
    } catch (e) {
      console.error("[consensus] stats", e);
    }

    const partants = runners.map((p: any) => ({
      numero:    p.numero,
      cote:      p.cote != null && Number.isFinite(Number(p.cote)) ? Number(p.cote) : null,
      nom:       p.nom_cheval ?? null,
      statRank:  statByNumero[p.numero]?.rank ?? null,
      statLabel: statByNumero[p.numero]?.label ?? null,
    }));
    return NextResponse.json({ partants });
  }

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ courses: [] });

  const { data, error } = await auth.adminClient
    .from("courses")
    .select("id, libelle, numero_reunion, numero_course, nb_partants, paris_disponibles, heure_depart, hippodrome:hippodromes(nom)")
    .eq("date_course", date)
    .order("numero_reunion", { ascending: true })
    .order("numero_course", { ascending: true });
  if (error) return NextResponse.json({ courses: [] });

  const courses = (data ?? []).map((c: any) => ({
    id: c.id,
    libelle: c.libelle,
    numero_reunion: c.numero_reunion,
    numero_course: c.numero_course,
    nb_partants: c.nb_partants ?? null,
    paris_disponibles: Array.isArray(c.paris_disponibles) ? c.paris_disponibles : [],
    heure_depart: c.heure_depart ?? null,
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
      const out: { numero: number; citations: number; bases?: number; cote?: number; nom?: string } = { numero, citations };
      const bases = Number(p?.bases);
      if (Number.isFinite(bases) && p?.bases != null) out.bases = bases;
      const cote = Number(p?.cote);
      if (Number.isFinite(cote) && p?.cote != null) out.cote = cote;
      if (typeof p?.nom === "string" && p.nom.trim()) out.nom = p.nom.trim().slice(0, 60);
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
