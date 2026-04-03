/**
 * GET /api/courses/[id]/cotes
 * Retourne les côtes temps réel depuis l'API PMU pour une course donnée.
 * Utilisé par le composant CourseTabsClient (onglet "Côtes en direct").
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchPmuPartants } from "@/lib/pmu-api";

interface RouteParams { params: { id: string } }

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = createServiceClient();

  // 1. Récupérer les infos de la course depuis Supabase (avec pays de l'hippodrome)
  const { data: course, error } = await supabase
    .from("courses")
    .select("id, date_course, numero_reunion, numero_course, statut, hippodrome:hippodromes(pays)")
    .eq("id", params.id)
    .single();

  if (error || !course) {
    return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  }

  // 2. Les côtes temps réel ne sont disponibles que pour les courses françaises (API PMU)
  //    Les courses LONACI/Afrique n'ont pas de flux côtes en direct
  const pays: string = (course.hippodrome as any)?.pays ?? "France";
  const isFrench = pays === "France" || pays === "FRA" || pays === "FR";

  if (!isFrench) {
    return NextResponse.json({
      cotes: [],
      source: "lonaci",
      message: `Côtes en direct non disponibles pour les courses ${pays} (LONACI). Consultez le site de la LONACI ou PMU-CI pour les rapports.`,
    });
  }

  // 3. Construire le dateStr PMU (YYYYMMDD)
  const dateStr = course.date_course.replace(/-/g, "");

  try {
    // 4. Appel PMU Open Data API
    const participants = await fetchPmuPartants(
      dateStr,
      course.numero_reunion,
      course.numero_course,
    );

    if (participants.length === 0) {
      return NextResponse.json({ cotes: [], source: "pmu", message: "Côtes non disponibles pour cette course" });
    }

    // 5. Normaliser + trier par côte croissante (favori en premier)
    const cotes = participants
      .filter((p) => !p.nom?.includes("NON_PARTANT"))
      .map((p) => ({
        numero:    p.numPmu,
        nom:       p.nom,
        cote:      p.coteDefinitive ?? p.coteProbable ?? p.dernierRapportDirect?.rapport ?? null,
        jockey:    p.jockey?.nom ?? null,
        entraineur: p.entraineur?.nom ?? null,
        placeCorde: p.placeCorde ?? null,
        poids:     p.handicapPoids ?? p.poids ?? null,
      }))
      .sort((a, b) => {
        if (a.cote === null) return 1;
        if (b.cote === null) return -1;
        return a.cote - b.cote;
      });

    return NextResponse.json({
      cotes,
      source: "pmu",
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "API PMU indisponible", detail: err?.message },
      { status: 503 },
    );
  }
}
