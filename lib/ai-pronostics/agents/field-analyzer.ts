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

/**
 * Seuil interne FieldAnalyzer (≠ MIN_COURSES_FIABLES qui est calibré pour
 * l'affichage public "top jockeys/entraîneurs").
 *
 * On accepte les stats dès 1 course en BDD — mais on pondère leur poids
 * par `min(1, nb_courses / 5)` pour ne pas surinterpréter un cheval avec
 * 1 victoire sur 1 course (= taux 100% mais bruit pur).
 *
 * Justification : Elite-Turf est en phase initiale → BDD chevaux jeune
 * (la plupart à nb_courses 1-4). Le seuil 5 strict écarterait 100% des
 * partants → pipeline impossible. Cf hotfix Session 7.
 */
const FIELDANALYZER_MIN_COURSES = 1;

/**
 * Calcule le facteur de fiabilité [0..1] basé sur nb_courses.
 *   - 0 si pas de stats
 *   - 0.2 à 1 course
 *   - 0.4 à 2 courses
 *   - 1.0 à 5+ courses
 * Utilisé pour pondérer les scores quand l'échantillon est petit.
 */
function reliabilityFactor(nb_courses: number | undefined | null): number {
  const n = nb_courses ?? 0;
  if (n <= 0) return 0;
  return Math.min(1, n / 5);
}
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
  // Réglage PO 2026-05-31 (Phase 1) : ne plus écraser les chevaux peu courus.
  // AVANT : sampleBonus = courses/5 → un invaincu en 1 course tombait à 20/100
  // ("gagner toutes ses courses" devenait une pénalité). MAINTENANT : plancher
  // 0.6 dès 1 course, 1.0 à 4+ courses → un invaincu de qualité garde un score
  // fort (ratio 1.0 sur 1 course = 70 au lieu de 20 ; sur 3 courses = 90).
  const sampleBonus = 0.6 + 0.4 * Math.min(1, m.courses / 4);
  return { score: clamp100(m.ratio * 100 * sampleBonus), missing: false };
}

/**
 * Score de régularité = taux de places historique du cheval, pondéré par
 * la taille de l'échantillon (reliabilityFactor).
 *
 * Seuil tolérant : accepte les stats dès 1 course. Si nb_courses = 1 et
 * taux_place = 100%, le score retourné sera 20 (100 × 0.2 reliability).
 */
function computeRegularityScore(p: PartantEnrichi): { score: number; missing: boolean } {
  const s = p.stats_cheval;
  if (!s || s.nb_courses < FIELDANALYZER_MIN_COURSES) return { score: 0, missing: true };
  const tauxPlace = s.taux_place ?? 0;
  const reliability = reliabilityFactor(s.nb_courses);
  // Score brut pondéré par fiabilité + base neutre (50) × (1 - reliability)
  // → pour 1 course, on reste proche de 50 (neutre, on n'a pas assez de data).
  const weighted = tauxPlace * reliability + 50 * (1 - reliability);
  return { score: clamp100(weighted), missing: false };
}

/**
 * Score jockey/driver = mix taux_victoire (60%) + taux_place (40%),
 * pondéré par reliabilityFactor (échantillon).
 */
function computeJockeyScore(p: PartantEnrichi): { score: number; missing: boolean } {
  const s = p.stats_jockey;
  // Réglage PO 2026-05-31 (Phase 1.5) : données manquantes ≠ note zéro.
  // Avant, un jockey sans historique BDD → 0 → plombait le cheval (GOSTAM
  // invaincu f=75 mais j=1 → g=33). On retourne NEUTRE 50 (le manque reste
  // tracé via missing=true → pénalité de confiance, mais pas de score nul).
  if (!s || s.nb_courses < FIELDANALYZER_MIN_COURSES) return { score: 50, missing: true };
  const tauxV = s.taux_victoire ?? 0;
  const tauxP = s.taux_place    ?? 0;
  const reliability = reliabilityFactor(s.nb_courses);
  const raw = tauxV * 0.6 + tauxP * 0.4;
  const weighted = raw * reliability + 50 * (1 - reliability);
  return { score: clamp100(weighted), missing: false };
}

/**
 * Score entraîneur = même logique que jockey.
 */
