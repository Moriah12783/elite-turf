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

export const OFFRE_ELITE_STARTER: OffrePromotionnelle = {
  actif: true,
  debut: "2026-08-01",
  fin: "2026-08-05",
};

/**
 * L'offre est-elle en cours ?
 *
 * `fin` est INCLUSE : une offre annoncée « du 1er au 5 août » doit rester
 * valable toute la journée du 5.
 */
export function offreEliteStarterActive(
  maintenant: Date,
  offre: OffrePromotionnelle = OFFRE_ELITE_STARTER,
): boolean {
  if (!offre.actif) return false;
  const jour = maintenant.toISOString().slice(0, 10);
  return jour >= offre.debut && jour <= offre.fin;
}
