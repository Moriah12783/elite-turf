/**
 * lib/promo/offre-elite-starter.ts
 *
 * Offre de lancement : tout pack STARTER souscrit pendant la fenêtre donne
 * l'accès ELITE sur toute sa durée (7 jours), sans supplément.
 *
 * ⚠️ Cette offre ne change AUCUN prix. Elle ne touche pas non plus au moteur
 * de paiement : l'élévation d'accès se fait sur `profiles.statut_abonnement`,
 * seul champ que `lib/auth/access.ts` consulte pour autoriser le niveau ELITE.
 * Ce module ne sert donc qu'à l'AFFICHAGE — savoir s'il faut annoncer l'offre.
 *
 * Fuseau : Abidjan est à UTC+0 toute l'année (pas d'heure d'été), donc comparer
 * les dates en UTC donne bien le jour local du porteur. C'est la seule raison
 * pour laquelle une comparaison de chaînes `YYYY-MM-DD` suffit ici.
 *
 * PUR, ES5-safe, testé.
 */

export interface OffrePromotionnelle {
  actif: boolean;
  /** Premier jour inclus, `YYYY-MM-DD`. */
  debut: string;
  /** Dernier jour INCLUS, `YYYY-MM-DD`. */
  fin: string;
}

/**
 * ⚠️ DEUX DURÉES À NE PAS CONFONDRE :
 *   - `debut`/`fin` = la FENÊTRE D'ÉLIGIBILITÉ, c'est-à-dire les jours pendant
 *     lesquels souscrire donne droit à l'offre. Ici 3 jours.
 *   - la durée de l'ACCÈS obtenu = celle du pack Starter, soit 7 jours, et elle
 *     ne dépend pas de la fenêtre. Souscrire le dernier jour de la promo donne
 *     quand même 7 jours pleins d'Elite ; la promo ne raccourcit jamais rien.
 *
 * Historique des campagnes :
 *   - 1er → 5 août 2026 (première édition)
 *   - 25 → 27 août 2026 (reconduction, 3 jours)
 */
export const OFFRE_ELITE_STARTER: OffrePromotionnelle = {
  actif: true,
  debut: "2026-08-25",
  fin: "2026-08-27",
};

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * Dernier jour de l'offre en toutes lettres — « 27 août » — pour l'afficher
 * sans jamais le recopier à la main.
 *
 * POURQUOI : lors de la reconduction du 25/08, la page /abonnements annonçait
 * encore « Jusqu'au 5 août » en dur alors que la fenêtre avait bougé. Un texte
 * figé finit toujours par mentir ; on le dérive de la config, source unique.
 * ES5-safe : découpage de la chaîne `YYYY-MM-DD`, pas de `Intl`.
 */
export function libelleFinOffre(offre: OffrePromotionnelle = OFFRE_ELITE_STARTER): string {
  const p = offre.fin.split("-");
  if (p.length !== 3) return offre.fin;
  const jour = Number(p[2]);
  const mois = MOIS_FR[Number(p[1]) - 1];
  if (!mois || !jour) return offre.fin;
  return (jour === 1 ? "1er" : String(jour)) + " " + mois;
}

/**
 * L'offre est-elle en cours ?
 *
 * `fin` est INCLUSE : une offre annoncée « du 25 au 27 août » doit rester
 * valable toute la journée du 27.
 */
export function offreEliteStarterActive(
  maintenant: Date,
  offre: OffrePromotionnelle = OFFRE_ELITE_STARTER,
): boolean {
  if (!offre.actif) return false;
  const jour = maintenant.toISOString().slice(0, 10);
  return jour >= offre.debut && jour <= offre.fin;
}
