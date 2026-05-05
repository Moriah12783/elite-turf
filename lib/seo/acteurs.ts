/**
 * Helpers shared par /chevaux/[slug], /jockeys/[slug], /entraineurs/[slug].
 *
 * Stratégie de query :
 *   - Charger l'entité depuis sa table de référence (1 row par slug)
 *   - JOIN partants WHERE nom_cheval/jockey/entraineur = entité.nom
 *     Triplet (course → date, hippodrome, arrivee_officielle) en 1 query.
 *   - Calculer dernières courses + stats avancées (taux victoire, ROI, etc.)
 */

import { createServiceClient } from "@/lib/supabase/server";

export type EntiteType = "chevaux" | "jockeys" | "entraineurs";

export const COL_MAP: Record<EntiteType, "nom_cheval" | "jockey" | "entraineur"> = {
  chevaux:     "nom_cheval",
  jockeys:     "jockey",
  entraineurs: "entraineur",
};

export const ENTITE_LABEL: Record<EntiteType, { singular: string; plural: string }> = {
  chevaux:     { singular: "Cheval",     plural: "Chevaux"     },
  jockeys:     { singular: "Jockey",     plural: "Jockeys"     },
  entraineurs: { singular: "Entraîneur", plural: "Entraîneurs" },
};

export interface Entite {
  id:        string;
  nom:       string;
  slug:      string;
  nb_courses:         number | null;
  nb_victoires:       number | null;
  nb_places:          number | null;
  derniere_course_at: string | null;
  age?:               number | null;
  sexe?:              string | null;
}

export interface CourseLine {
  course_id:        string;
  date_course:      string;
  hippodrome_nom:   string | null;
  course_libelle:   string;
  numero_reunion:   number;
  numero_course:    number;
  numero:           number;       // numéro du partant
  cote:             number | null;
  jockey:           string | null;
  entraineur:       string | null;
  nom_cheval:       string | null;
  arrivee:          number | null; // position en arrivée (1, 2, 3, …) ou null
  statut:           string;
}

/** Récupère 1 entité par slug. */
export async function getEntiteBySlug(
  type: EntiteType,
  slug: string,
): Promise<Entite | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from(type)
    .select("id, nom, slug, nb_courses, nb_victoires, nb_places, derniere_course_at, age, sexe")
    .eq("slug", slug)
    .single();
  return (data as Entite) ?? null;
}

/**
 * Charge l'historique des courses (dernières N) pour une entité.
 * Pourquoi on stocke en référentiel + on requête partants : pas de FK
 * (pmu-sync inserts en bulk avec juste nom). Index sur partants.{col} rend
 * ce lookup ~1ms même sur 12k rows.
 */
export async function getCoursesForEntite(
  type: EntiteType,
  nom: string,
  limit = 50,
): Promise<CourseLine[]> {
  const col = COL_MAP[type];
  const supabase = createServiceClient();

  // Note : Supabase JS ne supporte pas proprement order sur foreign table
  // imbriquée avec .order("course(date_course)"). On récupère sans tri (cap 500
  // pour conserver la diversité), puis tri en mémoire ci-dessous.
  const { data } = await supabase
    .from("partants")
    .select(`
      numero, cote, jockey, entraineur, nom_cheval,
      course:courses!inner(
        id, date_course, statut, numero_reunion, numero_course, libelle, arrivee_officielle,
        hippodrome:hippodromes(nom)
      )
    `)
    .eq(col, nom)
    .limit(500);

  const lines = (data ?? []).map((row: any) => {
    const c = row.course;
    const hippo = Array.isArray(c?.hippodrome) ? c.hippodrome[0] : c?.hippodrome;
    let arrivee: number | null = null;
    if (Array.isArray(c?.arrivee_officielle) && c.arrivee_officielle.length > 0) {
      const idx = c.arrivee_officielle.indexOf(row.numero);
      arrivee = idx === -1 ? null : idx + 1;
    }
    return {
      course_id:        c.id,
      date_course:      c.date_course,
      hippodrome_nom:   hippo?.nom ?? null,
      course_libelle:   c.libelle,
      numero_reunion:   c.numero_reunion,
      numero_course:    c.numero_course,
      numero:           row.numero,
      cote:             row.cote,
      jockey:           row.jockey,
      entraineur:       row.entraineur,
      nom_cheval:       row.nom_cheval,
      arrivee,
      statut:           c.statut,
    } as CourseLine;
  });
  // Tri en mémoire par date_course desc, puis tronquage à `limit`
  lines.sort((a, b) => b.date_course.localeCompare(a.date_course));
  return lines.slice(0, limit);
}

/** Top entités par activité (pour pages index). */
export async function getTopEntites(
  type: EntiteType,
  limit = 100,
): Promise<Entite[]> {
  const supabase = createServiceClient();
  // Tri par activité récente (derniere_course_at DESC), puis par nb_courses
  const { data } = await supabase
    .from(type)
    .select("id, nom, slug, nb_courses, nb_victoires, nb_places, derniere_course_at")
    .order("derniere_course_at", { ascending: false, nullsFirst: false })
    .order("nb_courses",         { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as Entite[];
}

export function tauxVictoire(e: Pick<Entite, "nb_courses" | "nb_victoires">): number | null {
  if (!e.nb_courses || e.nb_courses === 0) return null;
  return ((e.nb_victoires ?? 0) / e.nb_courses) * 100;
}

export function tauxPlace(e: Pick<Entite, "nb_courses" | "nb_places">): number | null {
  if (!e.nb_courses || e.nb_courses === 0) return null;
  return ((e.nb_places ?? 0) / e.nb_courses) * 100;
}
