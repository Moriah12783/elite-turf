/**
 * lib/ai-pronostics/agents/selection-builder.ts
 *
 * Worker Agent #3 — Construit la sélection finale de chevaux par niveau.
 *
 * Stratégies par niveau d'accès :
 *
 *   - ELITE (Quinté+, 6 chevaux) :
 *     Sélection serrée et tranchante. Base = top 3 score composite.
 *     +3 chevaux complémentaires (mix : 1 outsider value, 2 favoris secondaires).
 *     Confiance : ELEVE ou TRES_ELEVE selon spread des scores.
 *
 *   - PRO (Quinté+, 8 chevaux) :
 *     Couverture large pour sécuriser places + combinés. Base top 4 +
 *     4 outsiders raisonnables (cote ≤ 15, taux historique correct).
 *     Confiance : ELEVE.
 *
 *   - GRATUIT (Tiercé libre, 6 chevaux) :
 *     Mix favori + outsiders. Top 2 favoris + 4 outsiders ciblés.
 *     Confiance : MOYEN (cohérent avec niveau d'accès gratuit).
 *
 * Implémentation : algorithme déterministe en TS, validé ensuite par Claude
 * Sonnet pour cohérence éditoriale (max 1 cheval ≥ cote 30, etc.).
 *
 * Modèle : Sonnet 4.5 (validation finale + ajustement marginal)
 * Coût estimé : ~$0.02 / run × 3 courses = $0.06/jour
 */

import { callClaude, CLAUDE_MODELS } from "../claude-client";
import type {
  FieldAnalyzerResult,
  NiveauAcces,
  SelectionBuilderResult,
  SelectionType,
} from "../types";

interface SelectionBuilderInput {
  field:     FieldAnalyzerResult;
  niveau:    NiveauAcces;
  /** Pour info contextuelle (libelle, hippodrome) */
  course_libelle:    string;
  course_hippodrome: string;
}

/**
 * Définit la taille de sélection et le type de pari selon le niveau
 * (cahier des charges §3 - 4 niveaux d'accès).
 */
function getSelectionStrategy(niveau: NiveauAcces): { type: SelectionType; size: number } {
  switch (niveau) {
    case "ELITE":   return { type: "ELITE_QUINTE_6", size: 6 };
    case "PRO":     return { type: "QUINTE_8",      size: 8 };
    case "STARTER": return { type: "QUINTE_8",      size: 8 };
    case "FREE":    return { type: "FREE_6",        size: 6 };
  }
}

/**
 * Construction déterministe initiale de la sélection (sans LLM).
 */
function buildSelectionDeterministic(input: SelectionBuilderInput): number[] {
  // TODO Phase 2 :
  //   - Trier partants par score_composite DESC
  //   - Selon niveau, prendre top N + ajustements stratégiques
  //   - Pour GRATUIT : assurer mix favori + outsider
  //   - Renvoyer array de numeros
  void input;
  return [];
}

/**
 * Agent principal : construit la sélection + validation Claude.
 */
export async function runSelectionBuilderAgent(input: SelectionBuilderInput): Promise<{
  result: SelectionBuilderResult | null;
  tokens_input:  number;
  tokens_output: number;
  error?: string;
}> {
  // TODO Phase 2 :
  //   1. selectionDeterministe = buildSelectionDeterministic(input)
  //   2. Claude Sonnet review : "Voici la sélection algo + le field complet.
  //      Validate ou propose ajustement marginal (max 2 substitutions)
  //      avec raisonnement éditorial Elite Turf."
  //   3. Parse JSON output Claude
  //   4. Determiner confiance basée sur spread scores composite

  void input;
  void callClaude;
  void CLAUDE_MODELS;
  void getSelectionStrategy;
  void buildSelectionDeterministic;

  return {
    result: null,
    tokens_input:  0,
    tokens_output: 0,
    error: "Agent non implémenté (Phase 1 — fondations uniquement)",
  };
}
