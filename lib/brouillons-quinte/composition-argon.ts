/**
 * lib/brouillons-quinte/composition-argon.ts — PRO et ELITE à partir de
 * l'édition T-90 d'Argon (spec docs/superpowers/specs/2026-10-16-brouillons-argon-design.md, §8).
 *
 * Décisions de Steph du 16/10/2026 :
 * - PRO = les 4 bases d'Argon (le 1er est le pivot) + les 2 chevaux suivants en values ;
 * - ELITE = les mêmes 4 bases ; parmi les suivants, 3 values si au moins 3 ont
 *   un avantage positif, sinon 2 ; les autres sont associés ;
 * - le couplé n'est jamais posé : c'est Steph qui le choisit.
 */
import type { Confiance } from "./selection";

export interface CompositionArgon {
  pivot: number;
  bases: number[];
  valuesPro: number[];
  valuesElite: number[];
  associes: number[];
  /** Numéros de argon8 non partants selon le PMU, dans l'ordre d'Argon. */
  nonPartants: number[];
}

const NB_BASES = 4;
const NB_PRO = 6;

/**
 * PUR : composition des deux brouillons. `partants` = numéros partants selon le
 * PMU (ordre indifférent) ; un non-partant est retiré et les suivants remontent.
 */
export function composerArgon(
  argon8: number[],
  partants: number[],
  avantage: Record<number, number | null>,
): { ok: true; composition: CompositionArgon } | { ok: false; raison: "argon_partants_insuffisants" } {
  const P = argon8.filter((n) => partants.indexOf(n) !== -1);
  if (P.length < NB_PRO) return { ok: false, raison: "argon_partants_insuffisants" };

  const R = P.slice(NB_BASES);
  const av = (n: number): number => {
    const v = avantage[n];
    return typeof v === "number" ? v : -Infinity;
  };
  const nbPositifs = R.filter((n) => av(n) > 0).length;
  const nbValues = Math.min(nbPositifs >= 3 ? 3 : 2, R.length);
  const retenues = R
    .map((n, i) => ({ n, i }))
    .sort((a, b) => av(b.n) - av(a.n) || a.i - b.i)
    .slice(0, nbValues)
    .map((x) => x.n);

  return {
    ok: true,
    composition: {
      pivot: P[0],
      bases: P.slice(0, NB_BASES),
      valuesPro: P.slice(NB_BASES, NB_PRO),
      valuesElite: R.filter((n) => retenues.indexOf(n) !== -1),
      associes: R.filter((n) => retenues.indexOf(n) === -1),
      nonPartants: argon8.filter((n) => partants.indexOf(n) === -1),
    },
  };
}

/** PUR : confiance proposée selon les étoiles d'Argon (1 à 5). */
export function confianceArgon(etoiles: number): Confiance {
  if (etoiles >= 4) return "ELEVE";
  if (etoiles === 3) return "MOYEN";
  return "FAIBLE";
}
