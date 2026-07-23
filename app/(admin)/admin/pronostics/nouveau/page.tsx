import { createServiceClient } from "@/lib/supabase/server";
import { ROLE_CHOICES } from "@/lib/pronostics/selection-roles";
import NouveauPronosticClient from "./NouveauPronosticClient";

/** "4,2,9" → [4, 2, 9] (entiers positifs, dédupliqués côté appelant). */
function parseNums(raw?: string): number[] {
  if (!raw) return [];
  return raw.split(",").map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n) && n > 0);
}

const ROLE_BASE  = ROLE_CHOICES.find((c) => c.key === "base")!.role;   // "BASE"
const ROLE_VALUE = ROLE_CHOICES.find((c) => c.key === "value")!.role;  // "OUTSIDER"
const ROLE_COUP  = ROLE_CHOICES.find((c) => c.key === "coup")!.role;   // "COUP"

export default async function NouveauPronosticPage({
  searchParams,
}: {
  searchParams?: {
    courseId?: string; niveau_acces?: string; type_pari?: string; selection?: string;
    analyse_courte?: string; analyse_texte?: string;
    base?: string; value?: string; coup?: string; pivot?: string;
  };
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

  // Rôles façon Radar transmis par l'outil consensus → pré-remplissage de la
  // hiérarchie (l'admin relit/ajuste). Un même n° ne peut porter qu'un rôle ;
  // priorité base > value > coup si le moteur le classait deux fois.
  const roles: Record<number, string> = {};
  for (const n of parseNums(sp.coup))  roles[n] = ROLE_COUP;
  for (const n of parseNums(sp.value)) roles[n] = ROLE_VALUE;
  for (const n of parseNums(sp.base))  roles[n] = ROLE_BASE;
  const pivotNum = parseInt(sp.pivot ?? "", 10);
  const pivot = Number.isFinite(pivotNum) && pivotNum > 0 ? pivotNum : null;
  const hasRoles = Object.keys(roles).length > 0;

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
        selection: sp.selection ? parseNums(sp.selection) : undefined,
        ...(hasRoles ? { roles, pivot } : {}),
      }
    : undefined;

  return <NouveauPronosticClient courses={courseList} initialData={initialData} />;
}
