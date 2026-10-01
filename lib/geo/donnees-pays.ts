/**
 * Données du jour des pages pays migrées (brief « pages pays », §3).
 *
 * - Quinté+ du jour : `chargerJourQuinte` (même règle que l'accueil et
 *   /quinte-plus : Nationale 1 LONACI d'abord, puis QUINTE_PLUS).
 * - Programme de l'opérateur : seules les Nationales de la LONACI sont connues
 *   (synchro LONACI) — la Côte d'Ivoire est le seul pays couvert.
 *
 * `cache()` : métadonnées et page partagent la même requête.
 */
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import type { CourseOperateur } from "@/lib/geo/contenu-pays";

export { chargerJourQuinte } from "@/app/(public)/quinte-plus/donnees";

export const chargerNationalesDuJour = cache(async (date: string): Promise<CourseOperateur[]> => {
  const { data, error } = await createServiceClient()
    .from("courses")
    .select("nationale, libelle, heure_depart, numero_reunion, numero_course, statut, hippodrome:hippodromes(nom)")
    .eq("date_course", date)
    .in("nationale", [1, 2, 3])
    .order("nationale", { ascending: true });
  if (error || !data) return [];
  // Filtre en code : un `.neq("statut", "ANNULE")` écarterait aussi les statuts vides.
  return (data as (CourseOperateur & { statut: string | null })[]).filter((c) => c.statut !== "ANNULE");
});
