/**
 * Données partagées des pages Quinté+ : la page pilier `/quinte-plus` et les
 * pages datées `/quinte-plus/[date]`.
 *
 * Le Quinté+ d'une date est identifié comme sur la home (`pickQuinteDuJour` :
 * Nationale 1 LONACI d'abord, puis QUINTE_PLUS). AVANT le 01/10/2026, seul
 * QUINTE_PLUS comptait : absent 14 jours sur 35 (pages passées en noindex) et
 * posé sur la MAUVAISE course 17 jours sur 35 (estimation GenyBet « plus gros
 * peloton »).
 *
 * `cache()` : métadonnées et page partagent la même requête Supabase.
 */
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import { pickQuinteDuJour } from "@/lib/turf/course-vedette";

export const chargerJourQuinte = cache(async (date: string) => {
  const { data, error } = await createServiceClient()
    .from("courses")
    .select("id, libelle, heure_depart, nationale, jouable_afrique, paris_disponibles, statut, hippodrome:hippodromes(nom, pays)")
    .eq("date_course", date);
  if (error) return { erreur: true, quinte: null as any, nbCoursesFrance: 0 };
  const courses = (data ?? []) as any[];
  const nbCoursesFrance = courses.filter(
    (c) => (Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome)?.pays === "France",
  ).length;
  return { erreur: false, quinte: pickQuinteDuJour(courses) as any, nbCoursesFrance };
});

export interface QuinteDuJourResume {
  date: string;
  id: string;
  libelle: string;
  hippodrome: string;
  heure_depart: string | null;
  statut: string | null;
  arrivee: number[] | null;
}

/**
 * Un Quinté+ par date sur [debut, fin] (bornes incluses), pour l'historique de
 * la page pilier. Une seule requête : les courses candidates (Nationale 1 ou
 * QUINTE_PLUS), puis le choix par date avec la même règle que partout ailleurs.
 */
export const chargerQuintesPeriode = cache(async (debut: string, fin: string): Promise<QuinteDuJourResume[]> => {
  const { data, error } = await createServiceClient()
    .from("courses")
    .select("id, date_course, libelle, heure_depart, nationale, jouable_afrique, paris_disponibles, statut, arrivee_officielle, hippodrome:hippodromes(nom, pays)")
    .gte("date_course", debut)
    .lte("date_course", fin)
    .or("nationale.eq.1,paris_disponibles.cs.{QUINTE_PLUS}");
  if (error || !data) return [];

  const parDate: Record<string, any[]> = {};
  for (const c of data as any[]) {
    (parDate[c.date_course] = parDate[c.date_course] || []).push(c);
  }
  return Object.keys(parDate)
    .sort((a, b) => b.localeCompare(a))
    .map((date) => {
      const q: any = pickQuinteDuJour(parDate[date]);
      if (!q) return null;
      const h = Array.isArray(q.hippodrome) ? q.hippodrome[0] : q.hippodrome;
      return {
        date,
        id: q.id,
        libelle: q.libelle,
        hippodrome: h?.nom ?? "",
        heure_depart: q.heure_depart ?? null,
        statut: q.statut ?? null,
        arrivee: Array.isArray(q.arrivee_officielle) && q.arrivee_officielle.length > 0 ? q.arrivee_officielle : null,
      };
    })
    .filter((x): x is QuinteDuJourResume => x !== null);
});
