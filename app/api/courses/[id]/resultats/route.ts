/**
 * GET /api/courses/[id]/resultats
 * Retourne l'arrivée officielle + les rapports PMU complets + commentaire.
 * Utilisé par CourseTabsClient onglet "Arrivées & Rapports".
 *
 * Sources, par ordre de priorité :
 *  1. Table `arrivees` (rapports_pmu JSONB scrapé depuis Geny + commentaire)
 *     → Source principale post-2026-05-07. Couvre TOUS les types de paris.
 *  2. API PMU (legacy, peu fiable)
 *  3. Champ courses.arrivee_officielle (fallback minimal sans rapports)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchPmuResultats } from "@/lib/pmu-api";
import {
  jsonbRapportsToRapportsList,
  type Rapport,
} from "@/lib/rapports-pmu-format";

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

  // 1. Récupérer la course + ses partants + arrivees enrichie (rapports JSONB)
  const { data: course, error } = await supabase
    .from("courses")
    .select(`
      id, date_course, numero_reunion, numero_course,
      statut, arrivee_officielle,
      partants(numero, nom_cheval, jockey, cote),
      arrivees(ordre_arrivee, rapports_pmu, commentaire, horodatage)
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

  // L'arrivée enrichie est stockée dans la table `arrivees` (1 row par course
  // si déjà scrapée). Le champ `arrivees` peut être un array ou objet selon
  // la cardinalité Supabase — on normalise.
  const arriveeRow = Array.isArray((course as any).arrivees)
    ? ((course as any).arrivees[0] ?? null)
    : ((course as any).arrivees ?? null);

  // 2. Source principale : table `arrivees` (Geny scrape) si présente
  let arrivee: number[] = arriveeRow?.ordre_arrivee
    ?? course.arrivee_officielle
    ?? [];
  let rapports: Rapport[] = jsonbRapportsToRapportsList(
    arriveeRow?.rapports_pmu ?? null,
    arrivee,
  );
  const commentaire: string | null = arriveeRow?.commentaire ?? null;
  let source: "geny-scrape" | "pmu" | "supabase" =
    arriveeRow?.rapports_pmu ? "geny-scrape"
    : arrivee.length > 0      ? "supabase"
    : "supabase";

  // 3. Si on n'a aucun rapport (pas de scrape encore), on tente PMU API
  if (rapports.length === 0) {
    try {
      const pmuResultat = await fetchPmuResultats(
        dateStr,
        course.numero_reunion,
        course.numero_course,
      );

      if (pmuResultat) {
        if (pmuResultat.arrivee.length > 0 && arrivee.length === 0) {
          arrivee = pmuResultat.arrivee;
        }
        const pmuRapports = (pmuResultat.rapports ?? [])
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
        if (pmuRapports.length > 0) {
          rapports = pmuRapports;
          source   = "pmu";
        }
      }
    } catch {
      // API PMU indisponible, on continue avec ce qu'on a
    }
  }

  // 4. Enrichir l'arrivée avec les noms de chevaux
  const arriveeEnrichie = arrivee.slice(0, 5).map((num: number, idx: number) => ({
    position: idx + 1,
    numero:   num,
    nom:      partantsMap[num] ?? null,
  }));

  return NextResponse.json({
    arrivee:     arriveeEnrichie,
    rapports,
    commentaire,
    source,
    statut:      course.statut,
    updatedAt:   arriveeRow?.horodatage ?? new Date().toISOString(),
  });
}
