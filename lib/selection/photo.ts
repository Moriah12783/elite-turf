/**
 * lib/selection/photo.ts
 *
 * Photo de la « Sélection stats » avant le départ (cron photo-selection, toutes
 * les 5 min) : chaque course est photographiée une fois, entre 15 et 5 minutes
 * avant l'heure prévue. Le bilan se calcule sur ces photos, jamais sur des
 * cotes relevées après coup (77 % des cotes en base datent d'après le départ,
 * constat du 02/10/2026).
 */

export const PHOTO_MIN_AVANT = 5;
export const PHOTO_MAX_AVANT = 15;

/** PUR : le départ prévu est dans 5 à 15 minutes. */
export function fenetrePhoto(depart: Date | null, maintenant: number = Date.now()): boolean {
  if (!depart) return false;
  const minutes = (depart.getTime() - maintenant) / 60000;
  return minutes >= PHOTO_MIN_AVANT && minutes <= PHOTO_MAX_AVANT;
}

/**
 * PUR : { numéro → cote } des partants cotés. Le marché complet au moment de la
 * photo permet ensuite de comparer n'importe quelle sélection (ex. le pronostic
 * payant) aux favoris de la même heure.
 */
export function cotesMarche(
  partants: Array<{ numero: number; cote: number | null; non_partant?: boolean | null }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of partants) {
    if (!p.non_partant && typeof p.cote === "number" && p.cote > 0) out[String(p.numero)] = p.cote;
  }
  return out;
}
