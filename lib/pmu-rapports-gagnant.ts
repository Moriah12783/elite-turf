/**
 * lib/pmu-rapports-gagnant.ts
 *
 * Helper pour calculer le `rapport_gagnant` d'un pronostic à partir des
 * rapports PMU complets stockés dans `arrivees.rapports_pmu` (JSONB).
 *
 * Logique :
 *  - Type de pari + résultat → quelle clé du JSONB pioche-t-on ?
 *  - On privilégie le rapport "désordre" pour les paris d'ordre (Tiercé,
 *    Quarté+, Quinté+) car nos sélections couvrent N+ chevaux : l'utilisateur
 *    récupère statistiquement le rapport désordre, pas l'ordre exact.
 *  - Pour les Bonus (Quinté+ partiel) on essaie bonus4 → bonus3.
 *  - Pour Couplé Placé / Simple Placé, on prend le 1er montant (1-2)
 *    qui est le rapport le plus typique.
 *
 * Renvoie le rapport en EUR (ex: 45.00) ou null si rien d'applicable.
 */

import type { RapportsPMU } from "@/lib/sync/geny-rapports-parser";

export type PronosticResultat = "GAGNANT" | "PARTIEL" | "PERDANT" | "EN_ATTENTE";

/**
 * Calcule le rapport gagnant pour un pronostic donné.
 *
 * @param typePari   Valeur de pronostics.type_pari (ex "QUINTE_PLUS")
 * @param resultat   Valeur de pronostics.resultat
 * @param rapports   Contenu de arrivees.rapports_pmu (JSONB) — peut être null
 * @returns          Rapport en EUR (45.00 = 45€) ou null
 */
export function computeRapportGagnant(
  typePari: string | null | undefined,
  resultat: PronosticResultat | null | undefined,
  rapports: RapportsPMU | null | undefined,
): number | null {
  if (!rapports || !typePari) return null;
  if (resultat === "EN_ATTENTE" || resultat === "PERDANT") return null;

  const tp = typePari.toUpperCase();

  // Helper : tente plusieurs clés et retourne la première trouvée
  const pick = (...vals: (number | undefined | null)[]): number | null => {
    for (const v of vals) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
    }
    return null;
  };

  switch (tp) {
    case "QUINTE_PLUS":
      if (resultat === "GAGNANT") {
        return pick(rapports.quinte_plus?.desordre, rapports.quinte_plus?.ordre);
      }
      // PARTIEL → bonus 4 chevaux trouvés sinon bonus 3
      return pick(rapports.quinte_plus?.bonus4, rapports.quinte_plus?.bonus3);

    case "QUARTE":
    case "QUARTE_PLUS":
      if (resultat === "GAGNANT") {
        return pick(rapports.quarte_plus?.desordre, rapports.quarte_plus?.ordre);
      }
      // PARTIEL Quarté+ → bonus 3 chevaux trouvés
      return pick(rapports.quarte_plus?.bonus);

    case "TIERCE":
      if (resultat === "GAGNANT") {
        return pick(rapports.tierce?.desordre, rapports.tierce?.ordre);
      }
      // Tiercé n'a pas de bonus officiel — partiel = pas de gain affichable
      return null;

    case "COUPLE_GAGNANT":
      return resultat === "GAGNANT" ? pick(rapports.couple_gagnant) : null;

    case "COUPLE_PLACE":
      // Premier montant (1-2) = rapport le plus typique pour Couplé Placé
      return pick(rapports.couple_place?.[0]);

    case "TRIO":
      // Trio = 3 premiers dans le désordre. Pas de bonus.
      return resultat === "GAGNANT" ? pick(rapports.trio) : null;

    case "SIMPLE_GAGNANT":
      return resultat === "GAGNANT" ? pick(rapports.simple_gagnant) : null;

    case "SIMPLE_PLACE":
      // Premier montant (1er placé) = rapport simple placé le plus haut
      return pick(rapports.simple_place?.[0]);

    case "DEUX_SUR_QUATRE":
    case "2SUR4":
      return resultat === "GAGNANT" ? pick(rapports.deux_sur_quatre) : null;

    case "MULTI":
      // Multi : on prend "en 4" (couverture la plus fréquente, plus gros rapport)
      if (resultat === "GAGNANT") {
        return pick(
          rapports.multi?.en_4,
          rapports.multi?.en_5,
          rapports.multi?.en_6,
          rapports.multi?.en_7,
        );
      }
      return null;

    default:
      return null;
  }
}
