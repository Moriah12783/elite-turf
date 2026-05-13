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
  AiPronosticDraft,
  FieldAnalyzerResult,
  QualityValidatorResult,
} from "../types";

const MOTS_INTERDITS = [
  "garanti", "sûr", "imbattable", "à coup sûr",
  "gagne à coup", "victoire assurée", "100% gagnant",
];

const SELECTION_SIZES_LOCAL = {
  FREE_6:         { min: 6, max: 6 },
  QUINTE_8:       { min: 8, max: 8 },
  ELITE_QUINTE_6: { min: 6, max: 6 },
};

interface ValidatorInput {
  draft: AiPronosticDraft;
  field: FieldAnalyzerResult;
}

/**
 * Agent principal : valide le pronostic, retourne status + erreurs/warnings.
 *
 * TODO Session 3 (refactor selon cahier des charges §13.5) :
 *   - retourner un QualityValidatorResult complet (status, scores, checks détaillés)
 *   - intégrer detectForbiddenExpressions, containsAfricaValidationMention, mentionsRisk
 *   - vérifier anti-cannibalisation FREE vs ELITE (cahier §14)
 */
export function runQualityValidatorAgent(input: ValidatorInput): QualityValidatorResult {
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
  void SELECTION_SIZES_LOCAL;
  void MOTS_INTERDITS;
  void errors;
  void warnings;

  // Stub Phase 1 — retourne un QualityValidatorResult minimal "non implémenté".
  return {
    agent:        "QualityValidator",
    draft_id:     draft.id ?? "",
    course_id:    draft.course_id,
    access_level: draft.access_level,
    status:       "NEEDS_HUMAN_REVIEW",
    quality_score: 0,
    africa_validation_check: {
      passed:                     false,
      validation_status:          draft.validation_status,
      mandatory_mention_present:  false,
      source_evidence_sufficient: false,
    },
    access_level_check: {
      passed:                           false,
      expected_runner_count:            0,
      actual_runner_count:              0,
      free_course_different_from_elite: true,
    },
    source_policy_check: {
      passed:                                     true,
      forbidden_sources_detected:                 [],
      secondary_sources_used_only_for_enrichment: true,
    },
    discipline_check: {
      passed:       false,
      discipline:   "PLAT",
      confirmed_by: "",
    },
    checks: {
      json_valid:                       true,
      no_gain_promise:                  true,
      runners_exist:                    false,
      no_non_runner_selected:           true,
      has_risk_section:                 false,
      has_confidence_level:             false,
      has_fact_based_reasoning:         false,
      selection_consistent_with_scores: false,
      subscriber_readability_ok:        false,
    },
    blocking_issues: [
      {
        code:     "AGENT_NOT_IMPLEMENTED_SESSION_1",
        message:  "QualityValidator non implémenté (Session 3 à venir)",
        severity: "BLOCKING",
      },
    ],
    warnings:        [],
    suggested_fixes: [],
    admin_comment:   "Stub Phase 1 — refactor Session 3 selon cahier §13.4",
  };
}
