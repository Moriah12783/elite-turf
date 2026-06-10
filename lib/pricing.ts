/**
 * lib/pricing.ts
 *
 * Libellés marketing OFFICIELS de l'offre par plan — SOURCE UNIQUE.
 * Voir docs/audit-sprint1.md P2.
 *
 * Décision Sprint 1 : l'offre Starter officielle = « 1 pronostic expert par
 * jour (Tiercé / Quarté+) » pendant les 7 jours du pack. Les anciennes
 * formulations « 7 pronostics/semaine » (FAQ) et « 3 pronostics/semaine »
 * (seed DB legacy) sont retirées des surfaces utilisateur.
 *
 * PLAN_CONFIG (types/index.ts) reste la config structurée (prix, durées,
 * features détaillées des cartes). Ce fichier porte les libellés COURTS
 * partagés (FAQ, tableau comparatif…) pour empêcher toute nouvelle divergence :
 * toute surface qui décrit la cadence de pronostics DOIT importer d'ici.
 */

/** Phrase officielle de l'offre Starter (FAQ, contenus rédactionnels). */
export const STARTER_OFFRE_LABEL = "1 pronostic expert par jour (Tiercé / Quarté+)";

/** Ligne « Pronostics experts du jour » du tableau comparatif /abonnements. */
export const OFFRE_PRONOSTICS_EXPERTS = {
  free:    "—",
  starter: "1 / jour",
  pro:     "1+ quotidien",
  elite:   "1+ premium",
} as const;
