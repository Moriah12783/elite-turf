/**
 * lib/courses/allocations-course.ts
 *
 * Ce que l'onglet « Allocations » de la fiche course affiche, à partir des
 * performances PMU (lib/courses/performances-pmu.ts). Côté serveur uniquement.
 */
import { memesPartants } from "@/lib/pmu-cotes";
import type { ChevalPerformances } from "./performances-pmu";

export interface AllocationsCourse {
  /** Allocation de la course du jour (euros) ; null si inconnue. */
  allocationJour: number | null;
  /** Triés par numéro ; vide quand `message` est renseigné. */
  chevaux: ChevalPerformances[];
  message: string | null;
}

/**
 * PUR : ce que l'onglet affiche. (date, R, C) ne suffit pas à identifier une
 * course (cf. memesPartants) : si les chevaux du PMU ne sont pas les nôtres, on
 * n'affiche rien plutôt que l'historique d'une autre course.
 */
export function preparerAllocations(
  nomsBase: string[],
  chevaux: ChevalPerformances[],
  allocationJour: number | null,
): AllocationsCourse {
  if (!memesPartants(nomsBase, chevaux.map((c) => c.nom ?? ""))) {
    return { allocationJour, chevaux: [], message: "Les données PMU de cette course n'ont pas pu être identifiées avec certitude." };
  }
  if (!chevaux.some((c) => c.courses.length > 0)) {
    return { allocationJour, chevaux: [], message: "Le PMU ne donne pas l'historique des partants de cette course." };
  }
  return { allocationJour, chevaux: chevaux.slice().sort((a, b) => a.numero - b.numero), message: null };
}
