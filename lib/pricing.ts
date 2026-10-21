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

/**
 * Contenu du plan de jeu Elite — SOURCE UNIQUE des textes d'offre (FAQ,
 * bandeaux, e-mails, fiches à cases). Décision de Steph du 16/10/2026, avec les
 * brouillons préparés par Argon à T-90 (spec 2026-10-16-brouillons-argon) :
 * 8 chevaux, la base de 4, les values et les associés. Le couplé n'est pas
 * promis : Steph l'indique course par course.
 * Avant (06/10/2026) : « 6 chevaux, avec la base de 3 chevaux et les values ».
 */
export const PLAN_DE_JEU_ELITE =
  "8 chevaux, avec la base de 4 chevaux pour le champ réduit ou total, les values et les associés";
