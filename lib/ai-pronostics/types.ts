/**
 * lib/ai-pronostics/types.ts
 *
 * Types partagés du système Multi-Agents Elite-Turf IA.
 *
 * 📜 Conforme au cahier des charges
 *    "elite-turf-specification-multi-agent-afrique.md" (v1.0, 2 328 lignes).
 *
 * Architecture : Director + 6 Workers Agents spécialisés.
 *
 * Cycle de vie complet :
 *   1. CourseSelector     → choisit 3 courses (FREE/STARTER+PRO/ELITE) +
 *                            valide la disponibilité Afrique
 *   2. FieldAnalyzer × N  → analyse partants (déterministe, no LLM)
 *   3. SelectionBuilder × N → sélection chevaux par niveau d'accès
 *   4. AnalyseWriter × N  → rédige le contenu adapté au niveau
 *   5. QualityValidator × N → valide/bloque/envoie en review humaine
 *   6. NotificationBuilder → notifie l'admin
 *   7. Director           → orchestre + INSERT en BDD (publie=false)
 *
 * Garanties non négociables :
 *   ✅ Aucune publication sans validation Afrique
 *   ✅ Aucune publication automatique (review humaine obligatoire)
 *   ✅ Pas de promesse de gain dans le contenu
 *   ✅ Sources interdites = blocage automatique
 */

// ─────────────────────────────────────────────────────────────────────────
// 1. NIVEAUX D'ACCÈS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Niveau d'accès utilisateur déterminant le contenu reçu.
 * - FREE    : 1 pronostic gratuit, 6 chevaux, course différente d'ELITE
 * - STARTER : équivalent Pro pendant 7 jours (8 chevaux)
 * - PRO     : Quinté+ 8 chevaux
 * - ELITE   : Quinté+ resserré 6 chevaux sur courses vedette
 */
export type NiveauAcces = "FREE" | "STARTER" | "PRO" | "ELITE";

/** Tailles de sélection imposées par niveau (cahier des charges §7) */
export const SELECTION_SIZES: Record<NiveauAcces, number> = {
  FREE:    6,
  STARTER: 8,
  PRO:     8,
  ELITE:   6,
};

// ─────────────────────────────────────────────────────────────────────────
// 2. VALIDATION AFRIQUE (cœur du système)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Statut de validation Afrique — OBLIGATOIRE pour publication.
 * Sans l'un de ces 3 statuts, aucun pronostic ne peut sortir.
 *
 * Hiérarchie de robustesse (du plus fort au plus faible) :
 *   1. VALIDATION_LONACI_DIRECTE     : LONACI confirme directement (preuve maximale, CI=90% audience)
 *   2. VALIDATION_AFRIQUE_CORROBOREE : Autre opérateur africain (LONASE/LONAB/PMUC/...) confirme
 *   3. VALIDATION_PMU_INTERNATIONAL  : Course PMU + corroboration redistribution
 *                                      (Quinté+/Quarté+/Tiercé+, co-localisation LONACI, ou R1)
 *
 * Le 3e palier (ajouté 2026-05-14, décision PO) reconnaît que les opérateurs
 * nationaux africains redistribuent SYSTÉMATIQUEMENT les programmes premium
 * PMU France + R1 — donc même sans match LONACI direct, ces courses sont
 * jouables côté Afrique francophone via les apps officielles nationales.
 */
export type ValidationStatus =
  | "VALIDATION_LONACI_DIRECTE"
  | "VALIDATION_AFRIQUE_CORROBOREE"
  | "VALIDATION_PMU_INTERNATIONAL";

/**
 * Mention publique affichée dans tout contenu publié.
 * EXACTE (pas de variantes) — pour cohérence éditoriale + audit.
 *
 * 🎭 IMPORTANT : depuis 2026-05-13 (décision PO sanitization éditoriale),
 * ces badges sont conservés en BDD (audit) mais retirés du contenu PUBLIC
 * par `sanitizeForPublic()` au moment du publish (cf public-tone.ts).
 * Côté admin (/admin/pronostics/ai-review) ils restent visibles.
 */
