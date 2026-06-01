/**
 * lib/courses/notre-selection.ts
 *
 * « Notre sélection » : short-list GRATUITE et déterministe de 8 chevaux par
 * course, fondée sur les statistiques. Ce N'EST PAS le pronostic premium Elite
 * Turf (3 courses/jour, analyse senior) — c'est une aide à la lecture, présente
 * sur (presque) toutes les courses.
 *
 * Moteur : réutilise `score_composite` déjà calculé par getCourseStatsEnrichies
 * (0.35·cote + 0.30·hist. cheval + 0.20·musique + 0.15·hist. jockey), puis
 * ajoute un bonus de réputation driver/entraîneur. Le `score_composite` gère
 * déjà l'absence de cote (composante = 0) : pas de cote dans le champ ⇒ le
 * classement se fait naturellement sur forme + historique + réputation.
 *
 * Pur, sans I/O, sans LLM : testable et calculable au rendu serveur.
 */

import type { PartantEnrichi } from "./stats-types";
import { isEliteDriver, isRecognizedTrainer } from "@/lib/turf/reputation";

export type SelectionLabel =
  | "Favori marché"
  | "Driver reconnu"
  | "Entraîneur reconnu"
  | "Bonne forme"
  | "Outsider value"
  | "Régulier";

export interface NotreSelectionItem {
  rank: number;
  numero: number;
  nom: string;
  jockey: string | null;
  cote: number | null;
  label: SelectionLabel;
}

const TARGET_SIZE = 8;
const BONUS_DRIVER = 0.08; // grand driver/jockey : assez pour départager, pas pour renverser une vedette
const BONUS_TRAINER = 0.05; // entraîneur reconnu

/**
 * Construit la sélection : top 8 par score (composite + réputation), ou tout le
 * champ classé si < 8 partants. Les non-partants doivent être exclus en amont.
 */
export function buildNotreSelection(partants: PartantEnrichi[]): NotreSelectionItem[] {
  if (!partants || partants.length === 0) return [];

  const cotes = partants
    .map((p) => p.cote)
    .filter((c): c is number => typeof c === "number" && c > 0);
  const minCote = cotes.length > 0 ? Math.min(...cotes) : null;

  const scored = partants
    .map((p) => {
      let score = p.score_composite ?? 0;
      if (isEliteDriver(p.jockey)) score += BONUS_DRIVER;
      if (isRecognizedTrainer(p.entraineur)) score += BONUS_TRAINER;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored
    .slice(0, Math.min(TARGET_SIZE, scored.length))
    .map(({ p }, i) => ({
      rank: i + 1,
      numero: p.numero,
      nom: p.nom_cheval,
      jockey: p.jockey ?? null,
      cote: p.cote ?? null,
      label: pickLabel(p, minCote),
    }));
}

/** Étiquette qualitative déterministe (ordre de priorité explicite). */
function pickLabel(p: PartantEnrichi, minCote: number | null): SelectionLabel {
  const ratio = p.forme_musique?.ratio ?? 0;
  if (minCote !== null && p.cote === minCote) return "Favori marché";
  if (isEliteDriver(p.jockey)) return "Driver reconnu";
  if (isRecognizedTrainer(p.entraineur)) return "Entraîneur reconnu";
  if (ratio >= 0.5) return "Bonne forme";
  if (p.cote != null && p.cote >= 10 && ratio >= 0.3) return "Outsider value";
  return "Régulier";
}

/**
 * Règle d'affichage des blocs promo « Notre sélection » (bandeau + encart).
 * On les montre au visiteur NON-abonné quand une sélection existe ; on les
 * masque pour un abonné (bruit) et quand la course n'a pas de partants.
 */
export function shouldShowNotreSelectionPromo(
  isSubscribed: boolean,
  items: NotreSelectionItem[],
): boolean {
  return !isSubscribed && items.length > 0;
}
