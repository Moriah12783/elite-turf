/**
 * Lecture des photos de la Sélection stats (avec leur course) et des
 * pronostics payants publiés, pour /admin/bilan-selection.
 * PostgREST tronque à 1 000 lignes : on pagine.
 */
import { createServiceClient } from "@/lib/supabase/server";
import type { PhotoSelection } from "@/lib/selection/historique";

const PAGE = 1000;

export type Niveau = "ELITE" | "PRO";

type Client = ReturnType<typeof createServiceClient>;

export async function chargerPhotos(supabase: Client): Promise<PhotoSelection[]> {
  const photos: PhotoSelection[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("selection_photos")
      .select("id, course_id, numeros, cotes_marche, nb_partants, source_cotes, prise_le, depart_prevu, course:courses(date_course, heure_depart, numero_reunion, numero_course, libelle, arrivee_officielle, hippodrome:hippodromes(nom))")
      .eq("version", "v2")
      .order("prise_le", { ascending: false })
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`selection_photos : ${error.message}`);
    for (const p of (data ?? []) as any[]) {
      const c = Array.isArray(p.course) ? p.course[0] : p.course;
      const h = Array.isArray(c?.hippodrome) ? c.hippodrome[0] : c?.hippodrome;
      photos.push({
        courseId:     p.course_id,
        numeros:      p.numeros ?? [],
        cotesMarche:  p.cotes_marche ?? {},
        nbPartants:   p.nb_partants,
        sourceCotes:  p.source_cotes,
        priseLe:      p.prise_le,
        departPrevu:  p.depart_prevu ?? null,
        date:         c?.date_course ?? null,
        heure:        c?.heure_depart ?? null,
        hippodrome:   h?.nom ?? null,
        reunion:      c?.numero_reunion ?? null,
        numeroCourse: c?.numero_course ?? null,
        libelle:      c?.libelle ?? null,
        arrivee:      Array.isArray(c?.arrivee_officielle) ? c.arrivee_officielle : [],
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return photos;
}

/** Sélection du pronostic payant publié, par course et par niveau. */
export async function chargerPronos(
  supabase: Client,
  courseIds: string[],
): Promise<Map<string, Partial<Record<Niveau, number[]>>>> {
  const map = new Map<string, Partial<Record<Niveau, number[]>>>();
  for (let i = 0; i < courseIds.length; i += 200) {
    const { data, error } = await supabase
      .from("pronostics")
      .select("course_id, niveau_acces, selection")
      .eq("publie", true)
      .in("niveau_acces", ["PRO", "ELITE"])
      .in("course_id", courseIds.slice(i, i + 200));
    if (error) throw new Error(`pronostics : ${error.message}`);
    for (const p of (data ?? []) as any[]) {
      const entree = map.get(p.course_id) ?? {};
      entree[p.niveau_acces as Niveau] = ((p.selection ?? []) as unknown[]).map(Number).filter(Number.isFinite);
      map.set(p.course_id, entree);
    }
  }
  return map;
}