export const VALIDATION_BADGES: Record<ValidationStatus, string> = {
  VALIDATION_LONACI_DIRECTE:     "Validation LONACI directe",
  VALIDATION_AFRIQUE_CORROBOREE: "Validation Afrique corroborée",
  VALIDATION_PMU_INTERNATIONAL:  "Validation PMU international",
};

// ─────────────────────────────────────────────────────────────────────────
// 3. DISCIPLINES + SOURCES OFFICIELLES
// ─────────────────────────────────────────────────────────────────────────

export type Discipline =
  | "TROT_ATTELE"
  | "TROT_MONTE"
  | "PLAT"
  | "HAIES"
  | "STEEPLE"
  | "MAROC_LOCAL";

/** Source officielle requise pour confirmer la discipline */
export const DISCIPLINE_OFFICIAL_SOURCE: Record<Discipline, string[]> = {
  TROT_ATTELE: ["LeTROT", "PMU.fr"],
  TROT_MONTE:  ["LeTROT", "PMU.fr"],
  PLAT:        ["France Galop", "PMU.fr"],
  HAIES:       ["France Galop", "PMU.fr"],
  STEEPLE:     ["France Galop", "PMU.fr"],
  MAROC_LOCAL: ["SOREC", "e-SOREC"],
};

// ─────────────────────────────────────────────────────────────────────────
// 4. SOURCES — TIERS ET RÔLES
// ─────────────────────────────────────────────────────────────────────────

export type SourceTier =
  | "PRIMARY"                  // LONACI, PMU.fr, LeTROT, France Galop, SOREC
  | "DISCIPLINE_OFFICIAL"      // LeTROT, France Galop
  | "AFRICA_CORROBORATION"     // LONASE, LONAB, PMUC, PMUG, PMU Mali...
  | "SECONDARY"                // Geny, Genybet, Turf-FR (enrichissement seul)
  | "INTERNAL_WHITELIST"       // entrées custom whitelist interne
  | "FORBIDDEN";               // Telegram, WhatsApp, forums, etc.

export type SourceRole =
  | "AFRICA_AVAILABILITY"      // valide la disponibilité Afrique d'une course
  | "DISCIPLINE_CONFIRMATION"  // confirme la discipline (LeTROT/France Galop)
  | "CENTRAL_PROGRAM"          // programme central (PMU.fr)
  | "DATA_ENRICHMENT"          // enrichit l'analyse (cotes, musique)
  | "CROSSCHECK"               // croisement multi-sources
  | "MAROC_COURSES_AND_AVAILABILITY";

/** Statut d'une preuve de source rattachée à une course */
export type SourceEvidenceStatus =
  | "MATCHED"
  | "PARTIAL"
  | "CONFLICT"
  | "MISSING"
  | "FORBIDDEN";

export interface SourceEvidence {
  course_id:       string;
  source_name:     string;        // ex: "LONACI", "PMU.fr", "LeTROT"
  source_tier:     SourceTier;
  validation_role: SourceRole;
  matched_fields:  string[];       // ex: ["meeting","race_number","start_time"]
  confidence:      number;          // 0-100
  status:          SourceEvidenceStatus;
  source_url?:     string;
  notes?:          string;
}

// ─────────────────────────────────────────────────────────────────────────
// 5. STATUTS GLOBAUX DU PIPELINE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Statuts du pipeline complet (cahier des charges §19).
 * Permettent un suivi précis du cycle de vie d'un pronostic.
 */
