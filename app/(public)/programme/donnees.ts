/**
 * Données partagées des pages programme : la page pilier `/programme` et les
 * pages datées `/programme/[date]`.
 */
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import { isCourseEligible, hasPariNational } from "@/lib/turf/course-eligibility";

/**
 * Courses AFFICHABLES d'une date (après filtre d'éligibilité) — c'est ce
 * nombre, et lui seul, qui décide du sort de la page (cf. programme-fenetre.ts).
 *
 * `cache()` : generateMetadata (pour poser ou non le noindex) et la page (pour
 * le rendu et le 404) ont besoin du même résultat dans la même requête — une
 * seule interrogation de Supabase au lieu de deux.
 */
export const chargerCoursesProgramme = cache(async (date: string) => {
  const supabase = createServiceClient();
  const { data: rawCourses } = await supabase
    .from("courses")
    .select(`
      id, numero_reunion, numero_course, libelle,
      date_course, heure_depart, distance_metres,
      categorie, terrain, nb_partants, statut, paris_disponibles,
      nationale, jouable_afrique,
      hippodrome:hippodromes(id, nom, pays, ville),
      pronostics(id, niveau_acces, publie)
    `)
    .eq("date_course", date)
    .neq("statut", "ANNULE")
    .order("heure_depart", { ascending: true });

  return (rawCourses || []).map((c: any) => ({
    ...c,
    hippodrome: Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome,
  })).filter((c: any) => isCourseEligible({
    hippodromeNom: c.hippodrome?.nom,
    nbPartants:    c.nb_partants,
    aPronostic:    c.pronostics?.some((p: any) => p.publie),
    aPariNational: hasPariNational(c.paris_disponibles),
  }));
});
