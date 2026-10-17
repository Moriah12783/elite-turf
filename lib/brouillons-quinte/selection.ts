/**
 * lib/brouillons-quinte/selection.ts — vocabulaire commun des brouillons.
 *
 * Depuis le 16/10/2026, la sélection vient d'Argon (composition-argon.ts) ; la
 * sélection « marché » (classement, découpe Pro, values Elite par la cote) a
 * été retirée.
 */
import type { ParticipantPmu } from "./pmu";

/** Chevaux attendus : 8 cotes PMU au moins (controlerDonneesPmu). */
export const TAILLE_SELECTION = 8;

export type Confiance = "FAIBLE" | "MOYEN" | "ELEVE";

function indexer(participants: ParticipantPmu[]): Record<number, ParticipantPmu> {
  const parNumero: Record<number, ParticipantPmu> = {};
  for (const p of participants) parNumero[p.numero] = p;
  return parNumero;
}

/**
 * PUR : partants de la base avec la cote et le statut du PMU (à appeler APRÈS
 * le contrôle d'identité). Le PMU fait foi : un cheval qu'il déclare partant
 * l'est, même si la base le dit non partant (spec §5). Absent du PMU → pas de
 * cote, donc pas classé, et le statut de la base est gardé.
 */
export function appliquerCotesPmu<T extends { numero: number; cote?: number | null; non_partant?: boolean | null }>(
  partantsBase: T[],
  participants: ParticipantPmu[],
): T[] {
  const parNumero = indexer(participants);
  return partantsBase.map((b) => {
    const pmu = parNumero[b.numero];
    return {
      ...b,
      cote: pmu ? pmu.cote : null,
      non_partant: pmu ? pmu.nonPartant : Boolean(b.non_partant),
    };
  });
}
