/**
 * GET /api/courses/[id]/cotes
 * Retourne les côtes temps réel depuis l'API PMU pour une course donnée.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchPmuPartants } from "@/lib/pmu-api";

interface RouteParams { params: { id: string } }

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = createServiceClient();

  // 1. Récupérer les infos de la course depuis Supabase
  const { data: course, error } = await supabase
    .from("courses")
    .select("id, date_course, numero_reunion, numero_course, statut")
    .eq("id", params.id)
    .single();

  if (error || !course) {
    return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  }

  // 2. Construire le dateStr PMU (YYYYMMDD)
  const dateStr = course.date_course.replace(/-/g, "");

  try {
    // 3. Appel PMU Open Data API
    const participants = await fetchPmuPartants(
      dateStr,
      course.numero_reunion,
      course.numero_course,
    );

    if (participants.length === 0) {
      return NextResponse.json({ cotes: [], source: "pmu", message: "Côtes non encore disponibles pour cette course" });
    }

    // 4. Normaliser + trier par côte croissante (favori en premier)
    const cotes = participants
      .filter((p) => !p.nom?.includes("NON_PARTANT"))
      .map((p) => ({
        numero:     p.numPmu,
        nom:        p.nom,
        cote:       p.coteDefinitive ?? p.coteProbable ?? p.dernierRapportDirect?.rapport ?? null,
        jockey:     p.jockey?.nom ?? null,
        entraineur: p.entraineur?.nom ?? null,
        placeCorde: p.placeCorde ?? null,
        poids:      p.handicapPoids ?? p.poids ?? null,
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
