/**
 * lib/utils/format-pari.ts
 *
 * Helpers de formatting des type_pari et niveau_acces pour affichage UI.
 *
 * Côté DB on stocke des valeurs SCREAMING_SNAKE_CASE ("QUINTE_PLUS",
 * "QUARTE", "ELITE", etc.) qui sont moches à afficher tel quel.
 * Cette fonction les convertit en libellés humains lisibles ("Quinté+",
 * "Quarté+", "Elite", etc.).
 *
 * Utilisé dans : templates emails, pages admin, pages publiques.
 */

/** Map type_pari (DB) → libellé humain affiché. */
const TYPE_PARI_LABELS: Record<string, string> = {
  SIMPLE:       "Simple Gagnant",
  COUPLE:       "Couplé",
  TRIO:         "Trio",
  TIERCE:       "Tiercé",
  QUARTE:       "Quarté+",
  QUINTE_PLUS:  "Quinté+",
};

/**
 * Formate une valeur type_pari pour affichage public.
 *
 * @example
 *   formatTypePari("QUINTE_PLUS") // → "Quinté+"
 *   formatTypePari("TIERCE")      // → "Tiercé"
 *   formatTypePari("UNKNOWN")     // → "UNKNOWN" (fallback : retourne la valeur brute)
 */
export function formatTypePari(typePari: string | null | undefined): string {
  if (!typePari) return "Pari";
  return TYPE_PARI_LABELS[typePari] ?? typePari;
}

/** Map niveau_acces (DB) → libellé humain. */
const NIVEAU_ACCES_LABELS: Record<string, string> = {
  GRATUIT: "Gratuit",
  STARTER: "Starter",
  PRO:     "Pro",
  ELITE:   "Elite",
};

/**
 * Formate une valeur niveau_acces pour affichage public.
 *
 * @example
 *   formatNiveauAcces("ELITE") // → "Elite"
 */
export function formatNiveauAcces(niveau: string | null | undefined): string {
  if (!niveau) return "Pari";
  return NIVEAU_ACCES_LABELS[niveau] ?? niveau;
}
