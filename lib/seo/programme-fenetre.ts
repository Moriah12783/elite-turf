/**
 * Sort d'une page `/programme/[date]` : indexable, masquée à Google, ou 404.
 *
 * AVANT (jusqu'au 17/09/2026) : toute date hors de [J-90, J+30] renvoyait 404,
 * « SEO-friendly » selon le commentaire d'origine. Mesuré en Search Console :
 * l'effet était l'INVERSE, dans les deux sens.
 *   - Passé : 142 journées AVEC de vraies courses (ex. le 19/05/2026, 36 courses)
 *     renvoyaient 404 — et une de plus basculait chaque jour. On détruisait du
 *     contenu que Google avait déjà indexé.
 *   - Futur : 29 journées SANS aucune course répondaient en 200 avec une page
 *     vide, quasi identique d'un jour à l'autre → classées « page en double ».
 *
 * RÈGLE : c'est le CONTENU qui décide, pas la distance à aujourd'hui.
 *   - au moins une course affichable  → indexable, quelle que soit la date ;
 *   - aucune course, date proche       → servie (la navigation par date reste
 *     utilisable) mais masquée à Google (noindex) ;
 *   - aucune course, date lointaine    → 404 (pas d'espace d'URL infini).
 *
 * PUR, ES5-safe (pas d'Intl, pas de Map/Set).
 */

/** Jours passés pendant lesquels une date SANS course reste navigable. */
export const FENETRE_PASSE_JOURS = 90;
/** Jours futurs pendant lesquels une date SANS course reste navigable. */
export const FENETRE_FUTUR_JOURS = 30;

export type SortPageProgramme = "indexable" | "noindex" | "introuvable";

/** Écart en jours entiers entre deux dates `YYYY-MM-DD` (b - a), en UTC. */
export function ecartJours(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

/**
 * @param date        date de la page, `YYYY-MM-DD` (déjà validée)
 * @param aujourdhui  date du jour, `YYYY-MM-DD` (fuseau Paris côté appelant)
 * @param nbCourses   nombre de courses RÉELLEMENT affichées (après filtre
 *                    d'éligibilité) — c'est ce que Google verra.
 */
export function sortPageProgramme(
  date: string,
  aujourdhui: string,
  nbCourses: number,
): SortPageProgramme {
  if (nbCourses > 0) return "indexable";
  const ecart = ecartJours(aujourdhui, date);
  const dansFenetre = ecart >= -FENETRE_PASSE_JOURS && ecart <= FENETRE_FUTUR_JOURS;
  return dansFenetre ? "noindex" : "introuvable";
}
