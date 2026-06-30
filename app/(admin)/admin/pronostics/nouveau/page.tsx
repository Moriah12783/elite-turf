import { createServiceClient } from "@/lib/supabase/server";
import NouveauPronosticClient from "./NouveauPronosticClient";

export default async function NouveauPronosticPage({
  searchParams,
}: {
  searchParams?: { courseId?: string; niveau_acces?: string; type_pari?: string; selection?: string; analyse_courte?: string; analyse_texte?: string };
}) {
  const supabase = createServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const { data: courses } = await supabase
    .from("courses")
    .select("id, libelle, date_course, heure_depart, hippodrome:hippodromes(nom)")
    .gte("date_course", weekAgo)
    .order("date_course", { ascending: false })
    .order("heure_depart", { ascending: true })
    .limit(60);

  // Pré-remplissage optionnel (depuis l'outil consensus → « Créer le pronostic »).
  const sp = searchParams || {};
  const hasParams = !!(sp.courseId || sp.niveau_acces || sp.type_pari || sp.selection || sp.analyse_courte || sp.analyse_texte);

  // Garantit que la course pré-remplie reste sélectionnable même hors fenêtre 7 j
  // (sinon le <select> afficherait "aucune course" alors que l'état la contient).
  let courseList: any[] = (courses as any) || [];
  if (sp.courseId && !courseList.some((c) => c.id === sp.courseId)) {
    const { data: extra } = await supabase
      .from("courses")
      .select("id, libelle, date_course, heure_depart, hippodrome:hippodromes(nom)")
      .eq("id", sp.courseId)
      .maybeSingle();
    if (extra) courseList = [extra, ...courseList];
  }

  const initialData = hasParams
    ? {
        course_id:      sp.courseId,
        niveau_acces:   sp.niveau_acces,
        type_pari:      sp.type_pari,
        analyse_courte: sp.analyse_courte,
        analyse_texte:  sp.analyse_texte,
        selection: sp.selection
          ? sp.selection.split(",").map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n) && n > 0)
          : undefined,
      }
    : undefined;

  return <NouveauPronosticClient courses={courseList} initialData={initialData} />;
}
