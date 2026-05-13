/**
 * lib/ai-pronostics/agents/field-analyzer.ts
 *
 * Worker Agent #2 — FieldAnalyzer (cahier des charges §10).
 *
 * 🎯 RÔLE
 *   Analyse en profondeur le field d'une course, déterministe à 100 %.
 *   N'invente AUCUNE donnée. Produit un signal exploitable pour les
 *   agents en aval (SelectionBuilder, AnalyseWriter).
 *
 * 💰 COÛT : $0 (aucun appel LLM)
 *
 * 🧱 PIPELINE
 *   1. Vérifier que la course a un validation_status acceptable
 *   2. Charger les partants depuis Supabase
 *   3. Réutiliser getCourseStatsEnrichies (croisement BDD historique)
 *   4. Pour chaque partant : calculer 10 sous-scores normalisés [0..100]
 *   5. Calculer data_completeness_score + field_quality_score + complexity
 *   6. Détecter les risques majeurs + signaux + red flags
 *   7. Retourner FieldAnalyzerResult conforme §10.3
 *
 * 🛡️ GARDE-FOUS
 *   - status="REJECTED" si validation_status absent
 *   - status="NEEDS_HUMAN_REVIEW" si data_completeness_score < MIN_DATA_COMPLETENESS_SCORE
 *   - profile="INSUFFICIENT_DATA" pour tout partant avec trop de stats manquantes
 *
 * 📜 Conforme cahier des charges §10 + §13.3 règle 11 (data_completeness ≥ 65).
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getCourseStatsEnrichies } from "@/lib/courses/getCourseStatsEnrichies";
import type { PartantEnrichi, PartantInput } from "@/lib/courses/stats-types";
import { MIN_COURSES_FIABLES } from "@/lib/courses/stats-types";
import type {
  FieldAnalyzerResult,
  FieldAnalyzerStatus,
  RaceComplexity,
  RunnerAnalysis,
  RunnerProfile,
  ValidationStatus,
} from "../types";
import { MIN_DATA_COMPLETENESS_SCORE } from "../types";

// ─────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ─────────────────────────────────────────────────────────────────────────

export interface FieldAnalyzerInput {
  course_id:         string;
  /** Validation Afrique attribuée par CourseSelector — pré-requis cahier §10.1 */
  validation_status: ValidationStatus | null;
  /** Optionnel : pré-charge des partants (sinon chargés depuis BDD). */
  partants?:         PartantInput[];
}

// ─────────────────────────────────────────────────────────────────────────
// Loaders BDD
// ─────────────────────────────────────────────────────────────────────────

