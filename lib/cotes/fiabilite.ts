/**
 * lib/cotes/fiabilite.ts
 *
 * Une série de cotes est-elle une vraie cote de marché ?
 *
 * Deux valeurs par défaut se faisaient passer pour des cotes (constat du
 * 02/10/2026, ~7 600 lignes en base) :
 *  - la LONACI renvoie « 1,2 » pour chaque cheval quand elle n'a pas de cote
 *    (93 % des courses marocaines) ;
 *  - une masse sans aucun pari affiche la même cote pour tous (0,85 × N :
 *    3,4 à 4 partants, 10,5 à 12).
 *
 * En pari mutuel réel, la somme des probabilités implicites (Σ 1/cote) vaut
 * environ 1 + le prélèvement : de 1,05 à 1,21 sur 2 754 courses PMU (max 1,59).
 *
 * PUR : utilisable à l'écriture (syncs) comme à l'affichage.
 */

/** Au-delà, la série n'est pas une cote de marché (le PMU réel plafonne à 1,59). */
export const SOMME_PROBA_MAX = 2;
/** En dessous, trop peu de cotes pour juger : on ne tranche pas. */
export const MIN_COTES_POUR_JUGER = 4;

/**
 * false si les cotes d'une course sont toutes identiques ou si la somme de leurs
 * probabilités dépasse SOMME_PROBA_MAX. Passer les cotes des seuls partants
 * (non-partants exclus) ; les valeurs absentes ou invalides sont ignorées.
 */
export function cotesPlausibles(cotes: ReadonlyArray<unknown>): boolean {
  const valides: number[] = [];
  for (const c of cotes) {
    const n = Number(c);
    if (c !== null && c !== undefined && c !== "" && Number.isFinite(n) && n > 0) valides.push(n);
  }
  if (valides.length < MIN_COTES_POUR_JUGER) return true;
  if (valides.every((c) => c === valides[0])) return false;
  let somme = 0;
  for (const c of valides) somme += 1 / c;
  return somme <= SOMME_PROBA_MAX;
}
