/**
 * lib/ai-pronostics/agents/quality-validator.ts
 *
 * Worker Agent #5 — QualityValidator (cahier des charges §13).
 *
 * 🎯 RÔLE
 *   Agent de contrôle qualité STRICT. Valide, bloque ou envoie en
 *   review humaine chaque draft AVANT affichage admin et publication.
 *   Protège la marque, l'abonné, l'admin et la conformité Afrique.
 *
 * 💰 COÛT : $0 (aucun appel LLM — pur déterministe)
 *
 * 🛡️ 19 RÈGLES (cahier §13.2 + §13.3) :
 *    R1.  Validation Afrique obligatoire → REJECTED si absente
 *    R2.  Mention "Validation LONACI directe" OU "Validation Afrique corroborée" → REJECTED si manquante
 *    R3.  Anti-cannibalisation FREE vs ELITE → REJECTED si course identique
 *    R4-R7. Taille de sélection exacte par niveau (FREE=6, STARTER=8, PRO=8, ELITE=6)
 *    R8.  Source interdite ayant validé la course → REJECTED
 *    R9.  Discipline non confirmée → NEEDS_HUMAN_REVIEW
 *    R10. Sources contradictoires → NEEDS_HUMAN_REVIEW
 *    R11. Promesse de gain → REJECTED
 *    R12. Incitation à miser lourdement → REJECTED
 *    R13. Cheval sélectionné inexistant → REJECTED
 *    R14. Non-partant sélectionné → REJECTED
 *    R15. Sélection trop fragile pour le niveau → NEEDS_HUMAN_REVIEW
 *    R16. Expressions interdites (gain garanti, tuyau sûr…) → REJECTED
 *    R17. Aucune donnée factuelle ne justifie la sélection → REJECTED
 *    R18. Aucun risque mentionné → NEEDS_HUMAN_REVIEW (cahier §13.3: NEEDS_CORRECTION)
 *    R19. JSON invalide → REJECTED (côté caller, on assume entrée valide)
 *
 *   + Seuils de score (cahier §13.3) :
 *    - data_completeness_score < 75 ET confidence_level=HIGH → NEEDS_HUMAN_REVIEW
 *    - selection_confidence_score < 60 → NEEDS_HUMAN_REVIEW
 *    - africa_course_score < 60 → REJECTED
 *    - africa_course_score < 68 → NEEDS_HUMAN_REVIEW
 *
 * 📜 Conforme cahier des charges §13.2, §13.3, §13.4, §13.5.
 */

import type {
  AiPronosticDraft,
  AnalyseWriterResult,
  ConfidenceLevel,
  Discipline,
  FieldAnalyzerResult,
  NiveauAcces,
  QualityValidatorResult,
  SelectedCourse,
  SelectionBuilderResult,
  SourceEvidence,
  ValidationStatus,
  ValidatorStatus,
} from "../types";
import {
  SELECTION_SIZES,
  VALIDATION_BADGES,
  MIN_AFRICA_SCORE_BY_LEVEL,
  MIN_QUALITY_SCORE_FOR_ADMIN,
  AFRICA_SCORE_REVIEW_THRESHOLD,
} from "../types";
import {
  detectForbiddenExpressions,
  containsAfricaValidationMention,
  mentionsRisk,
} from "../forbidden-expressions";
import { isSourceForbidden, isSourceAllowed } from "../sources";

// ─────────────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────────────

