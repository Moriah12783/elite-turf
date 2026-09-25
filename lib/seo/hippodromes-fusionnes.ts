/**
 * Fiches d'hippodromes FUSIONNÉES — redirection permanente vers la fiche de
 * référence.
 *
 * Le 25/09/2026, 155 courses en double créées par la voie de secours LONACI
 * ont été fusionnées dans les vraies courses (sauvegarde : schéma `sauvegarde`,
 * tables `doublons_lonaci_20260925_*`). Les 3 fiches d'hippodromes qui ne
 * portaient que ces copies sont désactivées ; leurs adresses, déjà soumises à
 * Google par le sitemap, sont redirigées plutôt que laissées en 404.
 *
 * PUR, ES5-safe.
 */

/** slug de l'ancienne fiche → slug de la fiche de référence. */
export const HIPPODROMES_FUSIONNES: Record<string, string> = {
  "paris-vincennes": "vincennes",
  "pornichet":       "pornichet-la-baule",
  "mauquenchy":      "rouen-mauquenchy",
};

/** Routes publiques construites sur le slug d'un hippodrome. */
const PREFIXES = ["/hippodromes/", "/blog/decouvrir-hippodrome/"];

/** Chemin de redirection, ou null si l'adresse n'est pas une fiche fusionnée. */
export function redirectionHippodromeFusionne(pathname: string): string | null {
  for (let i = 0; i < PREFIXES.length; i++) {
    const prefixe = PREFIXES[i];
    if (pathname.indexOf(prefixe) !== 0) continue;
    const slug = pathname.slice(prefixe.length).replace(/\/$/, "");
    if (Object.prototype.hasOwnProperty.call(HIPPODROMES_FUSIONNES, slug)) {
      return prefixe + HIPPODROMES_FUSIONNES[slug];
    }
  }
  return null;
}
