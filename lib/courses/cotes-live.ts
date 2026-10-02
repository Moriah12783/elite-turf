/**
 * lib/courses/cotes-live.ts
 *
 * Rythme d'actualisation de l'onglet « Côtes en direct » (côté navigateur).
 * Calé sur le rythme réel du PMU, relevé le 02/10/2026 : environ une mise à
 * jour par quart d'heure loin du départ, toutes les 20 à 45 s dans la
 * dernière demi-heure, cote figée à la clôture.
 */

export const RAFRAICHISSEMENT_PROCHE_MS = 30 * 1000;
export const RAFRAICHISSEMENT_LOIN_MS = 5 * 60 * 1000;

/**
 * PUR : délai avant la prochaine actualisation (ms), null = plus besoin.
 * - dernière demi-heure, et jusqu'à 10 min après l'heure prévue (le départ
 *   réel peut glisser) : 30 s ;
 * - jusqu'à 2 h avant : 5 min ;
 * - au-delà, ou course partie depuis plus de 10 min : rien.
 */
export function delaiRafraichissement(departIso: string | null | undefined, maintenant: number = Date.now()): number | null {
  if (!departIso) return null;
  const depart = Date.parse(departIso);
  if (!Number.isFinite(depart)) return null;
  const minutes = (depart - maintenant) / 60000;
  if (minutes < -10) return null;
  if (minutes <= 30) return RAFRAICHISSEMENT_PROCHE_MS;
  if (minutes <= 120) return RAFRAICHISSEMENT_LOIN_MS;
  return null;
}
