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
import { fetchLonaciProgramme, normalizeLonaciReunions, type NormalizedLonaciCourse } from "@/lib/lonaci-api";
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
 * LONACI publie ses heures en GMT (heure d'Abidjan) ; la base, elle, est à
 * l'heure de Paris comme Geny et le PMU. Vérifié le 25/09/2026 sur l'API
 * officielle PMU : Prix Austria = 20:15 heure de Paris, 18:15 dans le flux
 * LONACI. Écrire l'heure brute décalait chaque course insérée de 1 à 2 h.
 *
 * PUR. « 00:00:00 » = heure absente du flux (cf. normalizeLonaciReunions) :
 * laissée telle quelle plutôt que transformée en une fausse heure.
 */
export function gmtVersParis(dateISO: string, heureGmt: string): { date: string; heure: string } {
  const inchange = { date: dateISO, heure: heureGmt };
  if (heureGmt === "00:00:00") return inchange;
  const instant = new Date(dateISO + "T" + heureGmt + "Z");
  if (isNaN(instant.getTime())) return inchange;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(instant);
  const val = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const heure = val("hour") === "24" ? "00" : val("hour");
  return {
    date:  val("year") + "-" + val("month") + "-" + val("day"),
    heure: heure + ":" + val("minute") + ":" + val("second"),
  };
}

/** PUR : courses LONACI normalisées → lignes du programme (heure de Paris). */
export function lonaciVersProgramme(normalized: NormalizedLonaciCourse[], dateISO: string): ProgrammeCourse[] {
  return normalized
    .filter((c) => (c.pays === "France" || c.pays === "Maroc") && c.dateCourse === dateISO)
    .map((c) => {
      const paris = gmtVersParis(c.dateCourse, c.heureDepart);
      return {
        hippodromeName:   c.hippodrome,
        hippodromePays:   c.pays,
        dateCourse:       paris.date,
        heureDepart:      paris.heure,
        numeroReunion:    c.nReunion,
        numeroCourse:     c.numeroCourse,
        libelle:          c.libelle,
        distanceMetres:   c.distance,
        categorie:        "PLAT" as const, // LONACI ne fournit pas la discipline (fallback)
        nbPartants:       c.nbPartants,
        parisDisponibles: augmentParisFromNationale(c.parisDisponibles, c.nationale),
      };
    });
}

/**
 * Charge le programme LONACI d'une date (France + Maroc) et l'upsert dans `courses`.
 * @param dateISO "YYYY-MM-DD"
 */
export async function runLonaciProgrammeSync(dateISO: string): Promise<LonaciProgrammeSyncResult> {
  const reunions = await fetchLonaciProgramme();
  const courses = lonaciVersProgramme(normalizeLonaciReunions(reunions), dateISO);

  const r = await upsertProgrammeCourses(courses);
  const reunionsCount = Array.from(new Set(courses.map((c) => c.numeroReunion))).length;
  return { ...r, courses: courses.length, reunions: reunionsCount };
}
