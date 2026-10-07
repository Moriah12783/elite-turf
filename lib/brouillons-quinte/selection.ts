/**
 * lib/brouillons-quinte/selection.ts — Pro, Elite et confiance (spec §6).
 *
 * Les 8 favoris arrivent déjà dans l'ordre du marché (buildNotreSelection, le
 * même que la Sélection stats du site). Pro = rangs 1 à 6 ; Elite = la même
 * base de 3 + 3 values choisies parmi les rangs 4 à 8 (décision de Steph du
 * 07/10/2026).
 */
import type { NotreSelectionItem } from "@/lib/courses/notre-selection";
import type { ParticipantPmu } from "./pmu";
import { analyserMusique } from "./musique";

export const TAILLE_SELECTION = 8;
/** Écarté des values Elite à partir de 2 fautes sur les 5 dernières courses. */
export const FAUTES_ECARTEMENT = 2;

export interface ChevalClasse {
  /** Rang au marché (1 = favori). */
  rang: number;
  numero: number;
  /** Nom tel que le PMU l'écrit. */
  nom: string;
  cote: number;
  /** Fautes sur les 5 dernières courses ; 0 si la musique est inconnue. */
  fautes: number;
}

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

/** PUR : les favoris classés, avec le nom PMU et les fautes de la musique PMU. */
export function versChevauxClasses(top8: NotreSelectionItem[], participants: ParticipantPmu[]): ChevalClasse[] {
  const parNumero = indexer(participants);
  const out: ChevalClasse[] = [];
  for (const it of top8) {
    if (typeof it.cote !== "number") continue;
    const pmu = parNumero[it.numero];
    const bilan = analyserMusique(pmu ? pmu.musique : null);
    out.push({ rang: it.rank, numero: it.numero, nom: pmu ? pmu.nom : it.nom, cote: it.cote, fautes: bilan ? bilan.fautes : 0 });
  }
  return out;
}

export interface DecoupePro {
  pivot: number;
  base: number[];
  values: number[];
}

/** PUR : base = rangs 1 à 3, values = rangs 4 à 6. null sous 6 chevaux. */
export function decouperPro(classes: ChevalClasse[]): DecoupePro | null {
  if (classes.length < 6) return null;
  const tries = classes.slice().sort((a, b) => a.rang - b.rang);
  return {
    pivot: tries[0].numero,
    base: tries.slice(0, 3).map((c) => c.numero),
    values: tries.slice(3, 6).map((c) => c.numero),
  };
}

export interface ChoixElite {
  pivot: number;
  base: number[];
  /** Par rang croissant. */
  values: number[];
  /** Fautifs que la règle « plus grosses cotes » aurait retenus sans leurs fautes. */
  ecartes: number[];
  /** Moins de 3 values sans fautes : complété avec des fautifs. */
  completeAvecFautifs: boolean;
}

/** PUR : la règle des values Elite (spec §6.2). null sous 8 chevaux. */
export function choisirValuesElite(classes: ChevalClasse[]): ChoixElite | null {
  if (classes.length < TAILLE_SELECTION) return null;
  const tries = classes.slice().sort((a, b) => a.rang - b.rang);
  const candidats = tries.slice(3, TAILLE_SELECTION);

  const retenus = candidats
    .filter((c) => c.fautes < FAUTES_ECARTEMENT)
    .sort((a, b) => b.cote - a.cote || a.fautes - b.fautes || a.rang - b.rang)
    .slice(0, 3);

  let completeAvecFautifs = false;
  if (retenus.length < 3) {
    const fautifs = candidats
      .filter((c) => c.fautes >= FAUTES_ECARTEMENT)
      .sort((a, b) => a.fautes - b.fautes || b.cote - a.cote || a.rang - b.rang);
    for (let i = 0; i < fautifs.length && retenus.length < 3; i++) {
      retenus.push(fautifs[i]);
      completeAvecFautifs = true;
    }
  }

  const numerosRetenus = retenus.map((c) => c.numero);
  const sansRegle = candidats.slice().sort((a, b) => b.cote - a.cote || a.rang - b.rang).slice(0, 3);
  const ecartes = sansRegle
    .filter((c) => c.fautes >= FAUTES_ECARTEMENT && numerosRetenus.indexOf(c.numero) === -1)
    .sort((a, b) => a.rang - b.rang)
    .map((c) => c.numero);

  return {
    pivot: tries[0].numero,
    base: tries.slice(0, 3).map((c) => c.numero),
    values: retenus.slice().sort((a, b) => a.rang - b.rang).map((c) => c.numero),
    ecartes,
    completeAvecFautifs,
  };
}

/** PUR : confiance selon la cote du favori (décision de Steph du 07/10/2026). */
export function confianceDuMarche(coteFavori: number): Confiance {
  if (coteFavori < 3) return "ELEVE";
  if (coteFavori <= 6) return "MOYEN";
  return "FAIBLE";
}
