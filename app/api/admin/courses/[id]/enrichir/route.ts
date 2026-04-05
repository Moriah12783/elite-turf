/**
 * POST /api/admin/courses/[id]/enrichir
 *
 * Enrichit les partants d'une course avec les données complètes de l'API PMU :
 *  - Cote de départ / cote en temps réel
 *  - Musique (historique des performances)
 *  - Poids / place à la corde
 *  - Jockey + entraîneur
 *  - Âge / sexe du cheval
 *
 * Utilisé par le skill Elite Turf pour préparer l'analyse pré-course.
 * Peut aussi être déclenché manuellement depuis l'admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchPmuPartants } from "@/lib/pmu-api";

export const dynamic = "force-dynamic";

interface RouteParams { params: { id: string } }

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const supabase = createServiceClient();

  // 1. Récupérer la course
  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, date_course, numero_reunion, numero_course, libelle, statut, hippodrome:hippodromes(nom)")
    .eq("id", params.id)
    .single();

  if (courseErr || !course) {
    return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  }

  if (course.statut === "ANNULE") {
    return NextResponse.json({ error: "Course annulée — enrichissement ignoré" }, { status: 400 });
  }

  // 2. Appel API PMU via fetchPmuPartants
  const dateStr = course.date_course.replace(/-/g, ""); // YYYYMMDD
  let participants;
  try {
    participants = await fetchPmuPartants(
      dateStr,
      course.numero_reunion,
      course.numero_course,
    );
  } catch (err: any) {
    return NextResponse.json({ error: `API PMU indisponible: ${err?.message}` }, { status: 503 });
  }

  if (!participants || participants.length === 0) {
    return NextResponse.json({
      ok: false,
      message: "Aucun partant retourné par l'API PMU — données pas encore disponibles",
      courseId: params.id,
    });
  }

  // 3. Upsert partants enrichis dans la table partants
  const toUpsert = participants
    .filter((p) => !p.nom?.toUpperCase().includes("NON_PARTANT"))
    .map((p) => ({
      course_id:   params.id,
      numero:      p.numPmu,
      nom_cheval:  p.nom,
      jockey:      p.jockey?.nom ?? null,
      entraineur:  p.entraineur?.nom ?? null,
      cote:        p.coteDefinitive ?? p.coteProbable ?? p.dernierRapportDirect?.rapport ?? null,
      musique:     p.musique ?? null,
      poids_kg:    p.handicapPoids ?? p.poids ?? null,
      place_corde: p.placeCorde ?? null,
      age:         p.age ?? null,
      sexe:        p.sexe ?? null,
      non_partant: false,
      scraped_at:  new Date().toISOString(),
    }));

  // Supprimer les anciens + réinsérer (enrichissement complet)
  await supabase.from("partants").delete().eq("course_id", params.id);
  const { error: insErr } = await supabase.from("partants").insert(toUpsert);

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Mettre à jour nb_partants
  await supabase
    .from("courses")
    .update({ nb_partants: toUpsert.length })
    .eq("id", params.id);

  revalidatePath(`/admin/courses/${params.id}`);
  revalidatePath("/admin/courses");

  // 4. Retourner les données enrichies (pour usage direct par le skill)
  const enriched = toUpsert.map((p) => ({
    n:          p.numero,
    nom:        p.nom_cheval,
    cote:       p.cote ?? "N/D",
    musique:    p.musique ?? "—",
    poids:      p.poids_kg ? `${p.poids_kg}kg` : "—",
    jockey:     p.jockey ?? "—",
    entraineur: p.entraineur ?? "—",
    age:        p.age ?? "—",
    sexe:       p.sexe ?? "—",
    corde:      p.place_corde ?? "—",
  }));

  // Trier par cote croissante (favori en premier)
  enriched.sort((a, b) => {
    const ca = typeof a.cote === "number" ? a.cote : 999;
    const cb = typeof b.cote === "number" ? b.cote : 999;
    return ca - cb;
  });

  const hippNom = Array.isArray(course.hippodrome)
    ? course.hippodrome[0]?.nom
    : (course.hippodrome as any)?.nom ?? "—";

  return NextResponse.json({
    ok:          true,
    courseId:    params.id,
    libelle:     course.libelle,
    hippodrome:  hippNom,
    date:        course.date_course,
    nbPartants:  toUpsert.length,
    partants:    enriched,
    source:      "PMU API",
    enrichedAt:  new Date().toISOString(),
  });
}

// GET = même chose (pour appel depuis le skill)
export async function GET(req: NextRequest, ctx: RouteParams) {
  return POST(req, ctx);
}