export interface QualityValidatorInput {
  /** Draft à valider (tel qu'il sera persisté dans ai_pronostic_drafts) */
  draft:        AiPronosticDraft;
  /** Analyse du field issue de FieldAnalyzer */
  field:        FieldAnalyzerResult;
  /** Sélection issue de SelectionBuilder */
  selection:    SelectionBuilderResult;
  /** Contenu rédigé par AnalyseWriter (pour les checks de texte) */
  writer:       AnalyseWriterResult;
  /** Preuves de validation source par source (de CourseSelector) */
  source_evidence: SourceEvidence[];
  /**
   * Course FREE retenue par CourseSelector (anti-cannibalisation R3).
   * Optionnel : si on valide elle-même la FREE, undefined attendu.
   */
  free_course?:  SelectedCourse | null;
  /**
   * Liste des course_ids ELITE retenus (anti-cannibalisation R3).
   * Optionnel : si on valide une ELITE, undefined attendu.
   */
  elite_course_ids?: string[];
  /** Score Afrique attribué à la course par CourseSelector (cahier §13.3 fin) */
  africa_course_score: number;
  /** Discipline + source officielle confirmée par CourseSelector (R9) */
  discipline:            Discipline;
  discipline_confirmed_by: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Utilitaires de check
// ─────────────────────────────────────────────────────────────────────────

interface ChecksAccumulator {
  blocking: QualityValidatorResult["blocking_issues"];
  warnings: QualityValidatorResult["warnings"];
  fixes:    string[];
}

/** Ajoute un blocking_issue (déclenche REJECTED). */
function block(acc: ChecksAccumulator, code: string, message: string): void {
  acc.blocking.push({ code, message, severity: "BLOCKING" });
}

/** Ajoute un warning + une suggestion de fix. */
function warn(
  acc: ChecksAccumulator,
  code: string,
  message: string,
  severity: "LOW" | "MEDIUM" | "HIGH",
  fix?: string,
): void {
  acc.warnings.push({ code, message, severity });
  if (fix) acc.fixes.push(fix);
}

/**
 * Calcule un quality_score 0-100 à partir des warnings/blockings.
 * - Chaque blocking retire 25 points
 * - Chaque warning HIGH retire 10, MEDIUM 5, LOW 2
 * Plancher à 0, plafond à 100.
 */
function computeQualityScore(acc: ChecksAccumulator): number {
  let score = 100;
  score -= acc.blocking.length * 25;
  for (const w of acc.warnings) {
    if (w.severity === "HIGH")   score -= 10;
    if (w.severity === "MEDIUM") score -= 5;
    if (w.severity === "LOW")    score -= 2;
  }
  return Math.max(0, Math.min(100, score));
}

/**
 * Extrait tout le texte rédigé d'un AnalyseWriterResult pour scanner les
 * expressions interdites + la mention obligatoire.
 */
function extractFullText(writer: AnalyseWriterResult, draft: AiPronosticDraft): string {
  const parts: string[] = [];
  if (draft.title) parts.push(draft.title);
  if (writer.title) parts.push(writer.title);
  const sub = writer.subscriber_content;
  if (sub) {
    parts.push(sub.intro ?? "");
    parts.push(sub.course_context ?? "");
    parts.push(sub.race_reading ?? "");
    if (Array.isArray(sub.selection)) {
      for (const s of sub.selection) parts.push(s.text ?? "");
    }
  }
  return parts.join(" \n ").trim();
}

// ─────────────────────────────────────────────────────────────────────────
// Règles individuelles (chaque fonction = une règle ou un groupe)
// ─────────────────────────────────────────────────────────────────────────

/** R1 — Validation Afrique obligatoire. */
function checkAfricaValidation(
  draft: AiPronosticDraft,
  fullText: string,
  acc: ChecksAccumulator,
): { passed: boolean; mention_present: boolean } {
  const validStatuses: ValidationStatus[] = [
    "VALIDATION_LONACI_DIRECTE",
    "VALIDATION_AFRIQUE_CORROBOREE",
    "VALIDATION_PMU_INTERNATIONAL",
  ];
  const passed = validStatuses.includes(draft.validation_status);
  if (!passed) {
    block(acc, "AFRICA_VALIDATION_MISSING",
      `validation_status="${draft.validation_status}" n'est pas une validation Afrique acceptable (cahier §13.2 R1)`);
  }

  // R2 — mention obligatoire dans le texte (l'une des 3 mentions au choix
  // selon validation_status). Le sanitizer publique retire ces mentions au
  // publish (cf public-tone.ts) — elles ne sont obligatoires qu'au stade
  // draft pour audit interne.
  const mentionPresent = containsAfricaValidationMention(fullText);
  if (!mentionPresent) {
    block(acc, "MANDATORY_MENTION_MISSING",
      "Aucune des mentions obligatoires « Validation LONACI directe », « Validation Afrique corroborée » ou « Validation PMU international » n'est présente dans le contenu (cahier §13.2 R2)");
  } else {
    // Si présente, vérifier qu'elle correspond bien au validation_status
    const expectedBadge = VALIDATION_BADGES[draft.validation_status as ValidationStatus];
    if (expectedBadge && !fullText.toLowerCase().includes(expectedBadge.toLowerCase())) {
      warn(acc, "VALIDATION_MENTION_MISMATCH",
        `Le validation_status est "${draft.validation_status}" mais la mention "${expectedBadge}" exacte n'apparaît pas`,
        "MEDIUM",
        `Insérer exactement "${expectedBadge}" dans le contenu`);
    }
  }

  return { passed, mention_present: mentionPresent };
}

/** R3 — Anti-cannibalisation FREE vs ELITE. */
function checkAntiCannibalization(
  draft: AiPronosticDraft,
  free_course: SelectedCourse | null | undefined,
  elite_course_ids: string[] | undefined,
  acc: ChecksAccumulator,
): boolean {
  // On vérifie : si on valide une ELITE et que sa course == FREE → REJECTED
  // Inversement si on valide une FREE et qu'elle apparaît dans ELITE → REJECTED.
  if (draft.access_level === "ELITE" && free_course && free_course.course_id === draft.course_id) {
    block(acc, "FREE_ELITE_CANNIBALIZATION",
      `La course ELITE ${draft.course_id} est identique à la course FREE retenue (cahier §13.2 R3)`);
    return false;
  }
  if (draft.access_level === "FREE" && elite_course_ids?.includes(draft.course_id)) {
    block(acc, "FREE_ELITE_CANNIBALIZATION",
      `La course FREE ${draft.course_id} apparaît dans elite_featured.course_ids (cahier §13.2 R3)`);
    return false;
  }
  return true;
}

/** R4-R7 — Taille de sélection exacte. */
function checkSelectionSize(
  draft: AiPronosticDraft,
  selection: SelectionBuilderResult,
  acc: ChecksAccumulator,
): { passed: boolean; expected: number; actual: number } {
  const expected = SELECTION_SIZES[draft.access_level as NiveauAcces];
  const actual   = selection.selected_runners.length;
  const passed   = expected === actual;
  if (!passed) {
    block(acc, "SELECTION_SIZE_MISMATCH",
      `${draft.access_level} attend ${expected} chevaux, ${actual} reçus (cahier §13.2 R4-R7)`);
  }
  return { passed, expected, actual };
}

/** R8 — Source interdite ayant validé la course. */
function checkForbiddenSources(
  source_evidence: SourceEvidence[],
  acc: ChecksAccumulator,
): { passed: boolean; forbidden: string[] } {
  const forbidden: string[] = [];
  for (const ev of source_evidence) {
    // 1. Pattern interdit explicite (Telegram, forums, etc.)
    if (isSourceForbidden(ev.source_name)) {
      forbidden.push(ev.source_name);
      continue;
    }
    // 2. Source hors whitelist = interdite (sauf cas INTERNAL_WHITELIST)
    if (!isSourceAllowed(ev.source_name) && ev.source_tier !== "INTERNAL_WHITELIST") {
      forbidden.push(ev.source_name);
    }
  }
  const passed = forbidden.length === 0;
  if (!passed) {
    block(acc, "FORBIDDEN_SOURCE_USED",
      `Source(s) interdite(s) ou non whitelistée(s) ayant servi à valider la course : ${forbidden.join(", ")} (cahier §13.2 R8)`);
  }
  return { passed, forbidden };
}

/**
 * Vérifie que les sources SECONDARY ne servent qu'à l'enrichissement
 * (jamais à valider Afrique seules).
 */
function checkSecondaryUsage(
  source_evidence: SourceEvidence[],
  acc: ChecksAccumulator,
): boolean {
  // Cherche des SECONDARY qui auraient un rôle AFRICA_AVAILABILITY (incohérent)
  const misused = source_evidence.filter(
    (ev) => ev.source_tier === "SECONDARY" && ev.validation_role === "AFRICA_AVAILABILITY",
  );
  if (misused.length > 0) {
    warn(acc, "SECONDARY_USED_FOR_AFRICA",
      `Source(s) SECONDARY utilisée(s) pour valider Afrique : ${misused.map((m) => m.source_name).join(", ")}`,
      "HIGH",
      "Remplacer par une source PRIMARY ou AFRICA_CORROBORATION");
    return false;
  }
  return true;
}

/** R9 — Discipline confirmée par une source adaptée. */
function checkDiscipline(
  source_evidence: SourceEvidence[],
  discipline: Discipline,
  confirmed_by: string,
  acc: ChecksAccumulator,
): boolean {
  // Doit être confirmée par : LeTROT / France Galop / SOREC / PMU.fr / InternalWhitelist
  const validConfirmers = ["LeTROT", "France Galop", "SOREC", "e-SOREC", "PMU.fr", "InternalWhitelist"];
  const hasValidConfirmer = validConfirmers.some((c) => confirmed_by.includes(c));
  if (!hasValidConfirmer) {
    warn(acc, "DISCIPLINE_NOT_CONFIRMED",
      `Discipline "${discipline}" non confirmée par une source officielle (confirmé par : "${confirmed_by}")`,
      "HIGH",
      "Vérifier auprès de LeTROT (trot), France Galop (galop) ou SOREC (Maroc)");
    return false;
  }
  // On peut aussi vérifier la cohérence avec les sources dispo
  void source_evidence;
  return true;
}

/** R10 — Sources contradictoires. */
function checkSourceConsistency(
  source_evidence: SourceEvidence[],
  acc: ChecksAccumulator,
): boolean {
  const conflicts = source_evidence.filter((ev) => ev.status === "CONFLICT");
  if (conflicts.length > 0) {
    warn(acc, "SOURCES_IN_CONFLICT",
      `${conflicts.length} source(s) en conflit : ${conflicts.map((c) => c.source_name).join(", ")}`,
      "HIGH",
      "Résoudre manuellement les divergences avant publication");
    return false;
  }
  return true;
}

/** R11-R12 + R16 — Promesse de gain, incitation à miser, expressions interdites. */
function checkForbiddenExpressions(
  fullText: string,
  acc: ChecksAccumulator,
): { passed: boolean; found: string[] } {
  const violations = detectForbiddenExpressions(fullText);
  if (violations.length === 0) return { passed: true, found: [] };

  const found = violations.map((v) => `"${v.expression_matchee}" (${v.raison})`);
  block(acc, "FORBIDDEN_EXPRESSIONS",
    `Expression(s) interdite(s) détectée(s) : ${found.join("; ")} (cahier §13.2 R11/R12/R16, §24)`);
  return { passed: false, found };
}

/** R13 — Tous les chevaux sélectionnés existent dans le field. */
function checkRunnersExist(
  selection: SelectionBuilderResult,
  field: FieldAnalyzerResult,
  acc: ChecksAccumulator,
): boolean {
  const fieldIds = new Set(field.runners_analysis.map((r) => r.runner_id));
  const missing  = selection.selected_runners.filter((r) => !fieldIds.has(r.runner_id));
  if (missing.length > 0) {
    block(acc, "RUNNERS_NOT_IN_FIELD",
      `${missing.length} cheval/aux sélectionné(s) absent(s) du field : ${missing.map((m) => `#${m.number} ${m.name}`).join(", ")} (cahier §13.2 R13)`);
    return false;
  }
  return true;
}

/**
 * R14 — Aucun non-partant sélectionné.
 * Note : `partants` source-of-truth est filtrée non_partant=true dans FieldAnalyzer.
 * Si un runner est dans field.runners_analysis, il est partant. Donc R14
 * est couvert par R13 — on garde un check explicite pour robustesse.
 */
function checkNoNonRunner(
  selection: SelectionBuilderResult,
  field: FieldAnalyzerResult,
  acc: ChecksAccumulator,
): boolean {
  // Les runners_analysis ne contiennent que des partants valides (filtrés en amont).
  // Donc un runner_id dans la sélection mais absent du field = non-partant probable.
  const fieldIds = new Set(field.runners_analysis.map((r) => r.runner_id));
  const suspects = selection.selected_runners.filter((r) => !fieldIds.has(r.runner_id));
  if (suspects.length > 0) {
    block(acc, "NON_RUNNER_SELECTED",
      `${suspects.length} non-partant(s) probable(s) sélectionné(s) (cahier §13.2 R14)`);
    return false;
  }
  return true;
}

/** R15 — Sélection trop fragile pour le niveau (cahier §13.3). */
function checkSelectionFragility(
  selection: SelectionBuilderResult,
  acc: ChecksAccumulator,
): boolean {
  // Si selection_confidence_score < 60 → NEEDS_HUMAN_REVIEW
  if (selection.selection_confidence_score < 60) {
    warn(acc, "SELECTION_TOO_FRAGILE",
      `selection_confidence_score=${selection.selection_confidence_score} < 60 (cahier §13.3)`,
      "HIGH",
      "Renforcer la sélection avec des bases plus solides ou revoir l'access_level");
    return false;
  }
  return true;
}

/** R17 — Raisonnement factuel pour la sélection. */
function checkFactBasedReasoning(
  writer: AnalyseWriterResult,
  selection: SelectionBuilderResult,
  acc: ChecksAccumulator,
): boolean {
  // Chaque cheval de la sélection doit avoir au moins 1 reason_code documenté
  const noReason = selection.selected_runners.filter((r) => !r.reason_codes || r.reason_codes.length === 0);
  if (noReason.length > 0) {
    block(acc, "NO_FACT_BASED_REASONING",
      `${noReason.length} cheval/aux sans reason_codes : ${noReason.map((r) => `#${r.number}`).join(", ")} (cahier §13.2 R17)`);
    return false;
  }
  // Chaque cheval doit aussi avoir un texte d'analyse dans subscriber_content.selection
  const writerSelection = writer.subscriber_content?.selection ?? [];
  const noText = selection.selected_runners.filter((r) => {
    const w = writerSelection.find((ws) => ws.runner_id === r.runner_id);
    return !w || !w.text || w.text.trim().length < 20;
  });
  if (noText.length > 0) {
    warn(acc, "INSUFFICIENT_RUNNER_TEXT",
      `${noText.length} cheval/aux avec analyse textuelle insuffisante (< 20 chars)`,
      "MEDIUM",
      "Compléter le texte d'analyse pour chaque cheval sélectionné");
  }
  return true;
}

/** R18 — Au moins un risque mentionné dans le contenu. */
function checkRiskSection(
  fullText: string,
  acc: ChecksAccumulator,
): boolean {
  if (!mentionsRisk(fullText)) {
    warn(acc, "NO_RISK_MENTIONED",
      "Aucun risque mentionné dans le contenu (cahier §13.2 R18)",
      "HIGH",
      "Ajouter explicitement un paragraphe mentionnant le risque, la prudence, l'incertitude ou la difficulté");
    return false;
  }
  return true;
}

/**
 * Seuils Afrique (cahier §13.3 fin, recalibrés 2026-05-15).
 *
 * Hiérarchie :
 *   - score < AFRICA_SCORE_REVIEW_THRESHOLD       → BLOCK (REJECTED)
 *   - score < MIN_AFRICA_SCORE_BY_LEVEL[level]    → warn HIGH si ELITE,
 *                                                    MEDIUM sinon (→ review)
 *   - score ≥ MIN_AFRICA_SCORE_BY_LEVEL[level]    → pas de signal négatif
 *
 * Avant le recalibrage, ce check avait un seuil 68 hardcodé qui causait
 * un warn HIGH dégénéré sur quasi tous les drafts (BDD jeune plafonne
 * vers 74). On utilise désormais les constantes centralisées.
 */
function checkAfricaScoreThresholds(
  africa_course_score: number,
  access_level: NiveauAcces,
  acc: ChecksAccumulator,
): void {
  if (africa_course_score < AFRICA_SCORE_REVIEW_THRESHOLD) {
    block(acc, "AFRICA_SCORE_TOO_LOW",
      `africa_course_score=${africa_course_score} < ${AFRICA_SCORE_REVIEW_THRESHOLD} (cahier §13.3, plancher absolu)`);
    return;
  }
  const requiredForLevel = MIN_AFRICA_SCORE_BY_LEVEL[access_level];
  if (africa_course_score < requiredForLevel) {
    warn(acc, "AFRICA_SCORE_BELOW_LEVEL_THRESHOLD",
      `africa_course_score=${africa_course_score} < seuil ${access_level}=${requiredForLevel} (cahier §20)`,
      access_level === "ELITE" ? "HIGH" : "MEDIUM",
      `Rétrograder ce pronostic vers un niveau d'accès plus bas`);
  }
}

/** Cohérence selection_confidence × data_completeness. */
function checkConfidenceConsistency(
  writer: AnalyseWriterResult,
  field: FieldAnalyzerResult,
  acc: ChecksAccumulator,
): void {
  // confidence_level extrait du writer (AnalyseWriterResult.subscriber_content)
  // On suppose la présence d'un champ niveau de confiance dans le writer.
  // Si non disponible, on déduit du selection_confidence_score.
  const confidence: ConfidenceLevel | undefined =
    (writer as unknown as { confidence_level?: ConfidenceLevel }).confidence_level;

  if (confidence === "HIGH" && field.data_completeness_score < 75) {
    warn(acc, "HIGH_CONFIDENCE_LOW_DATA",
      `Confiance HIGH déclarée mais data_completeness_score=${field.data_completeness_score} < 75 (cahier §13.3)`,
      "HIGH",
      "Rétrograder la confiance à MEDIUM");
  }
}

/** Lisibilité abonné : longueur des textes (cahier §13.4 checks). */
function checkReadability(
  writer: AnalyseWriterResult,
  acc: ChecksAccumulator,
): boolean {
  const sub = writer.subscriber_content;
  if (!sub) {
    block(acc, "NO_SUBSCRIBER_CONTENT",
      "Aucun contenu abonné rédigé (subscriber_content vide)");
    return false;
  }
  if (!sub.intro || sub.intro.trim().length < 30) {
    warn(acc, "INTRO_TOO_SHORT",
      "Intro abonné trop courte (< 30 chars)",
      "MEDIUM",
      "Étoffer l'intro avec contexte course + niveau d'accès");
  }
  if (!sub.race_reading || sub.race_reading.trim().length < 50) {
    warn(acc, "RACE_READING_TOO_SHORT",
      "Lecture de course trop courte (< 50 chars)",
      "MEDIUM",
      "Détailler la lecture du field et les enjeux");
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// Détermination du statut final
// ─────────────────────────────────────────────────────────────────────────

/**
 * Calcule le ValidatorStatus final selon les règles cumulées :
 *   - 1 blocking_issue → REJECTED
 *   - 0 blocking + warnings HIGH → NEEDS_HUMAN_REVIEW
 *   - 0 blocking + warnings MEDIUM uniquement → NEEDS_CORRECTION
 *   - 0 blocking + quality_score ≥ MIN_QUALITY_SCORE_FOR_ADMIN → APPROVED_FOR_ADMIN_REVIEW
 */
function determineStatus(acc: ChecksAccumulator, qualityScore: number): ValidatorStatus {
  if (acc.blocking.length > 0)                                    return "REJECTED";
  if (acc.warnings.some((w) => w.severity === "HIGH"))            return "NEEDS_HUMAN_REVIEW";
  if (acc.warnings.some((w) => w.severity === "MEDIUM"))          return "NEEDS_CORRECTION";
  if (qualityScore >= MIN_QUALITY_SCORE_FOR_ADMIN)                return "APPROVED_FOR_ADMIN_REVIEW";
  return "NEEDS_HUMAN_REVIEW";
}

// ─────────────────────────────────────────────────────────────────────────
// Point d'entrée principal
// ─────────────────────────────────────────────────────────────────────────

/**
 * Valide un draft complet. Synchrone (déterministe, $0).
 *
 * @returns QualityValidatorResult conforme cahier §13.4
 */
export function runQualityValidatorAgent(
  input: QualityValidatorInput,
): QualityValidatorResult {
  const { draft, field, selection, writer, source_evidence } = input;

  const acc: ChecksAccumulator = {
    blocking: [],
    warnings: [],
    fixes:    [],
  };

  const fullText = extractFullText(writer, draft);

  // ── R1 + R2 : Validation Afrique ───────────────────────────────────────
  const africaCheck = checkAfricaValidation(draft, fullText, acc);

  // ── R3 : Anti-cannibalisation ──────────────────────────────────────────
  const antiCanib = checkAntiCannibalization(
    draft,
    input.free_course ?? null,
    input.elite_course_ids,
    acc,
  );

  // ── R4-R7 : Taille de sélection ────────────────────────────────────────
  const sizeCheck = checkSelectionSize(draft, selection, acc);

  // ── R8 + secondary usage : Sources ─────────────────────────────────────
  const sourceCheck     = checkForbiddenSources(source_evidence, acc);
  const secondaryOk     = checkSecondaryUsage(source_evidence, acc);

  // ── R9 : Discipline ────────────────────────────────────────────────────
  const disciplinePassed = checkDiscipline(
    source_evidence,
    input.discipline,
    input.discipline_confirmed_by,
    acc,
  );

  // ── R10 : Cohérence sources ────────────────────────────────────────────
  checkSourceConsistency(source_evidence, acc);

  // ── R11-R12 + R16 : Expressions interdites ─────────────────────────────
  const forbiddenExpr = checkForbiddenExpressions(fullText, acc);

  // ── R13 : Runners existent ─────────────────────────────────────────────
  const runnersExist = checkRunnersExist(selection, field, acc);

  // ── R14 : Pas de non-partants ──────────────────────────────────────────
  const noNonRunner = checkNoNonRunner(selection, field, acc);

  // ── R15 : Fragilité ────────────────────────────────────────────────────
  checkSelectionFragility(selection, acc);

  // ── R17 : Raisonnement factuel ─────────────────────────────────────────
  const factBased = checkFactBasedReasoning(writer, selection, acc);

  // ── R18 : Mention de risque ────────────────────────────────────────────
  const riskMentioned = checkRiskSection(fullText, acc);

  // ── Seuils Afrique + cohérence confiance ───────────────────────────────
  checkAfricaScoreThresholds(input.africa_course_score, draft.access_level as NiveauAcces, acc);
  checkConfidenceConsistency(writer, field, acc);

  // ── Lisibilité ─────────────────────────────────────────────────────────
  const readable = checkReadability(writer, acc);

  // ── Score qualité + statut final ───────────────────────────────────────
  const quality_score = computeQualityScore(acc);
  const status = determineStatus(acc, quality_score);

  // Commentaire admin synthétique (≤ 200 chars)
  const adminComment =
    status === "APPROVED_FOR_ADMIN_REVIEW"
      ? `Validé pour review admin (score ${quality_score}/100). ${acc.warnings.length} warning(s) mineur(s).`
      : status === "REJECTED"
        ? `REJETÉ : ${acc.blocking.length} blocage(s) — ${acc.blocking[0]?.code ?? "n/a"}`
        : status === "NEEDS_HUMAN_REVIEW"
          ? `Review humaine requise : ${acc.warnings.filter((w) => w.severity === "HIGH").length} warning(s) HIGH`
          : `Corrections suggérées (${acc.warnings.length} warning(s))`;

  return {
    agent:        "QualityValidator",
    draft_id:     draft.id ?? "",
    course_id:    draft.course_id,
    access_level: draft.access_level as NiveauAcces,
    status,
    quality_score,
    africa_validation_check: {
      passed:                     africaCheck.passed && africaCheck.mention_present,
      validation_status:          draft.validation_status as ValidationStatus,
      mandatory_mention_present:  africaCheck.mention_present,
      source_evidence_sufficient: source_evidence.some(
        (ev) => ev.status === "MATCHED" && ev.validation_role === "AFRICA_AVAILABILITY",
      ),
    },
    access_level_check: {
      passed:                            sizeCheck.passed && antiCanib,
      expected_runner_count:             sizeCheck.expected,
      actual_runner_count:               sizeCheck.actual,
      free_course_different_from_elite:  antiCanib,
    },
    source_policy_check: {
      passed:                                     sourceCheck.passed && secondaryOk,
      forbidden_sources_detected:                 sourceCheck.forbidden,
      secondary_sources_used_only_for_enrichment: secondaryOk,
    },
    discipline_check: {
      passed:       disciplinePassed,
      discipline:   input.discipline,
      confirmed_by: input.discipline_confirmed_by,
    },
    checks: {
      json_valid:                       true, // input typé → JSON valide par construction
      no_gain_promise:                  forbiddenExpr.passed,
      runners_exist:                    runnersExist,
      no_non_runner_selected:           noNonRunner,
      has_risk_section:                 riskMentioned,
      has_confidence_level:             !!selection.selection_confidence_score,
      has_fact_based_reasoning:         factBased,
      selection_consistent_with_scores: selection.selection_confidence_score >= 60,
      subscriber_readability_ok:        readable && !acc.warnings.some((w) => w.code === "INTRO_TOO_SHORT" || w.code === "RACE_READING_TOO_SHORT"),
    },
    blocking_issues: acc.blocking,
    warnings:        acc.warnings,
    suggested_fixes: acc.fixes,
    admin_comment:   adminComment,
  };
}
