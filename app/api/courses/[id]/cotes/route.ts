/**
 * GET /api/courses/[id]/cotes
 * Cotes PMU en direct d'une course (onglet « Côtes en direct »).
 *
 * Renvoie aussi `majPmu` (heure de la cote côté PMU) et `depart` (instant du
 * départ, calculé depuis l'heure de PARIS stockée en base) : l'onglet s'en sert
 * pour s'actualiser au rythme du PMU (cf. lib/courses/cotes-live.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchCotesPmu, memesPartants } from "@/lib/pmu-cotes";
import { parisVersUtc } from "@/lib/paris-date";

interface RouteParams { params: { id: string } }

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = createServiceClient();

  const { data: course, error } = await supabase
    .from("courses")
    .select("id, date_course, heure_depart, numero_reunion, numero_course, hippodrome:hippodromes(pays), partants(nom_cheval)")
    .eq("id", params.id)
    .single();

  if (error || !course) {
    return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  }

  const c = course as any;
  const departDate = c.heure_depart ? parisVersUtc(c.date_course, c.heure_depart) : null;
  const depart = departDate ? departDate.toISOString() : null;
  const hippodrome = Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome;

  if (hippodrome?.pays && hippodrome.pays !== "France") {
    return NextResponse.json({
      cotes: [], source: "hors-pmu", depart,
      message: "Les cotes en direct ne sont disponibles que pour les courses françaises du PMU.",
    });
  }
  if (!c.numero_reunion || !c.numero_course) {
    return NextResponse.json({ cotes: [], source: "pmu", depart, message: "Course non rattachée au programme PMU." });
  }

  const cotesPmu = await fetchCotesPmu(c.date_course, c.numero_reunion, c.numero_course);
  if (cotesPmu === null) {
    // `depart` permet à l'onglet de continuer à réessayer au même rythme
    // (panne PMU réelle le 02/10 vers 15:30 GMT : 504 pendant plus de 15 min).
    return NextResponse.json({ error: "Le PMU ne répond pas pour le moment.", depart }, { status: 503 });
  }

  // (date, R, C) ne suffit pas à identifier une course : on vérifie que ce
  // sont bien nos chevaux, sinon on afficherait les cotes d'une autre course.
  // Sans au moins 3 partants connus, on ne peut pas l'affirmer → rien.
  const nomsBase = ((c.partants ?? []) as { nom_cheval: string | null }[]).map((p) => p.nom_cheval ?? "");
  if (!memesPartants(nomsBase, cotesPmu.map((p) => p.nom))) {
    return NextResponse.json({
      cotes: [], source: "pmu", depart,
      message: "Les cotes PMU de cette course n'ont pas pu être identifiées avec certitude.",
    });
  }

  const partants = cotesPmu.filter((p) => !p.nonPartant);
  if (!partants.some((p) => p.cote)) {
    return NextResponse.json({ cotes: [], source: "pmu", depart, message: "Le PMU n'a pas encore publié de cote pour cette course." });
  }

  let majPmu = 0;
  for (const p of partants) if (p.coteMaj && p.coteMaj > majPmu) majPmu = p.coteMaj;

  const cotes = partants
    .map((p) => ({
      numero: p.numero,
      nom: p.nom,
      cote: p.cote,
      tendance: p.tendance,
      coteReference: p.coteReference,
      jockey: p.jockey,
    }))
    .sort((a, b) => {
      if (a.cote === null) return 1;
      if (b.cote === null) return -1;
      return a.cote - b.cote;
    });

  return NextResponse.json({
    cotes,
    source: "pmu",
    depart,
    majPmu: majPmu > 0 ? new Date(majPmu).toISOString() : null,
  });
}
