/**
 * GET /api/courses/[id]/resultats
 * Retourne l'arrivée officielle + les rapports (dividendes) PMU.
 * Utilisé par CourseTabsClient onglet "Arrivées & Rapports".
 *
 * Priorité : données Supabase (plus fiables si déjà sync) → API PMU
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchPmuResultats, fetchPmuPartants } from "@/lib/pmu-api";

interface RouteParams { params: { id: string } }

export const dynamic = "force-dynamic";

// Labels lisibles pour les types de paris PMU
const PARI_LABELS: Record<string, string> = {
  SIMPLE_GAGNANT:       "Simple Gagnant",
  SIMPLE_PLACE:         "Simple Placé",
  COUPLE_GAGNANT:       "Couplé Gagnant",
  COUPLE_PLACE:         "Couplé Placé",
  COUPLE_ORDRE:         "Couplé Ordre",
  TIERCE:               "Tiercé",
  QUARTE_PLUS:          "Quarté+",
  QUINTE_PLUS:          "Quinté+",
  MULTI:                "Multi",
  DEUX_SUR_QUATRE:      "2 sur 4",
  TRIO:                 "Trio",
  PICK5:                "Pick 5",
  SUPER4:               "Super 4",
};

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = createServiceClient();

  // 1. Récupérer la course + ses partants depuis Supabase
  const { data: course, error } = await supabase
    .from("courses")
    .select(`
      id, date_course, numero_reunion, numero_course,
      statut, arrivee_officielle,
      partants(numero, nom_cheval, jockey, cote)
    `)
    .eq("id", params.id)
    .single();

  if (error || !course) {
    return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  }

  const dateStr = course.date_course.replace(/-/g, "");
  const partantsMap: Record<number, string> = {};
  for (const p of (course.partants as any[]) ?? []) {
    partantsMap[p.numero] = p.nom_cheval;
  }

  // 2. Si la course est terminée et qu'on a déjà l'arrivée en base
  //    on essaie quand même PMU pour avoir les rapports
  let arrivee: number[] = course.arrivee_officielle ?? [];
  let rapports: any[]   = [];
  let source = "supabase";

  try {
    const pmuResultat = await fetchPmuResultats(
      dateStr,
      course.numero_reunion,
      course.numero_course,
    );

    if (pmuResultat) {
      source = "pmu";
      if (pmuResultat.arrivee.length > 0) arrivee = pmuResultat.arrivee;

      // Nettoyer + enrichir les rapports
      rapports = (pmuResultat.rapports ?? [])
        .filter((r: any) => r.dividendes?.length > 0)
        .map((r: any) => ({
          typePari: r.typePari,
          label:    PARI_LABELS[r.typePari] ?? r.typePari,
          dividendes: (r.dividendes ?? []).map((d: any) => ({
            combinaison: d.combinaison,
            // PMU retourne les rapports en centimes × 10 → /10 = €
            rapport: typeof d.rapport === "number" ? Math.round(d.rapport / 10) / 10 : null,
          })),
        }));
    }
  } catch {
    // API PMU indisponible, on continue avec les données Supabase
  }

  // 3. Enrichir l'arrivée avec les noms de chevaux
  const arriveeEnrichie = arrivee.slice(0, 5).map((num: number, idx: number) => ({
    position: idx + 1,
    numero:   num,
    nom:      partantsMap[num] ?? null,
  }));

  return NextResponse.json({
    arrivee: arriveeEnrichie,
    rapports,
    source,
    statut:    course.statut,
    updatedAt: new Date().toISOString(),
  });
}
