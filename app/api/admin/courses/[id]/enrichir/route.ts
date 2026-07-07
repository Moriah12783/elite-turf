/**
 * POST /api/admin/courses/[id]/enrichir  (bouton « Enrichir PMU » de l'admin)
 *
 * Rafraîchit les COTES des partants d'une course depuis le CSV public PMU
 * (Google Apps Script, IP Google NON bloquée — contrairement à l'API PMU
 * directe qui renvoie 420 à l'IP du Worker/Azure d'Elite). Cotes = rapports
 * pari-mutuel unifiés (Masse Commune Internationale), justes pour l'Afrique.
 *
 * NB : le CSV ne porte que les cotes (num/cheval/statut/cote), pas la forme
 * (musique/jockey…). Les partants doivent déjà exister (créés par le cron
 * `enrichir-partants` / « Pré-remplir »). Ce bouton MET À JOUR leurs cotes.
 * Priorité : cote_directe > cote_reference ; NP/absente → cote NULL (jamais 1,2).
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchPmuCotesMap, resolvePmuCote, sameHorse } from "@/lib/cotes/pmu-csv";

export const dynamic = "force-dynamic";

interface RouteParams { params: { id: string } }

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const supabase = createServiceClient();

  // 1. Course (numéros réunion/course pour matcher le CSV)
  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, date_course, numero_reunion, numero_course, libelle, statut, hippodrome:hippodromes(nom)")
    .eq("id", params.id)
    .single();
  if (courseErr || !course) return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  if (course.statut === "ANNULE") {
    return NextResponse.json({ error: "Course annulée — enrichissement ignoré" }, { status: 400 });
  }

  // 2. Partants déjà en base (créés par le cron / GenyBet / LONACI)
  const { data: partants } = await supabase
    .from("partants")
    .select("id, numero, nom_cheval")
    .eq("course_id", params.id);
  if (!partants || partants.length === 0) {
    return NextResponse.json({
      ok: false,
      message: "Aucun partant en base pour cette course — lance d'abord « Pré-remplir » (ou le cron).",
      courseId: params.id,
    });
  }

  // 3. CSV cotes PMU (1 fetch pour tout le programme du jour)
  let pmuCotes;
  try {
    pmuCotes = await fetchPmuCotesMap(course.date_course); // cotes de la date de CETTE course
  } catch (err: any) {
    return NextResponse.json({ error: `CSV cotes PMU indisponible: ${err?.message}` }, { status: 503 });
  }

  const R = course.numero_reunion, C = course.numero_course;
  const covered = partants.some((p: { numero: number }) => pmuCotes.has(`${R}|${C}|${p.numero}`));
  if (!covered) {
    return NextResponse.json({
      ok: false,
      message: `Course R${R}C${C} non couverte par le CSV PMU (~40 courses PMU/jour) — cotes inchangées.`,
      courseId: params.id,
    });
  }

  // 4. Mise à jour des cotes par numéro (garde-fou nom anti-décalage)
  let updated = 0, indisponible = 0, mismatch = 0, pending = 0;
  const results: Array<{ n: number; nom: string; cote: number | string; source: string }> = [];

  for (const p of partants as Array<{ id: string; numero: number; nom_cheval: string }>) {
    const row = pmuCotes.get(`${R}|${C}|${p.numero}`);
    if (!row) {
      // Partant absent du CSV (rare) : on laisse sa cote existante inchangée.
      results.push({ n: p.numero, nom: p.nom_cheval, cote: "inchangée", source: "autre" });
      continue;
    }
    if (!sameHorse(p.nom_cheval ?? "", row.cheval)) {
      mismatch++;
      results.push({ n: p.numero, nom: p.nom_cheval, cote: "inchangée", source: `nom≠ (${row.cheval})` });
      continue;
    }
    const cote = resolvePmuCote(row); // number | null (NP ou cote pas encore ouverte → null)
    // PARTANT sans cote PMU encore publiée → on garde la cote existante (LONACI),
    // on ne la remplace PAS par « — ».
    if (cote == null && !row.nonPartant) {
      pending++;
      results.push({ n: p.numero, nom: p.nom_cheval, cote: "en attente", source: "pmu (cote non ouverte)" });
      continue;
    }
    await supabase.from("partants").update({ cote, non_partant: row.nonPartant }).eq("id", p.id);
    if (cote == null) { indisponible++; results.push({ n: p.numero, nom: p.nom_cheval, cote: "—", source: "NP" }); }
    else { updated++; results.push({ n: p.numero, nom: p.nom_cheval, cote, source: "pmu" }); }
  }

  revalidatePath(`/admin/courses/${params.id}`);
  revalidatePath("/admin/courses");

  const hippNom = Array.isArray(course.hippodrome)
    ? course.hippodrome[0]?.nom
    : (course.hippodrome as any)?.nom ?? "—";

  results.sort((a, b) => (typeof a.cote === "number" ? a.cote : 999) - (typeof b.cote === "number" ? b.cote : 999));

  return NextResponse.json({
    ok:          true,
    courseId:    params.id,
    libelle:     course.libelle,
    hippodrome:  hippNom,
    date:        course.date_course,
    updated,
    indisponible,
    mismatch,
    pending,
    source:      "CSV PMU (Masse Commune Internationale, ~1h)",
    partants:    results,
    enrichedAt:  new Date().toISOString(),
  });
}

// GET = même chose (pour appel depuis le skill)
export async function GET(req: NextRequest, ctx: RouteParams) {
  return POST(req, ctx);
}
