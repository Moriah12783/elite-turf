/**
 * lib/live/selection-result.ts
 *
 * Évalue, en direct et de façon PURE, la performance de NOTRE base (le cheval
 * n°1 d'un pronostic Elite Turf) face à l'arrivée officielle, et agrège le
 * score du jour. Métrique simple, honnête et défendable sur tous les types de
 * pari : « notre base a-t-elle gagné (1ʳᵉ) / a-t-elle été placée (top 3) ? ».
 *
 * On ne tente PAS d'évaluer une combinaison Tiercé/Quinté complète (ordre /
 * désordre) en v1 : trop complexe et source d'erreurs. La base suffit pour un
 * tableau de bord live crédible.
 */

export interface SelectionOutcome {
  base: number | null; // notre cheval n°1 (selection[0])
  gagnant: boolean; // base arrivée 1ʳᵉ
  place: boolean; // base dans le top 3 (inclut les gagnants)
}

export function evaluateBaseVsArrivee(
  selection: number[] | null | undefined,
  arrivee: number[] | null | undefined,
): SelectionOutcome {
  const base = selection && selection.length > 0 ? selection[0] : null;
  if (base == null || !arrivee || arrivee.length === 0) {
    return { base, gagnant: false, place: false };
  }
  return {
    base,
    gagnant: arrivee[0] === base,
    place: arrivee.slice(0, 3).includes(base),
  };
}

export interface Scoreboard {
  joues: number; // courses terminées où l'on avait un pronostic
  gagnants: number; // base arrivée 1ʳᵉ
  places: number; // base dans le top 3
}

export function buildScoreboard(outcomes: SelectionOutcome[]): Scoreboard {
  return outcomes.reduce<Scoreboard>(
    (acc, o) => ({
      joues: acc.joues + 1,
      gagnants: acc.gagnants + (o.gagnant ? 1 : 0),
      places: acc.places + (o.place ? 1 : 0),
    }),
    { joues: 0, gagnants: 0, places: 0 },
  );
}
