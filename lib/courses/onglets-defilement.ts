/**
 * lib/courses/onglets-defilement.ts
 *
 * Barre d'onglets de la fiche course : sur téléphone, les 6 onglets (703 px)
 * ne tiennent pas dans la barre (342 px) et défilent sans barre visible. Ces
 * fonctions PURES disent de quel côté il reste des onglets hors de vue, pour
 * afficher un indice (dégradé + flèche). Aucun import : chargé côté navigateur.
 */

/** En dessous, l'écart vient des arrondis du navigateur : aucun onglet n'est réellement caché. */
const TOLERANCE_PX = 2;

export interface MesuresBarre {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

/** PUR : reste-t-il des onglets hors de vue à gauche, à droite ? */
export function bordsCaches(m: MesuresBarre): { gauche: boolean; droite: boolean } {
  if (!(m.clientWidth > 0) || m.scrollWidth - m.clientWidth <= TOLERANCE_PX) return { gauche: false, droite: false };
  return {
    gauche: m.scrollLeft > TOLERANCE_PX,
    droite: m.scrollLeft + m.clientWidth < m.scrollWidth - TOLERANCE_PX,
  };
}

/** PUR : de combien avancer quand on appuie sur la flèche. */
export function pasDeDefilement(clientWidth: number): number {
  return Math.max(120, Math.round((clientWidth * 2) / 3));
}