export type PipelineStatus =
  // Sélection courses
  | "COURSE_SELECTED"
  | "COURSE_REJECTED"

  // Validation Afrique
  | "VALIDATION_LONACI_DIRECTE"
  | "VALIDATION_AFRIQUE_CORROBOREE"
  | "VALIDATION_PMU_INTERNATIONAL"
  | "VALIDATION_AFRIQUE_ABSENTE"
  | "VALIDATION_CONFLICT"

  // Analyse field
  | "ANALYSIS_READY"
  | "ANALYSIS_INSUFFICIENT"

  // Construction sélection
  | "SELECTION_READY"
  | "SELECTION_REJECTED"
  | "SELECTION_NEEDS_REVIEW"

  // Rédaction draft
  | "DRAFT_READY"
  | "DRAFT_NEEDS_REVIEW"
  | "DRAFT_REJECTED"

  // Validation qualité + admin
  | "APPROVED_FOR_ADMIN_REVIEW"
  | "NEEDS_CORRECTION"
  | "NEEDS_HUMAN_REVIEW"
  | "PUBLISHED"
  | "HUMAN_REJECTED";

// ─────────────────────────────────────────────────────────────────────────
// 6. DOMAIN — COURSE & PARTANTS
// ─────────────────────────────────────────────────────────────────────────

/** Course candidate à sélection (chargée depuis BDD) */
export interface CourseCandidate {
  course_id:        string;
  meeting:          string;          // ex: "R1"
  race_number:      string;          // ex: "C4"
  race_name:        string;
  date_course:      string;
  start_time_paris:   string | null;  // ex: "16:50"
  start_time_abidjan: string | null;  // ex: "14:50" (UTC+0)
  hippodrome:       string;
  hippodrome_pays:  string;
  discipline:       Discipline | null;
  distance_metres:  number | null;
  nb_partants:      number;
  paris_disponibles: string[];        // ["QUINTE_PLUS","QUARTE","TIERCE"...]
  statut:            string;
  /** Validation Afrique attribuée par CourseSelector */
  validation_status?: ValidationStatus;
  /** Score Afrique calculé (0-100) */
  africa_course_score?: number;
}

