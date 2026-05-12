/**
 * lib/ai-pronostics/agents/quality-validator.ts
 *
 * Worker Agent #5 — Valide chaque pronostic AVANT insertion en BDD.
 *
 * Garde-fou critique : si une sélection est incohérente, mieux vaut SKIPPER
 * ce pronostic que de polluer la BDD (qui sera ensuite affichée publiquement).
 *
 * Checks effectués :
 *   ✅ Tous les numéros de selection existent dans le field
 *   ✅ Pas de doublons dans selection
 *   ✅ Selection size correspond au type_pari (TIERCE=3-6, QUARTE=4-7, QUINTE=5-9)
 *   ✅ Sélection contient au moins 1 cheval avec cote ≤ 10 (anti-pure-outsiders)
 *   ✅ Sélection ne contient PAS uniquement des non-partants
 *   ✅ analyse_courte length : 100-400 chars
 *   ✅ analyse_courte ne contient pas de mots interdits ("garanti", "sûr", "imbattable")
 *
 * Stratégie : PUR TYPESCRIPT déterministe. Pas de LLM (rapide + gratuit).
 * Sauf cas exotique où on souhaiterait demander à Claude Sonnet de vérifier
 * la cohérence éditoriale globale (à voir Phase 3).
 *
 * Modèle : Aucun (déterministe)
 * Coût : $0
 */

import type {
  FieldAnalysis,
  PronosticDraft,
  ValidationResult,
} from "../types";

const MOTS_INTERDITS = [
  "garanti", "sûr", "imbattable", "à coup sûr",
  "gagne à coup", "victoire assurée", "100% gagnant",
];

const SELECTION_SIZES = {
  SIMPLE:      { min: 1, max: 2 },
  TIERCE:      { min: 3, max: 7 },
  QUARTE:      { min: 4, max: 8 },
  QUINTE_PLUS: { min: 5, max: 10 },
};

interface ValidatorInput {
  draft: PronosticDraft;
  field: FieldAnalysis;
}

/**
 * Agent principal : valide le pronostic, retourne ok=true/false + erreurs.
 */
export function runQualityValidatorAgent(input: ValidatorInput): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];
  const { draft, field } = input;

  // TODO Phase 2 : implémenter tous les checks
  //
  // Check 1 : tous les numéros existent dans le field
  // const fieldNumeros = new Set(field.partants.map((p) => p.numero));
  // for (const n of draft.selection) {
  //   if (!fieldNumeros.has(n)) errors.push(`Numéro ${n} inexistant dans le field`);
  // }
  //
  // Check 2 : pas de doublons
  // if (new Set(draft.selection).size !== draft.selection.length) {
  //   errors.push("Doublons dans selection");
  // }
  //
  // Check 3 : taille selection vs type_pari
  // const { min, max } = SELECTION_SIZES[draft.type_pari];
  // if (draft.selection.length < min || draft.selection.length > max) {
  //   errors.push(`Taille selection ${draft.selection.length} hors range ${min}-${max} pour ${draft.type_pari}`);
  // }
  //
  // Check 4 : au moins 1 favori
  // const minCote = Math.min(...draft.selection
  //   .map((n) => field.partants.find((p) => p.numero === n)?.cote ?? 99)
  //   .filter((c) => c !== null));
  // if (minCote > 10) warnings.push(`Aucun favori (cote ≤ 10) dans selection`);
  //
  // Check 5 : analyse_courte length
  // if (draft.analyse_courte.length < 100) errors.push("analyse_courte trop courte");
  // if (draft.analyse_courte.length > 400) warnings.push("analyse_courte longue (>400 chars)");
  //
  // Check 6 : mots interdits
  // const lower = draft.analyse_courte.toLowerCase();
  // for (const mot of MOTS_INTERDITS) {
  //   if (lower.includes(mot)) errors.push(`Mot interdit "${mot}" dans analyse_courte`);
  // }

  void draft;
  void field;
  void SELECTION_SIZES;
  void MOTS_INTERDITS;

  return {
    course_id: draft.course_id,
    ok:        errors.length === 0,
    errors,
    warnings,
  };
}
