/**
 * lib/sync/lonaci-programme.ts
 *
 * 3e VOIE DE SECOURS du programme : API LONACI (opérateur ivoirien, relaie le
 * PMU français + Maroc pour le marché africain). Reste accessible quand Geny
 * (429) ET PMU.fr (420) bloquent — constaté le 04/07.
 *
 * LONACI ne couvre que les réunions relayées en Afrique (Nationales + réunions
 * principales), ce qui correspond au périmètre d'Elite (Quinté+/Nationales,
 * France + Maroc). Pas de discipline dans le flux → catégorie PLAT par défaut
 * (corrigée ensuite par enrichir-partants si Geny/PMU reviennent).
 *
 * PUR → bundlable Node (fallback appelé par la CLI GitHub Actions).
 */
import { fetchLonaciProgramme, normalizeLonaciReunions } from "@/lib/lonaci-api";
import { upsertProgrammeCourses, type ProgrammeCourse } from "./programme-upsert";

export interface LonaciProgrammeSyncResult {
  inserted: number;
  updated: number;
  hippodromes: number;
  courses: number;
  reunions: number;
}

/**
 * Complète les paris disponibles à partir du numéro de Nationale LONACI
 * (`int_National_Number`), plus fiable que le mapping des codes de jeux : une
 * Nationale 1 EST un Quinté+ même si le code QNPC3 n'est pas listé dans le flux.
 * Indispensable pour que la détection « course vedette » (⊇ QUINTE_PLUS) marche.
 */
export function augmentParisFromNationale(paris: string[], nationale: number): string[] {
  const set: Record<string, boolean> = {};
  for (const p of paris) set[p] = true;
  if (nationale === 1) { set["QUINTE_PLUS"] = true; set["QUARTE_PLUS"] = true; set["TIERCE"] = true; }
  else if (nationale === 2) { set["QUARTE_PLUS"] = true; set["TIERCE"] = true; }
  else if (nationale === 3) { set["TIERCE"] = true; }
  return Object.keys(set);
}

/**
 * Charge le programme LONACI d'une date (France + Maroc) et l'upsert dans `courses`.
 * @param dateISO "YYYY-MM-DD"
 */
export async function runLonaciProgrammeSync(dateISO: string): Promise<LonaciProgrammeSyncResult> {
  const reunions = await fetchLonaciProgramme();
  const normalized = normalizeLonaciReunions(reunions);

  const courses: ProgrammeCourse[] = normalized
    .filter((c) => (c.pays === "France" || c.pays === "Maroc") && c.dateCourse === dateISO)
    .map((c) => ({
      hippodromeName:   c.hippodrome,
      hippodromePays:   c.pays,
      dateCourse:       c.dateCourse,
      heureDepart:      c.heureDepart,
      numeroReunion:    c.nReunion,
      numeroCourse:     c.numeroCourse,
      libelle:          c.libelle,
      distanceMetres:   c.distance,
      categorie:        "PLAT" as const, // LONACI ne fournit pas la discipline (fallback)
      nbPartants:       c.nbPartants,
      parisDisponibles: augmentParisFromNationale(c.parisDisponibles, c.nationale),
    }));

  const r = await upsertProgrammeCourses(courses);
  const reunionsCount = Array.from(new Set(courses.map((c) => c.numeroReunion))).length;
  return { ...r, courses: courses.length, reunions: reunionsCount };
}