export interface RunnerForAnalysis {
  runner_id:   string;
  number:      number;
  name:        string;
  jockey_driver: string | null;
  trainer:     string | null;
  odds:        number | null;
  recent_form: string | null;          // "musique" PMU
  poids_kg:    number | null;
  is_non_runner: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// 7. AGENT 1 — CourseSelector
// ─────────────────────────────────────────────────────────────────────────

export type CourseSelectorStatus =
  | "COURSES_SELECTED"
  | "NOT_ENOUGH_VALIDATED_AFRICA_COURSES"
  | "NEEDS_HUMAN_REVIEW";

/**
 * Schéma conforme cahier des charges §9.4.
 * Sortie obligatoire du CourseSelectorAgent.
 */
export interface CourseSelectorResult {
  agent:        "CourseSelector";
  date:         string;                       // YYYY-MM-DD
  target_market: "AFRIQUE_FRANCOPHONE";
  status:       CourseSelectorStatus;
  selected_courses: {
    free:        SelectedCourse & { must_be_different_from_elite: boolean };
    starter_pro: SelectedCourse;
    elite_featured: Array<SelectedCourse & { priority: number }>;
  } | null;
  source_evidence: SourceEvidence[];
  rejected_courses: Array<{
    course_id: string;
    reason:    string;
    missing_requirements: Array<
      | "AFRICA_VALIDATION"
      | "DISCIPLINE_CONFIRMATION"
      | "DATA_COMPLETENESS"
    >;
  }>;
  admin_note: string;
}

export interface SelectedCourse {
  course_id:        string;
  meeting:          string;
  race_number:      string;
  race_name:        string;
  start_time_paris:   string;
  start_time_abidjan: string;
  validation_status: ValidationStatus;
  mandatory_public_mention: string;  // depuis VALIDATION_BADGES
  africa_course_score: number;
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────
// 8. AGENT 2 — FieldAnalyzer
// ─────────────────────────────────────────────────────────────────────────

export type FieldAnalyzerStatus = "OK" | "NEEDS_HUMAN_REVIEW" | "REJECTED";

export type RaceComplexity = "LOW" | "MEDIUM" | "HIGH";

export type RunnerProfile =
  | "BASE_POTENTIELLE"
  | "FAVORI_LOGIQUE"
  | "OUTSIDER"
  | "TOCARD_SPECULATIF"
  | "RISQUE"
  | "A_EVITER"
  | "INSUFFICIENT_DATA";

/** Schéma conforme cahier des charges §10.3 */
export interface FieldAnalyzerResult {
  agent:                "FieldAnalyzer";
  course_id:            string;
  validation_status:    ValidationStatus;
  status:               FieldAnalyzerStatus;
  data_completeness_score: number;       // 0-100
  field_quality_score:     number;       // 0-100
  race_complexity:         RaceComplexity;
  main_risks: Array<{
    type:        string;
    description: string;
    severity:    "LOW" | "MEDIUM" | "HIGH";
  }>;
  runners_analysis: RunnerAnalysis[];
  top_signals: string[];
  red_flags:   string[];
}

export interface RunnerAnalysis {
  runner_id:           string;
  number:              number;
  name:                string;
  global_score:        number;
  confidence_score:    number;
  regularity_score:    number;
  form_score:          number;
  distance_score:      number;
  terrain_score:       number;
  jockey_driver_score: number;
  trainer_score:       number;
  value_score:         number;
  risk_score:          number;
  profile:             RunnerProfile;
  strengths:           string[];
  weaknesses:          string[];
  missing_data:        string[];
  notes_for_selection_builder: string;
}

// ─────────────────────────────────────────────────────────────────────────
// 9. AGENT 3 — SelectionBuilder
// ─────────────────────────────────────────────────────────────────────────

export type SelectionType = "FREE_6" | "QUINTE_8" | "ELITE_QUINTE_6";

export type SelectionStatus =
  | "SELECTION_READY"
  | "NEEDS_HUMAN_REVIEW"
  | "REJECTED";

export type RunnerRole = "BASE" | "APPUI" | "OUTSIDER" | "COMPLEMENT";

export type ReasonCode =
  | "FORM"
  | "REGULARITY"
  | "DISTANCE"
  | "TERRAIN"
  | "JOCKEY_DRIVER"
  | "VALUE";

/** Schéma conforme cahier des charges §11.6 */
export interface SelectionBuilderResult {
  agent:                "SelectionBuilder";
  course_id:            string;
  access_level:         NiveauAcces;
  selection_type:       SelectionType;
  validation_status:    ValidationStatus;
  mandatory_public_mention: string;
  status:               SelectionStatus;
  expected_runner_count: number;
  selected_runners: Array<{
    rank:            number;
    runner_id:       string;
    number:          number;
    name:            string;
    role:            RunnerRole;
    confidence_score: number;
    risk_score:      number;
    reason_codes:    ReasonCode[];
  }>;
  excluded_runners: Array<{
    runner_id: string;
    number:    number;
    name:      string;
    reason:    string;
  }>;
  selection_confidence_score: number;
  self_critique: {
    main_risk:                          string;
    why_this_selection_fits_access_level: string;
    needs_admin_attention:               boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 10. AGENT 4 — AnalyseWriter
// ─────────────────────────────────────────────────────────────────────────

export type DraftStatus = "DRAFT_READY" | "NEEDS_HUMAN_REVIEW";

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

/** Schéma conforme cahier des charges §12.3 */
export interface AnalyseWriterResult {
  agent:               "AnalyseWriter";
  draft_id:            string;
  course_id:           string;
  access_level:        NiveauAcces;
  title:               string;
  status:              DraftStatus;
  validation_badge:    string;  // depuis VALIDATION_BADGES
  subscriber_content: {
    intro:         string;
    course_context: string;
    race_reading:  string;
    selection: Array<{
      rank:      number;
      runner_id: string;
      number:    number;
      name:      string;
      role:      RunnerRole;
      text:      string;
    }>;
    main_pick: {
      runner_id: string;
      number:    number;
      name:      string;
      text:      string;
    };
    supporting_picks: Array<{
      runner_id: string;
      number:    number;
      name:      string;
      text:      string;
    }>;
    outsider: {
      runner_id: string;
      number:    number;
      name:      string;
      text:      string;
    };
    risks: string[];
    suggested_ticket: string;
    confidence_level: ConfidenceLevel;
    responsible_note: string;
  };
  admin_notes: {
    why_this_pronostic:               string;
    points_to_verify_before_publish: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 11. AGENT 5 — QualityValidator
// ─────────────────────────────────────────────────────────────────────────

export type ValidatorStatus =
  | "APPROVED_FOR_ADMIN_REVIEW"
  | "NEEDS_CORRECTION"
  | "NEEDS_HUMAN_REVIEW"
  | "REJECTED";

/** Schéma conforme cahier des charges §13.4 */
export interface QualityValidatorResult {
  agent:        "QualityValidator";
  draft_id:     string;
  course_id:    string;
  access_level: NiveauAcces;
  status:       ValidatorStatus;
  quality_score: number;            // 0-100
  africa_validation_check: {
    passed:                          boolean;
    validation_status:               ValidationStatus;
    mandatory_mention_present:       boolean;
    source_evidence_sufficient:      boolean;
  };
  access_level_check: {
    passed:                            boolean;
    expected_runner_count:             number;
    actual_runner_count:               number;
    free_course_different_from_elite:  boolean;
  };
  source_policy_check: {
    passed:                                    boolean;
    forbidden_sources_detected:                string[];
    secondary_sources_used_only_for_enrichment: boolean;
  };
  discipline_check: {
    passed:        boolean;
    discipline:    Discipline;
    confirmed_by:  string;
  };
  checks: {
    json_valid:                       boolean;
    no_gain_promise:                  boolean;
    runners_exist:                    boolean;
    no_non_runner_selected:           boolean;
    has_risk_section:                 boolean;
    has_confidence_level:             boolean;
    has_fact_based_reasoning:         boolean;
    selection_consistent_with_scores: boolean;
    subscriber_readability_ok:        boolean;
  };
  blocking_issues: Array<{
    code:    string;
    message: string;
    severity: "BLOCKING";
  }>;
  warnings: Array<{
    code:    string;
    message: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
  }>;
  suggested_fixes: string[];
  admin_comment:   string;
}

// ─────────────────────────────────────────────────────────────────────────
// 12. AGENT 6 — NotificationBuilder
// ─────────────────────────────────────────────────────────────────────────

export interface NotificationBuilderResult {
  agent:      "NotificationBuilder";
  date:       string;
  message:    string;
  /** Canaux d'envoi : "slack" | "email" | "whatsapp" — à venir */
  channels:   string[];
  drafts_ready_count:    number;
  drafts_blocked_count:  number;
  africa_issues_count:   number;
}

// ─────────────────────────────────────────────────────────────────────────
// 13. AI PRONOSTIC DRAFT (ce qui est stocké en BDD)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Draft final stocké dans la table `ai_pronostic_drafts` (cahier §23).
 * Une fois passé par QualityValidator, attend review humaine via
 * /admin/pronostics/ai-review avant publication réelle.
 */
export interface AiPronosticDraft {
  id:                          string;
  draft_date:                  string;
  access_level:                NiveauAcces;
  course_id:                   string;
  validation_status:           ValidationStatus;
  validation_badge:            string;
  africa_course_score:         number | null;
  source_confidence_score:     number | null;
  selection_confidence_score:  number | null;
  quality_score:               number | null;
  status:                      ValidatorStatus;
  title:                       string;
  subscriber_content:          AnalyseWriterResult["subscriber_content"];
  selection:                   SelectionBuilderResult["selected_runners"];
  risks:                       string[];
  source_evidence:             SourceEvidence[];
  validator_report:            QualityValidatorResult;
  agent_logs: {
    CourseSelector?:   CourseSelectorResult;
    FieldAnalyzer?:    FieldAnalyzerResult;
    SelectionBuilder?: SelectionBuilderResult;
    AnalyseWriter?:    AnalyseWriterResult;
    QualityValidator?: QualityValidatorResult;
  };
  human_review: {
    edited_by:     string | null;
    edited_at:     string | null;
    decision:      "PENDING" | "PUBLISHED" | "REJECTED";
    human_comment: string | null;
  };
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────
// 14. DIRECTOR — résultat global du run
// ─────────────────────────────────────────────────────────────────────────

export interface DirectorRunResult {
  ok:          boolean;
  date:        string;
  duration_ms: number;
  drafts_saved: number;
  drafts_blocked: number;
  drafts_needs_review: number;
  errors: Array<{
    agent:     string;
    course_id?: string;
    message:   string;
  }>;
  /** Tokens consommés par appel Claude (estimation coût) */
  tokens_used: {
    sonnet_input:  number;
    sonnet_output: number;
    haiku_input:   number;
    haiku_output:  number;
  };
  notification?: NotificationBuilderResult;
}

// ─────────────────────────────────────────────────────────────────────────
// 15. MODÈLES CLAUDE
// ─────────────────────────────────────────────────────────────────────────

export const CLAUDE_MODELS = {
  /** Reasoning complexe : sélection courses, validation éditoriale */
  SONNET: "claude-sonnet-4-5",
  /**
   * Tâches simples : rédaction, transformations.
   *
   * Historique des essais (en test prod) :
   *   - `claude-3-5-haiku-latest`     → 404 (alias retiré)
   *   - `claude-3-5-haiku-20241022`   → 404 (snapshot déprécié)
   *
   * Vérification doc officielle Anthropic (mai 2026) : toute la gamme
   * Haiku 3.5 est dépréciée. Le modèle Haiku actuel est `claude-haiku-4-5`
   * (snapshot `claude-haiku-4-5-20251001` sous-jacent).
   *
   * Tarif Haiku 4.5 : $1/MTok input + $5/MTok output (vs ~$0.80/$4 pour 3.5).
   * Coût AnalyseWriter passe de ~$0.005 à ~$0.007 → pipeline complet
   * ~$0.10/jour soit ~$3/mois (budget cahier $2.70 +/- arrondi).
   */
  HAIKU:  "claude-haiku-4-5",
} as const;

export type ClaudeModel = typeof CLAUDE_MODELS[keyof typeof CLAUDE_MODELS];

// ─────────────────────────────────────────────────────────────────────────
// 16. CONSTANTES DE SEUILS (cahier des charges §20)
// ─────────────────────────────────────────────────────────────────────────

/** Seuils minimum africa_course_score par niveau d'accès (§20) */
export const MIN_AFRICA_SCORE_BY_LEVEL: Record<NiveauAcces, number> = {
  FREE:    68,
  STARTER: 75,
  PRO:     75,
  ELITE:   85,
};

/** Seuil sous lequel CourseSelector envoie en review humaine (§9.3) */
export const AFRICA_SCORE_REVIEW_THRESHOLD = 60;

/** Seuil minimum data_completeness_score pour FieldAnalyzer */
export const MIN_DATA_COMPLETENESS_SCORE = 65;

/** Seuil minimum field_quality_score pour FieldAnalyzer */
export const MIN_FIELD_QUALITY_SCORE = 60;

/** Seuil minimum selection_confidence_score pour SelectionBuilder */
export const MIN_SELECTION_CONFIDENCE_SCORE = 65;

/** Seuil pour qu'un cheval puisse être base prioritaire */
export const MIN_CONFIDENCE_FOR_BASE = 70;

/** Seuil minimum quality_score pour passer en admin review */
export const MIN_QUALITY_SCORE_FOR_ADMIN = 75;
