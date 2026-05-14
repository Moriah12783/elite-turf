/**
 * lib/ai-pronostics/agents/selection-builder.ts
 *
 * Worker Agent #3 — SelectionBuilder (cahier des charges §11).
 *
 * 🎯 RÔLE
 *   Construit la sélection finale de chevaux selon le niveau d'accès :
 *     FREE = 6 chevaux | STARTER = 8 | PRO = 8 | ELITE = 6
 *   Combine algorithme déterministe + validation LLM (auto-critique).
 *
 * 🧠 MODÈLE
 *   Claude Sonnet 4.5 — validation finale + ajustement marginal (max 2
 *   substitutions par rapport à la sélection algorithmique).
 *   ~$0.02 par run × 3 niveaux/jour = ~$0.06/jour.
 *
 * 🛠️ ARCHITECTURE HYBRIDE
 *   1. **Déterministe (TS)** : pondération §11.4
 *        global_selection_score =
 *          0.25 * confidence + 0.20 * regularity + 0.15 * form
 *        + 0.10 * distance + 0.10 * terrain + 0.10 * jockey + 0.05 * trainer
 *        + 0.05 * value - 0.20 * risk
 *      → top-N initial selon access_level.
 *   2. **LLM (Sonnet)** : validation cohérence, ajustement max 2 chevaux,
 *      auto-critique pour drapeau needs_admin_attention.
 *
 * 🚨 GARDE-FOUS
 *   - Validation Afrique obligatoire (REJECTED si absente)
 *   - JAMAIS de cheval A_EVITER ni INSUFFICIENT_DATA comme base
 *   - Taille de sélection EXACTE par niveau (sinon NEEDS_HUMAN_REVIEW)
 *   - Confidence < 65 → status = NEEDS_HUMAN_REVIEW
 *
 * 📜 Conforme cahier §11.
 */

