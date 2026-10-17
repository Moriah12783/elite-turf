/**
 * lib/brouillons-quinte/selection.ts — vocabulaire commun des brouillons.
 *
 * Depuis le 16/10/2026, la sélection vient d'Argon (composition-argon.ts) ; la
 * sélection « marché » (classement, découpe Pro, values Elite par la cote) a
 * été retirée.
 */

/** Chevaux attendus : 8 cotes PMU au moins (controlerDonneesPmu). */
export const TAILLE_SELECTION = 8;

export type Confiance = "FAIBLE" | "MOYEN" | "ELEVE";
