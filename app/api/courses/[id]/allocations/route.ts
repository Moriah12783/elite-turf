/**
 * GET /api/courses/[id]/allocations
 * Onglet « Allocations » de la fiche course : allocation et place des dernières
 * courses de chaque partant, d'après le PMU (5 courses au plus par cheval).
 *
 * Mêmes garde-fous que les cotes en direct : courses françaises du PMU,
 * contrôle que ce sont bien nos chevaux, et jamais de donnée de remplacement.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchPmuJson } from "@/lib/pmu-cotes";
import { isoVersDdmmyyyy } from "@/lib/sync/pmu-arrivees";
import { lireAllocationCoursePmu, lirePerformancesPmu } from "@/lib/courses/performances-pmu";
import { preparerAllocations } from "@/lib/courses/allocations-course";

interface RouteParams { params: { id: string } }

// L'historique d'un cheval ne change pas dans la journée : on évite de
// réinterroger le PMU à chaque ouverture de l'onglet.
const CACHE = { "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600" };

/** La réponse du PMU fait ~160 Ko : le délai par défaut (4 s) serait trop court. */
const DELAI_PMU_MS = 8000;

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = createServiceClient();

  const { data: course, error } = await supabase
    .from("courses")
    .select("id, date_course, numero_reunion, numero_course, hippodrome:hippodromes(pays), partants(nom_cheval)")
    .eq("id", params.id)
    .single();

  if (error || !course) {
    return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  }

  const c = course as any;
  const hippodrome = Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome;

  if (hippodrome?.pays && hippodrome.pays !== "France") {
    return NextResponse.json({
      allocationJour: null, chevaux: [],
      message: "L'historique des allocations n'est disponible que pour les courses françaises du PMU.",
    });
  }
  if (!c.numero_reunion || !c.numero_course) {
    return NextResponse.json({ allocationJour: null, chevaux: [], message: "Course non rattachée au programme PMU." });
  }

  const base = `/rest/client/1/programme/${isoVersDdmmyyyy(c.date_course)}/R${c.numero_reunion}/C${c.numero_course}`;
  const [jsonPerformances, jsonCourse] = await Promise.all([
    fetchPmuJson(`${base}/performances-detaillees/pretty`, DELAI_PMU_MS),
    fetchPmuJson(base, DELAI_PMU_MS),
  ]);
  if (jsonPerformances === null) {
    return NextResponse.json({ error: "Le PMU ne répond pas pour le moment." }, { status: 503 });
  }

  const nomsBase = ((c.partants ?? []) as { nom_cheval: string | null }[]).map((p) => p.nom_cheval ?? "");
  const resultat = preparerAllocations(
    nomsBase,
    lirePerformancesPmu(jsonPerformances),
    jsonCourse === null ? null : lireAllocationCoursePmu(jsonCourse),
  );

  // Un message (course non identifiée, pas d'historique) n'est pas mis en cache :
  // la situation peut se débloquer dans la journée.
  return NextResponse.json(resultat, resultat.message ? undefined : { headers: CACHE });
}
