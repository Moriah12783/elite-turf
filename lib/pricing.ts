/**
 * lib/pricing.ts
 *
 * Libellés marketing OFFICIELS de l'offre par plan — SOURCE UNIQUE.
 * Voir docs/audit-sprint1.md P2.
 *
 * Décision de Steph du 01/10/2026 : Starter = Pro sur 7 jours, avec le même
 * pronostic expert quotidien, à jouer en Tiercé, Quarté+ et Quinté+.
 * L'ancien libellé Starter « Tiercé / Quarté+ » sous-vendait l'offre, puisque
 * Starter accède au niveau PRO (lib/auth/access.ts), et le pronostic PRO du
 * jour EST le Quinté+.
 *
 * PLAN_CONFIG (types/index.ts) reste la config structurée (prix, durées,
 * features détaillées des cartes). Ce fichier porte les libellés COURTS
 * partagés (FAQ, pages pays, e-mails…) pour empêcher toute nouvelle
 * divergence : toute surface qui décrit la cadence de pronostics DOIT
 * importer d'ici.
 */

/** Pronostic expert du jour, identique pour Starter et Pro. */
const PRONOSTIC_EXPERT_DU_JOUR = "1 pronostic expert par jour (Tiercé, Quarté+, Quinté+)";

/** Phrase officielle de l'offre Starter (FAQ, pages pays, e-mail R3). */
export const STARTER_OFFRE_LABEL = PRONOSTIC_EXPERT_DU_JOUR;

/** Phrase officielle de l'offre Pro : la même que Starter, sur 30 jours. */
export const PRO_OFFRE_LABEL = PRONOSTIC_EXPERT_DU_JOUR;

/** Phrase officielle de l'offre Elite — reprise de PLAN_CONFIG (features). */
export const ELITE_OFFRE_LABEL = "Tout le Pack Pro + le plan de jeu Elite chaque jour";