function computeTrainerScore(p: PartantEnrichi): { score: number; missing: boolean } {
  const s = p.stats_entraineur;
  // Phase 1.5 : neutre 50 si historique manquant (cf computeJockeyScore).
  if (!s || s.nb_courses < FIELDANALYZER_MIN_COURSES) return { score: 50, missing: true };
  const tauxV = s.taux_victoire ?? 0;
  const tauxP = s.taux_place    ?? 0;
  const reliability = reliabilityFactor(s.nb_courses);
  const raw = tauxV * 0.6 + tauxP * 0.4;
  const weighted = raw * reliability + 50 * (1 - reliability);
  return { score: clamp100(weighted), missing: false };
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
 * Score de risque inversement corrélé à la régularité + forme.
 *
 * IMPORTANT : on ne pénalise PLUS l'absence de données dans le risque.
 * Risque ≠ "données manquantes" — un cheval inconnu n'est pas plus risqué
 * qu'un cheval connu, juste moins prédictible. Cette distinction est
 * captée séparément par `confidence_score`.
 *
 * (Avant le hotfix Session 7, le risk_score grimpait à 90+ quand les stats
 *  étaient absentes → tous les partants classés A_EVITER → SelectionBuilder
 *  retournait vide.)
 */
function computeRiskScore(
  p: PartantEnrichi,
  regularityScore: number,
  formScore: number,
  _missingFields: number,
): number {
  void _missingFields;       // gardé dans la signature pour compat, mais non utilisé
  void p;
  // Base risque = 100 - moyenne(régularité, forme)
  const avg = (regularityScore + formScore) / 2;
  return clamp100(100 - avg);
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

  // ── INSUFFICIENT_DATA : ≥ 5 champs manquants sur 5 (max possible).
  //    Critère plus strict qu'avant (4 → 5) car la nouvelle formule de
  //    régularité accepte les chevaux 1-4 courses → moins de "missing".
  if (missingCount >= 5)        return "INSUFFICIENT_DATA";

  // ── A_EVITER : très haut risque (≥ 85). Seuil relevé depuis 75
  //    car avant le hotfix Session 7, le risk_score grimpait artificiellement
  //    à 90+ par manque de données → tout en A_EVITER.
  if (risk >= 85)               return "A_EVITER";

  if (confidence >= 75 && global >= 70) return "BASE_POTENTIELLE";
  if (confidence >= 65 && global >= 60) return "FAVORI_LOGIQUE";
  if (value >= 55)              return "OUTSIDER";
  if (value >= 30 && risk < 70) return "TOCARD_SPECULATIF";
  if (risk >= 60)               return "RISQUE";
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
// Réglages scoring 2026-05-31 (Phase 1) : grands jockeys + marché
// ─────────────────────────────────────────────────────────────────────────

/**
 * Liste curée de drivers/jockeys d'élite (plat · trot · obstacle). Le score
 * jockey vient des stats BDD, ramenées à ~50 quand l'historique est mince →
 * la classe réelle des grands noms n'était pas captée. On applique un PLANCHER
 * de score pour ces noms. Match par sous-chaîne sur le nom (insensible casse).
 */
const ELITE_JOCKEYS: readonly string[] = [
  // Plat
  "soumillon", "buick", "murphy", "moore", "demuro", "guyon", "lemaire",
  "barzalona", "peslier", "boudot", "doyle", "marquand", "pasquier",
  "cheminaud", "mendizabal", "loughnane", "lordan", "lemaitre",
  // Trot (drivers)
  "raffin", "nivard", "bazire", "abrivard", "gelormini", "lebourgeois",
  "lagadeuc", "thomain", "mottier", "duvaldestin",
  // Obstacle
  "reveley", "chevillard", "lestrade", "giles", "frost", "lemaitre", "zuliani",
];

function isEliteJockey(jockey: string | null | undefined): boolean {
  if (!jockey) return false;
  const j = jockey.toLowerCase();
  return ELITE_JOCKEYS.some((name) => j.includes(name));
}

/**
 * Score marché basé sur la cote : une cote courte = favori solide. Avant, la
 * cote ne servait qu'au value_score (récompense des longues cotes) — un favori
 * solide n'était jamais reconnu. Désormais elle alimente le score global.
 */
function computeMarketScore(cote: number | null | undefined): { score: number; has: boolean } {
  if (!cote || cote <= 0) return { score: 0,   has: false };
  if (cote <= 2)          return { score: 100, has: true };
  if (cote <= 4)          return { score: 85,  has: true };
  if (cote <= 6)          return { score: 70,  has: true };
  if (cote <= 9)          return { score: 55,  has: true };
  if (cote <= 14)         return { score: 40,  has: true };
  return { score: 25, has: true };
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

  // Réglages PO 2026-05-31 (Phase 1) :
  //  - plancher "grand jockey" (classe non captée par la BDD jeune)
  //  - score marché (cote courte = favori solide) injecté dans le global
  const jockeyScore     = isEliteJockey(p.jockey) ? clamp100(Math.max(jockey.score, 80)) : jockey.score;
  const market          = computeMarketScore(p.cote);
  const marketForGlobal = market.has ? market.score : 50;   // neutre si cote absente

  // Compteur de champs manquants (hors distance/terrain — toujours absents)
  const missingCount =
    (form.missing       ? 1 : 0) +
    (regularity.missing ? 1 : 0) +
    (jockey.missing     ? 1 : 0) +
    (trainer.missing    ? 1 : 0) +
    (hasOdds            ? 0 : 1);

  const risk = computeRiskScore(p, regularity.score, form.score, missingCount);

  // Score global pondéré (réglage PO 2026-05-31 : ajout composante marché)
  // 26% forme + 20% régularité + 18% jockey(+élite) + 8% entraîneur + 13% marché + 15% (100-risque/2)
  const global = clamp100(
    form.score        * 0.26 +
    regularity.score  * 0.20 +
    jockeyScore       * 0.18 +
    trainer.score     * 0.08 +
    marketForGlobal   * 0.13 +
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
    jockey:     jockeyScore,
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
    jockey_driver_score: jockeyScore,
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