import { callClaude, CLAUDE_MODELS } from "../claude-client";
import type {
  FieldAnalyzerResult,
  NiveauAcces,
  ReasonCode,
  RunnerAnalysis,
  RunnerRole,
  SelectionBuilderResult,
  SelectionStatus,
  SelectionType,
  ValidationStatus,
} from "../types";
import {
  SELECTION_SIZES,
  VALIDATION_BADGES,
  MIN_SELECTION_CONFIDENCE_SCORE,
  MIN_CONFIDENCE_FOR_BASE,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────
// Input + Output
// ─────────────────────────────────────────────────────────────────────────

export interface SelectionBuilderInput {
  field:            FieldAnalyzerResult;
  access_level:     NiveauAcces;
  validation_status: ValidationStatus;
  course_libelle:    string;
  course_hippodrome: string;
}

export interface SelectionBuilderRunOutput {
  result:        SelectionBuilderResult;
  tokens_input:  number;
  tokens_output: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Stratégie par niveau
// ─────────────────────────────────────────────────────────────────────────

function getSelectionType(level: NiveauAcces): SelectionType {
  switch (level) {
    case "ELITE":   return "ELITE_QUINTE_6";
    case "PRO":     return "QUINTE_8";
    case "STARTER": return "QUINTE_8";
    case "FREE":    return "FREE_6";
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Scoring déterministe (cahier §11.4)
// ─────────────────────────────────────────────────────────────────────────

function computeGlobalSelectionScore(r: RunnerAnalysis): number {
  const raw =
      0.25 * r.confidence_score
    + 0.20 * r.regularity_score
    + 0.15 * r.form_score
    + 0.10 * r.distance_score
    + 0.10 * r.terrain_score
    + 0.10 * r.jockey_driver_score
    + 0.05 * r.trainer_score
    + 0.05 * r.value_score
    - 0.20 * r.risk_score;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

interface RankedRunner extends RunnerAnalysis {
  global_selection_score: number;
}

function rankRunners(runners: RunnerAnalysis[]): RankedRunner[] {
  return runners
    .map((r) => ({ ...r, global_selection_score: computeGlobalSelectionScore(r) }))
    .sort((a, b) => b.global_selection_score - a.global_selection_score);
}

/**
 * Pré-filtre déterministe : on écarte A_EVITER et INSUFFICIENT_DATA
 * AVANT d'envoyer au LLM. Le LLM ne peut pas les "récupérer".
 */
function isEligibleForSelection(r: RankedRunner): boolean {
  return r.profile !== "A_EVITER" && r.profile !== "INSUFFICIENT_DATA";
}

/**
 * Sélection algorithmique initiale (avant validation LLM).
 *
 * Stratégie par niveau (cahier §11.2) :
 *   - ELITE  : top 3 par score + 1 outsider value + 2 appuis solides
 *   - PRO/STARTER : top 4 + 3 outsiders raisonnables + 1 complément
 *   - FREE   : top 2 favoris + 4 outsiders ciblés (cohérent niveau gratuit)
 */
function buildDeterministicSelection(
  ranked: RankedRunner[],
  level:  NiveauAcces,
): RankedRunner[] {
  const size = SELECTION_SIZES[level];
  const eligible = ranked.filter(isEligibleForSelection);

  if (eligible.length < size) {
    // Pas assez de chevaux éligibles — on complète avec les "moins pires"
    // en laissant le LLM décider, et on flag fragile en aval.
    return ranked.slice(0, size);
  }

  switch (level) {
    case "ELITE": {
      // top 3 + 1 outsider (value_score ≥ 50) + 2 derniers solides
      const top3 = eligible.slice(0, 3);
      const outsider = eligible
        .slice(3)
        .find((r) => r.value_score >= 50 && r.risk_score < 65);
      const remaining = eligible.filter((r) => !top3.includes(r) && r !== outsider);
      const fill = outsider ? [outsider, ...remaining].slice(0, 3) : remaining.slice(0, 3);
      return [...top3, ...fill].slice(0, 6);
    }
    case "PRO":
    case "STARTER": {
      // top 4 + 3 outsiders + 1 complément
      const top4 = eligible.slice(0, 4);
      const outsiders = eligible
        .slice(4)
        .filter((r) => r.value_score >= 40 || r.profile === "OUTSIDER")
        .slice(0, 3);
      const remaining = eligible.filter((r) => !top4.includes(r) && !outsiders.includes(r));
      const complement = remaining.slice(0, Math.max(0, 8 - top4.length - outsiders.length));
      return [...top4, ...outsiders, ...complement].slice(0, 8);
    }
    case "FREE": {
      // top 2 + 4 outsiders (cohérent niveau gratuit, plus de couverture)
      const top2 = eligible.slice(0, 2);
      const others = eligible.slice(2);
      // Mix outsider + favoris secondaires
      return [...top2, ...others].slice(0, 6);
    }
  }
}

/**
 * Attribue un rôle à chaque cheval de la sélection (BASE/APPUI/OUTSIDER/COMPLEMENT).
 */
function assignRole(r: RankedRunner, rank: number, level: NiveauAcces): RunnerRole {
  if (rank <= 2 && r.confidence_score >= MIN_CONFIDENCE_FOR_BASE && r.profile === "BASE_POTENTIELLE") {
    return "BASE";
  }
  if (rank <= 3 && r.confidence_score >= 60) {
    return "APPUI";
  }
  if (r.profile === "OUTSIDER" || r.value_score >= 50) {
    return "OUTSIDER";
  }
  // Pour FREE, plus de complément (moins de bases tranchantes)
  if (level === "FREE" && rank >= 3) return "COMPLEMENT";
  return "COMPLEMENT";
}

/**
 * Détecte les reason_codes (cahier §11.6) pour chaque cheval.
 */
function deriveReasonCodes(r: RankedRunner): ReasonCode[] {
  const codes: ReasonCode[] = [];
  if (r.form_score          >= 60) codes.push("FORM");
  if (r.regularity_score    >= 50) codes.push("REGULARITY");
  if (r.distance_score      >= 60) codes.push("DISTANCE");
  if (r.terrain_score       >= 60) codes.push("TERRAIN");
  if (r.jockey_driver_score >= 60) codes.push("JOCKEY_DRIVER");
  if (r.value_score         >= 50) codes.push("VALUE");
  // Garantir au moins 1 code (sinon QualityValidator R17 → REJECTED)
  if (codes.length === 0) codes.push("REGULARITY");
  return codes;
}

// ─────────────────────────────────────────────────────────────────────────
// LLM — validation + auto-critique
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es SelectionBuilder, agent de validation finale des sélections Elite-Turf.

Mission :
On te soumet une sélection algorithmique (déjà calculée par scoring déterministe). Ta tâche :
1. VALIDER ou proposer un AJUSTEMENT MARGINAL (max 2 substitutions parmi les chevaux ÉLIGIBLES fournis).
2. Produire une auto-critique éditoriale.
3. Décider d'un selection_confidence_score [0..100].

Règles strictes :
- Tu DOIS respecter EXACTEMENT le nombre de chevaux du niveau (FREE=6, STARTER=8, PRO=8, ELITE=6).
- Tu ne peux UTILISER QUE des chevaux présents dans la liste "eligible_runners" fournie.
- Tu ne peux JAMAIS inclure un cheval marqué A_EVITER ou INSUFFICIENT_DATA.
- Tu ne dois JAMAIS surclasser un cheval uniquement pour sa cote.
- Une BASE doit avoir confidence_score ≥ 70 ET profile = BASE_POTENTIELLE.
- Un OUTSIDER doit avoir au moins 2 signaux positifs (≥ 2 reason_codes).
- Si tu juges la sélection trop fragile, status = "NEEDS_HUMAN_REVIEW" et needs_admin_attention = true.

Format de sortie : JSON STRICT, aucun texte hors JSON. Schéma à respecter exactement.`;

interface LlmSelectionDecision {
  status:                     SelectionStatus;
  selected_runner_ids:        string[];   // doit avoir EXACTEMENT expected_runner_count entrées
  substitutions: Array<{      // optionnel : substitutions proposées par le LLM
    out_runner_id: string;
    in_runner_id:  string;
    reason:        string;
  }>;
  selection_confidence_score: number;
  self_critique: {
    main_risk:                            string;
    why_this_selection_fits_access_level: string;
    needs_admin_attention:                boolean;
  };
}

function buildUserPrompt(
  level:        NiveauAcces,
  eligible:     RankedRunner[],
  initial:      RankedRunner[],
  expectedSize: number,
  course_libelle: string,
  course_hippodrome: string,
): string {
  const compactRunner = (r: RankedRunner) => ({
    runner_id:        r.runner_id,
    number:           r.number,
    name:             r.name,
    profile:          r.profile,
    global_score:     r.global_score,
    confidence_score: r.confidence_score,
    risk_score:       r.risk_score,
    value_score:      r.value_score,
    form_score:       r.form_score,
    regularity_score: r.regularity_score,
    global_selection_score: r.global_selection_score,
    strengths:        r.strengths,
    weaknesses:       r.weaknesses,
  });

  return `Course : ${course_libelle} (${course_hippodrome})
Niveau d'accès : ${level}
Taille attendue : ${expectedSize} chevaux

Sélection algorithmique initiale (à valider ou ajuster marginalement) :
${JSON.stringify(initial.map(compactRunner), null, 2)}

Chevaux éligibles (parmi lesquels tu peux substituer max 2) :
${JSON.stringify(eligible.map(compactRunner), null, 2)}

Réponds avec un JSON exactement conforme à ce schéma :
{
  "status": "SELECTION_READY" | "NEEDS_HUMAN_REVIEW" | "REJECTED",
  "selected_runner_ids": ["<exactement ${expectedSize} runner_id>"],
  "substitutions": [ { "out_runner_id": "...", "in_runner_id": "...", "reason": "..." } ],
  "selection_confidence_score": 0,
  "self_critique": {
    "main_risk": "...",
    "why_this_selection_fits_access_level": "...",
    "needs_admin_attention": false
  }
}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Mappage decision → SelectionBuilderResult
// ─────────────────────────────────────────────────────────────────────────

function applyLlmDecision(
  input:    SelectionBuilderInput,
  eligible: RankedRunner[],
  initial:  RankedRunner[],
  decision: LlmSelectionDecision,
): SelectionBuilderResult {
  const expectedSize = SELECTION_SIZES[input.access_level];
  const byId = new Map(eligible.map((r) => [r.runner_id, r]));

  // 1. Construire la sélection finale d'après les selected_runner_ids du LLM
  let selectedRunners: RankedRunner[] = [];
  for (const id of decision.selected_runner_ids) {
    const r = byId.get(id);
    if (r) selectedRunners.push(r);
  }

  // 2. Fallback : si le LLM a retourné une taille incorrecte → on garde l'initial
  let status: SelectionStatus = decision.status;
  if (selectedRunners.length !== expectedSize) {
    selectedRunners = initial.slice(0, expectedSize);
    status = "NEEDS_HUMAN_REVIEW";
  }

  // 3. Vérif anti-A_EVITER / INSUFFICIENT_DATA (defensive)
  const hasIneligible = selectedRunners.some((r) => !isEligibleForSelection(r));
  if (hasIneligible) {
    status = "REJECTED";
  }

  // 4. Construire selected_runners du résultat avec rank + role + reason_codes
  const selected = selectedRunners.map((r, i) => ({
    rank:             i + 1,
    runner_id:        r.runner_id,
    number:           r.number,
    name:             r.name,
    role:             assignRole(r, i + 1, input.access_level),
    confidence_score: r.confidence_score,
    risk_score:       r.risk_score,
    reason_codes:     deriveReasonCodes(r),
  }));

  // 5. excluded_runners = eligible non sélectionnés
  const selectedIds = new Set(selectedRunners.map((r) => r.runner_id));
  const excluded = eligible
    .filter((r) => !selectedIds.has(r.runner_id))
    .slice(0, 5)  // on limite à 5 pour ne pas surcharger
    .map((r) => ({
      runner_id: r.runner_id,
      number:    r.number,
      name:      r.name,
      reason:    r.weaknesses[0] ?? r.profile.toLowerCase(),
    }));

  // 6. Confidence : score LLM contraint par les seuils projet
  const confidence = Math.max(0, Math.min(100, decision.selection_confidence_score));
  if (confidence < MIN_SELECTION_CONFIDENCE_SCORE && status === "SELECTION_READY") {
    status = "NEEDS_HUMAN_REVIEW";
  }

  return {
    agent:                "SelectionBuilder",
    course_id:            input.field.course_id,
    access_level:         input.access_level,
    selection_type:       getSelectionType(input.access_level),
    validation_status:    input.validation_status,
    mandatory_public_mention: VALIDATION_BADGES[input.validation_status],
    status,
    expected_runner_count: expectedSize,
    selected_runners:      selected,
    excluded_runners:      excluded,
    selection_confidence_score: confidence,
    self_critique: {
      main_risk:                          decision.self_critique.main_risk,
      why_this_selection_fits_access_level: decision.self_critique.why_this_selection_fits_access_level,
      needs_admin_attention:               decision.self_critique.needs_admin_attention || status !== "SELECTION_READY",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Point d'entrée
// ─────────────────────────────────────────────────────────────────────────

export async function runSelectionBuilderAgent(
  input: SelectionBuilderInput,
): Promise<SelectionBuilderRunOutput> {
  // ── Garde-fou : validation Afrique obligatoire ─────────────────────────
  // 3 paliers acceptés (cahier §4 amendé 2026-05-14) :
  //   LONACI directe > Afrique corroborée > PMU international
  const validStatuses: ValidationStatus[] = [
    "VALIDATION_LONACI_DIRECTE",
    "VALIDATION_AFRIQUE_CORROBOREE",
    "VALIDATION_PMU_INTERNATIONAL",
  ];
  if (!validStatuses.includes(input.validation_status)) {
    return {
      result: {
        agent:                "SelectionBuilder",
        course_id:            input.field.course_id,
        access_level:         input.access_level,
        selection_type:       getSelectionType(input.access_level),
        validation_status:    input.validation_status,
        mandatory_public_mention: VALIDATION_BADGES[input.validation_status] ?? "",
        status:               "REJECTED",
        expected_runner_count: SELECTION_SIZES[input.access_level],
        selected_runners:      [],
        excluded_runners:      [],
        selection_confidence_score: 0,
        self_critique: {
          main_risk:                          "Validation Afrique absente — sélection interdite",
          why_this_selection_fits_access_level: "N/A",
          needs_admin_attention:               true,
        },
      },
      tokens_input:  0,
      tokens_output: 0,
    };
  }

  // ── 1. Ranker les partants par global_selection_score ──────────────────
  const ranked = rankRunners(input.field.runners_analysis);
  const eligible = ranked.filter(isEligibleForSelection);
  const expectedSize = SELECTION_SIZES[input.access_level];

  // ── 2. Pas assez d'éligibles → NEEDS_HUMAN_REVIEW ──────────────────────
  if (eligible.length < expectedSize) {
    return {
      result: {
        agent:                "SelectionBuilder",
        course_id:            input.field.course_id,
        access_level:         input.access_level,
        selection_type:       getSelectionType(input.access_level),
        validation_status:    input.validation_status,
        mandatory_public_mention: VALIDATION_BADGES[input.validation_status],
        status:               "NEEDS_HUMAN_REVIEW",
        expected_runner_count: expectedSize,
        selected_runners:      [],
        excluded_runners:      [],
        selection_confidence_score: 0,
        self_critique: {
          main_risk:                          `Seulement ${eligible.length} chevaux éligibles pour ${expectedSize} attendus`,
          why_this_selection_fits_access_level: "Manque de bases solides — review obligatoire",
          needs_admin_attention:               true,
        },
      },
      tokens_input:  0,
      tokens_output: 0,
    };
  }

  // ── 3. Sélection déterministe initiale ─────────────────────────────────
  const initial = buildDeterministicSelection(ranked, input.access_level);

  // ── 4. Appel LLM pour validation + auto-critique ──────────────────────
  const userPrompt = buildUserPrompt(
    input.access_level,
    eligible,
    initial,
    expectedSize,
    input.course_libelle,
    input.course_hippodrome,
  );

  const llm = await callClaude<LlmSelectionDecision>({
    model:        CLAUDE_MODELS.SONNET,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens:    1500,
    expectJson:   true,
  });

  if (!llm.parsed) {
    throw new Error("SelectionBuilder LLM n'a pas retourné de JSON parseable");
  }

  // ── 5. Mappage final ───────────────────────────────────────────────────
  const result = applyLlmDecision(input, eligible, initial, llm.parsed);

  return {
    result,
    tokens_input:  llm.tokens_input,
    tokens_output: llm.tokens_output,
  };
}
