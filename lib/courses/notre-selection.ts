/**
 * lib/courses/notre-selection.ts
 *
 * « Sélection stats » : short-list GRATUITE et déterministe de 8 chevaux par
 * course. Ce N'EST PAS le pronostic premium Elite Turf (3 courses/jour,
 * analyse experte) — c'est une aide à la lecture, présente sur chaque course
 * qui a des cotes.
 *
 * v2 (02/10/2026) : LE CLASSEMENT SUIT LA COTE PMU.
 * Mesuré sur 2 108 courses françaises (juillet-septembre 2026), avec les
 * statistiques connues AVANT chaque course : l'ancienne note composite (35 %
 * cote, 30 % victoires du cheval, 20 % musique, 15 % jockey, bonus de
 * réputation) faisait MOINS bien que les 8 plus petites cotes PMU — gagnant
 * parmi les 8 : 90,7 % contre 93,7 % ; 3 premiers : 62,8 % contre 68,4 % ;
 * 5 premiers : 33,1 % contre 37,9 %. Même en laissant la cote décider et la
 * forme seulement départager, on ne battait pas l'ordre du marché.
 * Donc : la cote classe, la forme et les acteurs deviennent des étiquettes
 * d'information. Sans cote fiable (Maroc, veille de course) : pas de sélection
 * plutôt qu'une liste au hasard.
 *
 * Pur, sans I/O, sans LLM : testable et calculable au rendu serveur.
 */

import type { PartantEnrichi } from "./stats-types";
import { isEliteDriver, isRecognizedTrainer } from "@/lib/turf/reputation";

export type SelectionLabel =
  | "Favori marché"
  | "Bonne forme"
  | "Driver reconnu"
  | "Entraîneur reconnu"
  | "Outsider"
  | "Bien coté";

export interface NotreSelectionItem {
  rank: number;
  numero: number;
  nom: string;
  jockey: string | null;
  cote: number | null;
  label: SelectionLabel;
}

const TARGET_SIZE = 8;
/** « Bonne forme » : au moins la moitié de podiums sur au moins 3 courses. */
const FORME_MIN_COURSES = 3;
const FORME_MIN_RATIO = 0.5;
const COTE_OUTSIDER = 10;

function aUneCote(p: PartantEnrichi): p is PartantEnrichi & { cote: number } {
  return typeof p.cote === "number" && p.cote > 0;
}

/**
 * Construit la sélection : les 8 plus petites cotes (tout le champ coté s'il
 * est plus petit), la note composite ne servant qu'à départager les cotes
 * égales. Les non-partants doivent être exclus en amont. Vide si moins de la
 * moitié du champ a une cote.
 */
export function buildNotreSelection(partants: PartantEnrichi[]): NotreSelectionItem[] {
  if (!partants || partants.length === 0) return [];
  const cotes = partants.filter(aUneCote);
  if (cotes.length === 0 || cotes.length * 2 < partants.length) return [];

  return cotes
    .sort((a, b) =>
      a.cote - b.cote ||
      (b.score_composite ?? 0) - (a.score_composite ?? 0) ||
      a.numero - b.numero)
    .slice(0, TARGET_SIZE)
    .map((p, i) => ({
      rank: i + 1,
      numero: p.numero,
      nom: p.nom_cheval,
      jockey: p.jockey ?? null,
      cote: p.cote,
      label: i === 0 ? "Favori marché" : pickLabel(p),
    }));
}

/** Étiquette d'information (ordre de priorité explicite). */
function pickLabel(p: PartantEnrichi & { cote: number }): SelectionLabel {
  const forme = p.forme_musique;
  if (forme && forme.courses >= FORME_MIN_COURSES && forme.ratio >= FORME_MIN_RATIO) return "Bonne forme";
  if (isEliteDriver(p.jockey)) return "Driver reconnu";
  if (isRecognizedTrainer(p.entraineur)) return "Entraîneur reconnu";
  if (p.cote >= COTE_OUTSIDER) return "Outsider";
  return "Bien coté";
}

/**
 * Règle d'affichage des blocs promo « Sélection stats » (bandeau + encart).
 * Visible pour TOUS dès qu'une sélection existe : c'est une plus-value (lecture
 * des 30-60+ courses du jour) y compris pour les abonnés, dont le pronostic
 * premium ne couvre que 3 courses/jour. Masqué si la course n'a pas de
 * sélection (pas encore de partants, ou pas de cote fiable).
 */
export function shouldShowNotreSelectionPromo(items: NotreSelectionItem[]): boolean {
  return !!items && items.length > 0;
}
