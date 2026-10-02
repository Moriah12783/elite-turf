/**
 * lib/cotes/cotes-du-moment.ts
 *
 * Cotes « du moment » pour la fiche course : quand la course part dans l'heure,
 * celles du CSV PMU (alimenté par l'Apps Script, rafraîchi chaque minute dans
 * les 20 dernières minutes) remplacent celles de la base, qui ne sont
 * rafraîchies que 3 fois par jour. La Sélection stats suit ainsi le marché au
 * moment où il bouge le plus.
 */
import { resolvePmuCote, sameHorse, type PmuCoteRow } from "./pmu-csv";
import { cotesPlausibles } from "./fiabilite";

const AVANT_MIN = 60;
const APRES_MIN = 15;

/** PUR : la course part dans l'heure (ou est partie depuis moins de 15 min). */
export function fenetreCotesDuMoment(depart: Date | null, maintenant: number = Date.now()): boolean {
  if (!depart) return false;
  const minutes = (depart.getTime() - maintenant) / 60000;
  return minutes <= AVANT_MIN && minutes >= -APRES_MIN;
}

/**
 * PUR : applique les cotes du CSV (clé `réunion|course|num`) aux partants d'une
 * course. Garde-fous : même cheval (nom) sinon la cote de la base reste ;
 * résultat non plausible (cf. fiabilite.ts) → partants inchangés.
 */
export function appliquerCotesCsv<T extends { numero: number; nom_cheval: string; cote: number | null; non_partant?: boolean | null }>(
  partants: T[], reunion: number, course: number, csv: Map<string, PmuCoteRow>,
): T[] {
  let remplacees = 0;
  const maj = partants.map((p) => {
    const row = csv.get(`${reunion}|${course}|${p.numero}`);
    if (!row || !sameHorse(p.nom_cheval, row.cheval)) return p;
    const cote = resolvePmuCote(row);
    if (cote == null) return p;
    remplacees++;
    return { ...p, cote };
  });
  if (remplacees === 0) return partants;
  return cotesPlausibles(maj.filter((p) => !p.non_partant).map((p) => p.cote)) ? maj : partants;
}