async function loadPartants(courseId: string): Promise<PartantInput[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("partants")
    .select("id, numero, nom_cheval, jockey, entraineur, cote, musique, poids_kg, non_partant")
    .eq("course_id", courseId);

  if (error || !data) return [];

  return data
    .filter((p) => !p.non_partant)
    .map((p) => ({
      id:         p.id,
      numero:     p.numero,
      nom_cheval: p.nom_cheval,
      jockey:     p.jockey,
      entraineur: p.entraineur,
      cote:       p.cote,
      musique:    p.musique,
      poids_kg:   p.poids_kg,
    }));
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers de scoring (déterministes, 0-100)
// ─────────────────────────────────────────────────────────────────────────

/** Force une valeur dans [0, 100], arrondie à l'entier. */
function clamp100(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Score de forme récente basé sur la musique parsée (ratio top-3).
 * - 0 = pas de musique
 * - 100 = 100 % top-3 sur ≥ 5 dernières
 */
function computeFormScore(p: PartantEnrichi): { score: number; missing: boolean } {
  const m = p.forme_musique;
  if (!m || m.courses === 0) return { score: 0, missing: true };
  const sampleBonus = Math.min(1, m.courses / 5);   // pénalise si < 5 courses
  return { score: clamp100(m.ratio * 100 * sampleBonus), missing: false };
}

/**
 * Score de régularité = taux de places historique du cheval.
 * Pondéré par nb_courses pour éviter le bruit.
 */
function computeRegularityScore(p: PartantEnrichi): { score: number; missing: boolean } {
  const s = p.stats_cheval;
  if (!s || s.nb_courses < MIN_COURSES_FIABLES) return { score: 0, missing: true };
  const tauxPlace = s.taux_place ?? 0;
  return { score: clamp100(tauxPlace), missing: false };
}

/**
 * Score jockey/driver = taux victoire historique du jockey.
 */
function computeJockeyScore(p: PartantEnrichi): { score: number; missing: boolean } {
  const s = p.stats_jockey;
  if (!s || s.nb_courses < MIN_COURSES_FIABLES) return { score: 0, missing: true };
  // Mix taux_victoire (poids 60%) + taux_place (poids 40%) — capté à 100
  const tauxV = s.taux_victoire ?? 0;
  const tauxP = s.taux_place    ?? 0;
  return { score: clamp100(tauxV * 0.6 + tauxP * 0.4), missing: false };
}

/**
 * Score entraîneur = même logique que jockey.
 */
function computeTrainerScore(p: PartantEnrichi): { score: number; missing: boolean } {
  const s = p.stats_entraineur;
  if (!s || s.nb_courses < MIN_COURSES_FIABLES) return { score: 0, missing: true };
  const tauxV = s.taux_victoire ?? 0;
  const tauxP = s.taux_place    ?? 0;
  return { score: clamp100(tauxV * 0.6 + tauxP * 0.4), missing: false };
}

/**
 * Score "value" = anti-corrélation cote / forme. Cheval avec
 * bonne forme ET cote élevée → value bet.
 */
function computeValueScore(p: PartantEnrichi, formScore: number): number {
  if (!p.cote || p.cote <= 0) return 0;
  // Cote ≥ 10 ET forme ≥ 50 → ramping
  if (p.cote < 5) return 0;                       // pas de value sur favoris
  const coteFactor = Math.min(1, (p.cote - 5) / 25);  // ramping 5→30
  const formFactor = formScore / 100;
  return clamp100(coteFactor * formFactor * 100);
}

/**
 * Score de risque = inversement corrélé à la régularité + forme +
 * complétude des données. Élevé = à éviter.
 */
function computeRiskScore(
  p: PartantEnrichi,
  regularityScore: number,
  formScore: number,
  missingFields: number,
): number {
  // Base risque = 100 - moyenne(régularité, forme) / 2
  const baseRisk = 100 - (regularityScore + formScore) / 2;
  // Pénalité pour données manquantes (jusqu'à +20)
  const missingPenalty = Math.min(20, missingFields * 5);
  return clamp100(baseRisk + missingPenalty);
}

/**
 * Score "distance" et "terrain" : on n'a pas (encore) ces données
 * spécifiques en BDD → on les laisse à 50 (neutre) + on marque comme missing.
 * Sera enrichi quand on aura les tables `cheval_aptitudes` (futur).
 */
function neutralScoreWithMissing(): { score: number; missing: boolean } {
  return { score: 50, missing: true };
}

/**
 * Classifie un partant dans l'un des 7 profils RunnerProfile.
 */
function classifyProfile(args: {
  global:       number;
  confidence:   number;
  value:        number;
  risk:         number;
  missingCount: number;
}): RunnerProfile {
  const { global, confidence, value, risk, missingCount } = args;

  if (missingCount >= 4)        return "INSUFFICIENT_DATA";
  if (risk >= 75)               return "A_EVITER";
  if (confidence >= 75 && global >= 70) return "BASE_POTENTIELLE";
  if (confidence >= 65 && global >= 60) return "FAVORI_LOGIQUE";
  if (value >= 55)              return "OUTSIDER";
  if (value >= 30 && risk < 70) return "TOCARD_SPECULATIF";
  if (risk >= 60)               return "RISQUE";
  // Par défaut, niveau correct mais sans saillance
  return "FAVORI_LOGIQUE";
}

/**
 * Détecte les forces de ce partant (strings explicatives, pour debug/UI).
 */
function detectStrengths(p: PartantEnrichi, scores: {
  form: number; regularity: number; jockey: number; trainer: number; value: number;
}): string[] {
  const s: string[] = [];
  if (scores.form       >= 60) s.push("Bonne forme récente (musique)");
  if (scores.regularity >= 50) s.push(`Cheval régulier (${p.stats_cheval?.taux_place?.toFixed(0)}% placé)`);
  if (scores.jockey     >= 60) s.push(`Jockey performant (${p.stats_jockey?.taux_victoire?.toFixed(0)}% victoire)`);
  if (scores.trainer    >= 60) s.push("Entraîneur en réussite");
  if (scores.value      >= 60) s.push("Cote intéressante vs forme");
  if (p.badges?.vedette)       s.push("Vedette du field");
  if (p.badges?.value_bet)     s.push("Value bet identifié");
  return s.slice(0, 4);
}

/**
 * Détecte les faiblesses.
 */
function detectWeaknesses(p: PartantEnrichi, scores: {
  form: number; regularity: number; risk: number;
}): string[] {
  const w: string[] = [];
  if (scores.form       < 25 && p.forme_musique) w.push("Forme récente faible");
  if (scores.regularity < 20 && p.stats_cheval && p.stats_cheval.nb_courses >= MIN_COURSES_FIABLES) {
    w.push("Régularité historique insuffisante");
  }
  if (scores.risk >= 65) w.push("Profil à risque élevé");
  if (p.cote && p.cote >= 40) w.push("Cote très élevée — outsider lointain");
  return w.slice(0, 3);
}

/**
 * Liste les champs de données manquants pour ce partant.
 */
function detectMissingData(args: {
  formMissing:        boolean;
  regularityMissing:  boolean;
  jockeyMissing:      boolean;
  trainerMissing:     boolean;
  hasOdds:            boolean;
}): string[] {
  const m: string[] = [];
  if (args.formMissing)       m.push("musique");
  if (args.regularityMissing) m.push("historique_cheval");
  if (args.jockeyMissing)     m.push("historique_jockey");
  if (args.trainerMissing)    m.push("historique_entraineur");
  if (!args.hasOdds)          m.push("cote");
  // distance + terrain toujours manquants pour l'instant (pas en BDD)
  m.push("aptitude_distance", "aptitude_terrain");
  return m;
}

// ─────────────────────────────────────────────────────────────────────────
// Analyse d'un partant
// ─────────────────────────────────────────────────────────────────────────

function analyzeRunner(p: PartantEnrichi): RunnerAnalysis {
  const form        = computeFormScore(p);
  const regularity  = computeRegularityScore(p);
  const jockey      = computeJockeyScore(p);
  const trainer     = computeTrainerScore(p);
  const distance    = neutralScoreWithMissing();
  const terrain     = neutralScoreWithMissing();
  const value       = computeValueScore(p, form.score);
  const hasOdds     = !!p.cote && p.cote > 0;

  // Compteur de champs manquants (hors distance/terrain — toujours absents)
  const missingCount =
    (form.missing       ? 1 : 0) +
    (regularity.missing ? 1 : 0) +
    (jockey.missing     ? 1 : 0) +
    (trainer.missing    ? 1 : 0) +
    (hasOdds            ? 0 : 1);

  const risk = computeRiskScore(p, regularity.score, form.score, missingCount);

  // Score global pondéré (cf cahier §10 + getCourseStatsEnrichies)
  // 30% forme + 25% régularité cheval + 20% jockey + 10% entraîneur + 15% (100 - risque/2)
  const global = clamp100(
    form.score        * 0.30 +
    regularity.score  * 0.25 +
    jockey.score      * 0.20 +
    trainer.score     * 0.10 +
    (100 - risk / 2)  * 0.15,
  );

  // Confidence = global - pénalité données manquantes
  const confidence = clamp100(global - missingCount * 5);

  const profile = classifyProfile({
    global,
    confidence,
    value,
    risk,
    missingCount,
  });

  const strengths = detectStrengths(p, {
    form:       form.score,
    regularity: regularity.score,
    jockey:     jockey.score,
    trainer:    trainer.score,
    value,
  });

  const weaknesses = detectWeaknesses(p, {
    form:       form.score,
    regularity: regularity.score,
    risk,
  });

  const missing_data = detectMissingData({
    formMissing:       form.missing,
    regularityMissing: regularity.missing,
    jockeyMissing:     jockey.missing,
    trainerMissing:    trainer.missing,
    hasOdds,
  });

  // Note succincte pour SelectionBuilder (1-2 phrases)
  const noteParts: string[] = [];
  if (profile === "BASE_POTENTIELLE")   noteParts.push("Candidat base solide");
  if (profile === "OUTSIDER")           noteParts.push(`Outsider intéressant (cote ${p.cote ?? "?"})`);
  if (profile === "A_EVITER")           noteParts.push("À écarter selon les signaux");
  if (profile === "INSUFFICIENT_DATA")  noteParts.push("Données insuffisantes pour conclure");
  if (strengths[0])                     noteParts.push(strengths[0]);
  if (risk >= 60)                       noteParts.push("Risque élevé à intégrer");

  return {
    runner_id:           p.id,
    number:              p.numero,
    name:                p.nom_cheval,
    global_score:        global,
    confidence_score:    confidence,
    regularity_score:    regularity.score,
    form_score:          form.score,
    distance_score:      distance.score,
    terrain_score:       terrain.score,
    jockey_driver_score: jockey.score,
    trainer_score:       trainer.score,
    value_score:         value,
    risk_score:          risk,
    profile,
    strengths,
    weaknesses,
    missing_data,
    notes_for_selection_builder: noteParts.join(" — ") || "Profil neutre",
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Métriques globales du field
// ─────────────────────────────────────────────────────────────────────────

/**
 * Score de complétude des données : % de champs renseignés au niveau du field.
 * Sert au QualityValidator pour décider NEEDS_HUMAN_REVIEW (seuil 75).
 */
function computeDataCompleteness(runners: RunnerAnalysis[]): number {
  if (runners.length === 0) return 0;
  // 5 champs critiques (hors distance/terrain qui sont toujours manquants)
  const criticalFields = ["musique", "historique_cheval", "historique_jockey", "historique_entraineur", "cote"];
  let totalScored = 0;
  let totalFields = runners.length * criticalFields.length;
  for (const r of runners) {
    for (const f of criticalFields) {
      if (!r.missing_data.includes(f)) totalScored += 1;
    }
  }
  return clamp100((totalScored / totalFields) * 100);
}

/**
 * Score de qualité du field = moyenne pondérée des top runners.
 * Indique si la course est "lisible" (favoris solides) ou complexe.
 */
function computeFieldQuality(runners: RunnerAnalysis[]): number {
  if (runners.length === 0) return 0;
  // Top 4 par global_score représentent les profils favoris
  const top4 = [...runners].sort((a, b) => b.global_score - a.global_score).slice(0, 4);
  const avgTop = top4.reduce((sum, r) => sum + r.global_score, 0) / top4.length;
  return clamp100(avgTop);
}

/**
 * Complexité de la course : LOW si écart clair entre top et reste,
 * HIGH si le field est tassé (beaucoup d'incertitude).
 */
function computeRaceComplexity(runners: RunnerAnalysis[]): RaceComplexity {
  if (runners.length < 6) return "MEDIUM";
  const sorted = [...runners].sort((a, b) => b.global_score - a.global_score);
  const top3Avg  = (sorted[0].global_score + sorted[1].global_score + sorted[2].global_score) / 3;
  const rest     = sorted.slice(3);
  const restAvg  = rest.reduce((s, r) => s + r.global_score, 0) / rest.length;
  const gap = top3Avg - restAvg;
  if (gap >= 25) return "LOW";       // top dominent
  if (gap <  10) return "HIGH";      // field tassé
  return "MEDIUM";
}

/**
 * Détection des risques majeurs (signaux globaux du field).
 */
function detectMainRisks(args: {
  runners:        RunnerAnalysis[];
  completeness:   number;
  complexity:     RaceComplexity;
  partantsCount:  number;
}): FieldAnalyzerResult["main_risks"] {
  const risks: FieldAnalyzerResult["main_risks"] = [];

  if (args.completeness < MIN_DATA_COMPLETENESS_SCORE) {
    risks.push({
      type:        "DATA_COMPLETENESS",
      description: `Complétude des données faible (${args.completeness}/100)`,
      severity:    args.completeness < 50 ? "HIGH" : "MEDIUM",
    });
  }

  if (args.complexity === "HIGH") {
    risks.push({
      type:        "RACE_COMPLEXITY",
      description: "Course très ouverte — écart de scores faible entre les partants",
      severity:    "MEDIUM",
    });
  }

  const insufficientCount = args.runners.filter((r) => r.profile === "INSUFFICIENT_DATA").length;
  if (insufficientCount >= 3) {
    risks.push({
      type:        "RUNNERS_DATA_GAPS",
      description: `${insufficientCount} partants avec données insuffisantes`,
      severity:    insufficientCount >= 5 ? "HIGH" : "MEDIUM",
    });
  }

  if (args.partantsCount > 16) {
    risks.push({
      type:        "LARGE_FIELD",
      description: `Grand field (${args.partantsCount} partants) — variance accrue`,
      severity:    "LOW",
    });
  }

  return risks;
}

/**
 * Signaux positifs détectés dans le field (utile pour AnalyseWriter).
 */
function detectTopSignals(runners: RunnerAnalysis[]): string[] {
  const signals: string[] = [];
  const bases = runners.filter((r) => r.profile === "BASE_POTENTIELLE");
  if (bases.length >= 2) {
    signals.push(`${bases.length} bases potentielles identifiées`);
  } else if (bases.length === 1) {
    signals.push(`Base unique : #${bases[0].number} ${bases[0].name}`);
  }
  const outsiders = runners.filter((r) => r.profile === "OUTSIDER" || r.value_score >= 60);
  if (outsiders.length > 0) {
    signals.push(`${outsiders.length} outsider(s) à surveiller`);
  }
  const highForm = runners.filter((r) => r.form_score >= 70);
  if (highForm.length >= 3) {
    signals.push(`${highForm.length} chevaux en bonne forme actuelle`);
  }
  return signals.slice(0, 4);
}

/**
 * Red flags = signaux d'alerte forte (déclenchent attention de l'admin).
 */
function detectRedFlags(args: {
  runners:      RunnerAnalysis[];
  completeness: number;
  fieldQuality: number;
}): string[] {
  const flags: string[] = [];
  if (args.completeness < 50) flags.push("Complétude critique : données BDD insuffisantes");
  if (args.fieldQuality < 40) flags.push("Field de qualité faible : aucun profil dominant");
  const toAvoidCount = args.runners.filter((r) => r.profile === "A_EVITER").length;
  if (toAvoidCount >= 4) flags.push(`${toAvoidCount} partants classés "à éviter"`);
  const allRisks = args.runners.filter((r) => r.risk_score >= 75).length;
  if (allRisks >= args.runners.length * 0.5) {
    flags.push("Majorité des partants en zone de risque élevé");
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────────────
// Point d'entrée principal
// ─────────────────────────────────────────────────────────────────────────

/**
 * Analyse complète d'une course. Retourne un FieldAnalyzerResult prêt à
 * être consommé par SelectionBuilder + persisté dans `ai_pronostic_drafts.agent_logs`.
 *
 * @returns FieldAnalyzerResult conforme §10.3, ou status=REJECTED si la course n'est pas validée Afrique.
 */
export async function runFieldAnalyzerAgent(
  input: FieldAnalyzerInput,
): Promise<FieldAnalyzerResult> {

  // ── Garde-fou 1 : validation Afrique obligatoire (cahier §10.1) ────────
  if (!input.validation_status) {
    return {
      agent:                "FieldAnalyzer",
      course_id:            input.course_id,
      // Type-cast nécessaire : on retourne REJECTED sans validation valide,
      // mais le type ValidationStatus n'inclut pas "absent". On garde la
      // valeur la plus "défensive" du domaine (corroborée) pour ne pas
      // tromper le consommateur.
      validation_status:    "VALIDATION_AFRIQUE_CORROBOREE",
      status:               "REJECTED",
      data_completeness_score: 0,
      field_quality_score:     0,
      race_complexity:         "MEDIUM",
      main_risks: [{
        type:        "VALIDATION_AFRICA_MISSING",
        description: "Course sans validation Afrique — analyse non autorisée (cahier §10.1)",
        severity:    "HIGH",
      }],
      runners_analysis: [],
      top_signals:      [],
      red_flags:        ["Validation Afrique absente — REJECTED par FieldAnalyzer"],
    };
  }

  // ── 1. Charger les partants ────────────────────────────────────────────
  const partants = input.partants ?? await loadPartants(input.course_id);

  if (partants.length === 0) {
    return {
      agent:                "FieldAnalyzer",
      course_id:            input.course_id,
      validation_status:    input.validation_status,
      status:               "REJECTED",
      data_completeness_score: 0,
      field_quality_score:     0,
      race_complexity:         "MEDIUM",
      main_risks: [{
        type:        "NO_RUNNERS",
        description: "Aucun partant valide chargé pour cette course",
        severity:    "HIGH",
      }],
      runners_analysis: [],
      top_signals:      [],
      red_flags:        ["Aucun partant trouvé en BDD"],
    };
  }

  // ── 2. Enrichir avec stats historiques (réutilise getCourseStatsEnrichies) ──
  const enriched = await getCourseStatsEnrichies(partants);

  // ── 3. Analyser chaque partant ─────────────────────────────────────────
  const runners_analysis = enriched.partants.map(analyzeRunner);

  // ── 4. Métriques globales du field ─────────────────────────────────────
  const completeness   = computeDataCompleteness(runners_analysis);
  const fieldQuality   = computeFieldQuality(runners_analysis);
  const complexity     = computeRaceComplexity(runners_analysis);

  // ── 5. Détection des signaux + risques ─────────────────────────────────
  const main_risks  = detectMainRisks({
    runners:       runners_analysis,
    completeness,
    complexity,
    partantsCount: partants.length,
  });
  const top_signals = detectTopSignals(runners_analysis);
  const red_flags   = detectRedFlags({
    runners:      runners_analysis,
    completeness,
    fieldQuality,
  });

  // ── 6. Statut final ────────────────────────────────────────────────────
  const status: FieldAnalyzerStatus =
    completeness < MIN_DATA_COMPLETENESS_SCORE
      ? "NEEDS_HUMAN_REVIEW"
      : red_flags.length >= 2
        ? "NEEDS_HUMAN_REVIEW"
        : "OK";

  return {
    agent:                "FieldAnalyzer",
    course_id:            input.course_id,
    validation_status:    input.validation_status,
    status,
    data_completeness_score: completeness,
    field_quality_score:     fieldQuality,
    race_complexity:         complexity,
    main_risks,
    runners_analysis,
    top_signals,
    red_flags,
  };
}
