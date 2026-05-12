/**
 * lib/ai-pronostics/types.ts
 *
 * Types partagés du système Multi-Agents IA Elite Turf.
 *
 * Architecture : Director + 5 Workers Agents spécialisés.
 * Chaque agent est une fonction async fortement typée. Pas de framework
 * (pas Mastra) — juste de l'orchestration TypeScript native pour rester
 * compatible Cloudflare Workers et garder le contrôle des coûts API.
 *
 * Cycle de vie :
 *   1. Director charge le contexte du jour
 *   2. CourseSelector → choisit 3 courses (ELITE/PRO/GRATUIT)
 *   3. FieldAnalyzer × 3 → enrichit chaque field avec stats historiques
 *   4. SelectionBuilder × 3 → construit la sélection par niveau
 *   5. AnalyseWriter × 3 → rédige les analyses_courtes (Claude)
 *   6. QualityValidator → valide chaque pronostic avant insertion
 *   7. Director compile + INSERT en BDD (publie=false, attente review)
 *
 * Tous les agents partagent ce vocabulaire de types.
 */

// ── Types Domain ──────────────────────────────────────────────────────────

export type NiveauAcces = "GRATUIT" | "PRO" | "ELITE";
export type TypePari    = "SIMPLE" | "TIERCE" | "QUARTE" | "QUINTE_PLUS";
export type Confiance   = "FAIBLE" | "MOYEN" | "ELEVE" | "TRES_ELEVE";

/** Course du jour candidate à pronostiquer */
export interface CourseCandidate {
  id:             string;
  numero_reunion: number;
  numero_course:  number;
  libelle:        string;
  date_course:    string;
  heure_depart:   string | null;
  hippodrome:     string;
  hippodrome_pays: string;
  nb_partants:    number;
  distance_metres: number | null;
  categorie:       string | null;     // PLAT / TROT / OBSTACLE
  paris_disponibles: string[];        // ["QUINTE_PLUS","QUARTE","TIERCE"...]
  statut:          string;
}

/** Partant enrichi avec stats historiques (réutilise PartantEnrichi de lib/courses) */
export interface PartantPourAnalyse {
  numero:     number;
  nom_cheval: string;
  jockey:     string | null;
  entraineur: string | null;
  cote:       number | null;
  musique:    string | null;
  poids_kg:   number | null;
  non_partant: boolean;
  // Scores composites (de getCourseStatsEnrichies)
  score_composite: number;
  badges: {
    vedette:   boolean;
    value_bet: boolean;
    favori:    boolean;
  };
  stats_cheval_taux_victoire: number | null;
  forme_musique_ratio:        number | null;
}

// ── Types Agents I/O ──────────────────────────────────────────────────────

/** Output du CourseSelectorAgent */
export interface CourseSelectionResult {
  elite:   CourseCandidate;
  pro:     CourseCandidate;
  gratuit: CourseCandidate;
  /** Raisonnement explicatif pour audit/debug */
  reasoning: {
    elite_why:   string;
    pro_why:     string;
    gratuit_why: string;
  };
}

/** Output du FieldAnalyzerAgent */
export interface FieldAnalysis {
  course_id: string;
  partants:  PartantPourAnalyse[];
  /** Top 3 par score composite (vedettes du field) */
  top_3:     PartantPourAnalyse[];
  /** Outsiders avec value-bet (cote ≥ 8 et taux ≥ 15%) */
  outsiders: PartantPourAnalyse[];
}

/** Output du SelectionBuilderAgent */
export interface SelectionBuilt {
  course_id:    string;
  niveau:       NiveauAcces;
  type_pari:    TypePari;
  selection:    number[];           // numéros chevaux ordonnés
  confiance:    Confiance;
  /** Pour debug/audit : pourquoi cette sélection */
  reasoning:    string;
}

/** Output du AnalyseWriterAgent */
export interface AnalyseWritten {
  course_id:      string;
  analyse_courte: string;            // 150-300 chars, style Elite Turf
  analyse_texte?: string;            // version longue (premium) — optionnel
}

/** Output du QualityValidatorAgent */
export interface ValidationResult {
  course_id: string;
  ok:        boolean;
  errors:    string[];
  warnings:  string[];
}

/** Draft de pronostic final (avant INSERT BDD) */
export interface PronosticDraft {
  course_id:      string;
  niveau_acces:   NiveauAcces;
  type_pari:      TypePari;
  selection:      number[];
  confiance:      Confiance;
  analyse_courte: string;
  analyse_texte?: string;
  source:         "AI-MULTI-AGENT";
  publie:         boolean;           // false par défaut, attend review humaine
}

// ── Types Director ────────────────────────────────────────────────────────

/** Résultat final du Director (workflow complet) */
export interface DirectorRunResult {
  ok:           boolean;
  date:         string;              // YYYY-MM-DD
  duration_ms:  number;
  drafts:       PronosticDraft[];    // 0-3 drafts insérés
  errors:       Array<{ agent: string; course_id?: string; message: string }>;
  /** Tokens consommés par appel Claude (estimation coût) */
  tokens_used:  {
    sonnet_input:  number;
    sonnet_output: number;
    haiku_input:   number;
    haiku_output:  number;
  };
}

// ── Types Modèles Anthropic ───────────────────────────────────────────────

/** Modèles Claude utilisés selon la complexité de la tâche */
export const CLAUDE_MODELS = {
  /** Reasoning complexe : sélection courses, validation, decision making */
  SONNET: "claude-sonnet-4-5",
  /** Tâches simples / rédaction : analyse_courte, transformations */
  HAIKU:  "claude-3-5-haiku-latest",
} as const;

export type ClaudeModel = typeof CLAUDE_MODELS[keyof typeof CLAUDE_MODELS];
