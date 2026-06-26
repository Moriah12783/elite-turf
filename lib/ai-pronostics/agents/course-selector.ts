/**
 * lib/ai-pronostics/agents/course-selector.ts
 *
 * Worker Agent #1 — CourseSelector (cahier des charges §9).
 *
 * 🎯 RÔLE
 *   Sélectionne les courses du jour à publier, en tenant compte :
 *   - pertinence sportive
 *   - disponibilité Afrique (validation LONACI directe OU corroborée)
 *   - segmentation Free / Starter / Pro / Elite
 *   - anti-cannibalisation (FREE ≠ ELITE)
 *
 * 🧠 MODÈLE
 *   Claude Sonnet 4.5 — reasoning complexe (choix éditorial parmi candidates).
 *   ~$0.015 par run (input ~3500 tokens, output ~800 tokens).
 *
 * 🛠️ ARCHITECTURE HYBRIDE
 *   1. **Déterministe (TS)** : chargement des courses + scoring africa_course_score
 *      via la formule §9.3. La validation Afrique passe par la table
 *      `course_source_evidence` (peuplée en amont par un job dédié — voir
 *      Session 5).
 *   2. **LLM (Sonnet)** : arbitrage ÉDITORIAL entre les 5-10 candidates
 *      validées : choix de la course Elite vedette, de la Pro/Starter,
 *      et de la course Free distincte des Elite.
 *
 * 🚨 GARDE-FOUS
 *   - Une course sans validation Afrique (score < 60 ou pas de source PRIMARY/
 *     CORROBORATION confirmée) est AUTOMATIQUEMENT rejetée AVANT l'appel LLM.
 *   - Si aucune candidate ne passe le filtre déterministe → status =
 *     NOT_ENOUGH_VALIDATED_AFRICA_COURSES (le LLM n'est même pas appelé).
 *   - Anti-cannibalisation FREE/ELITE vérifiée APRÈS retour LLM (Si le LLM
 *     se trompe, on force NEEDS_HUMAN_REVIEW).
 *
 * 📜 Conforme cahier des charges §9.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { callClaude, CLAUDE_MODELS } from "../claude-client";
import { isSourceAllowed, isSourceForbidden, findSourceByName } from "../sources";
import type {
  CourseCandidate,
  CourseSelectorResult,
  CourseSelectorStatus,
  Discipline,
  SelectedCourse,
  SourceEvidence,
  SourceEvidenceStatus,
  ValidationStatus,
} from "../types";
import {
  AFRICA_SCORE_REVIEW_THRESHOLD,
  MIN_AFRICA_SCORE_BY_LEVEL,
  VALIDATION_BADGES,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────
// Input + helpers
// ─────────────────────────────────────────────────────────────────────────

export interface CourseSelectorInput {
  /** Date cible YYYY-MM-DD (Paris) */
  date: string;
  /** Limite de candidates à envoyer au LLM (défaut 12) */
  maxCandidates?: number;
}

export interface CourseSelectorRunOutput {
  result:        CourseSelectorResult;
  tokens_input:  number;
  tokens_output: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Loader : courses du jour candidates
// ─────────────────────────────────────────────────────────────────────────

/**
 * Charge les courses du jour avec leur contexte (hippodrome, paris dispo, etc).
 * Filtre : statut PROGRAMME, date_course = date cible.
 */
async function loadCandidatesForDate(date: string): Promise<CourseCandidate[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("courses")
    .select(`
      id, libelle, date_course, heure_depart, numero_reunion, numero_course,
      distance_metres, categorie, statut, nb_partants,
      hippodrome:hippodromes ( nom, pays )
    `)
    .eq("date_course", date)
    .eq("statut", "PROGRAMME")
    .order("heure_depart", { ascending: true });

  if (error || !data) return [];

  return data.map((c: any): CourseCandidate => {
    const hippodromeNom  = c.hippodrome?.nom  ?? "Inconnu";
    const hippodromePays = c.hippodrome?.pays ?? "FR";
    const heureParisHHMM = (c.heure_depart as string | null)?.slice(0, 5) ?? null;
    return {
      course_id:          c.id,
      meeting:            `R${c.numero_reunion}`,
      race_number:        `C${c.numero_course}`,
      race_name:          c.libelle,
      date_course:        c.date_course,
      start_time_paris:   heureParisHHMM,
      start_time_abidjan: heureParisHHMM ? convertParisToAbidjan(heureParisHHMM) : null,
      hippodrome:         hippodromeNom,
      hippodrome_pays:    hippodromePays,
      discipline:         mapCategorieToDiscipline(c.categorie),
      distance_metres:    c.distance_metres,
      nb_partants:        c.nb_partants ?? 0,
      paris_disponibles: [],  // hors scope ici (utile pour SelectionBuilder)
      statut:             c.statut,
    };
  });
}

/**
 * Conversion Paris → Abidjan (UTC+0).
 * Approche simplifiée : Paris = UTC+1 en hiver, UTC+2 en été.
 * Pour l'instant on assume UTC+1 (à raffiner avec date-fns-tz en Session 5).
 */
function convertParisToAbidjan(parisHHMM: string): string {
  const [h, m] = parisHHMM.split(":").map(Number);
  const abidjanH = (h - 1 + 24) % 24;  // approximation -1h
  return `${abidjanH.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function mapCategorieToDiscipline(cat: string | null): Discipline | null {
  switch (cat) {
    case "TROT":     return "TROT_ATTELE";   // par défaut, sera affiné si data dispo
    case "PLAT":     return "PLAT";
    case "OBSTACLE": return "HAIES";         // par défaut HAIES (peut être STEEPLE)
    default:         return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Loader : preuves de source pour une course donnée
// ─────────────────────────────────────────────────────────────────────────

/**
 * Charge les preuves de validation source pour une course.
 *
 * 🚨 SESSION 4 NOTE :
 *   La table `course_source_evidence` existe (Session 2) mais n'est pas
 *   encore PEUPLÉE — son alimentation nécessite un job dédié de crawl
 *   LONACI/PMU.fr/etc. que nous ferons en Session 5.
 *
 *   En attendant, ce loader retourne `[]` pour toute course. Conséquence :
 *   sans preuve, le scoring déterministe (cf computeAfricaCourseScore)
 *   retourne 0 et la course est rejetée AVANT l'appel LLM. Cela protège
 *   contre toute publication accidentelle d'une course non validée.
 *
 *   Pour TESTER l'agent en attendant, on peut injecter des preuves
 *   manuellement via SQL ou un script de seed.
 */
async function loadSourceEvidence(courseId: string): Promise<SourceEvidence[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("course_source_evidence")
    .select("course_id, source_name, source_tier, validation_role, matched_fields, confidence, status, source_url, notes")
    .eq("course_id", courseId);

  if (error || !data) return [];

  return data.map((row: any): SourceEvidence => ({
    course_id:       row.course_id,
    source_name:     row.source_name,
    source_tier:     row.source_tier,
    validation_role: row.validation_role,
    matched_fields:  Array.isArray(row.matched_fields)
                       ? row.matched_fields
                       : Object.keys(row.matched_fields ?? {}),
    confidence:      row.confidence ?? 0,
    status:          row.status as SourceEvidenceStatus,
    source_url:      row.source_url ?? undefined,
    notes:           row.notes ?? undefined,
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Scoring déterministe (cahier §9.3)
// ─────────────────────────────────────────────────────────────────────────

interface ScoredCandidate {
  candidate:           CourseCandidate;
  evidence:            SourceEvidence[];
  africa_course_score: number;
  validation_status:   ValidationStatus | null;
  rejected_reason?:    string;
  missing_requirements?: Array<"AFRICA_VALIDATION" | "DISCIPLINE_CONFIRMATION" | "DATA_COMPLETENESS">;
}

/**
 * Calcule africa_course_score selon la formule §9.3.
 * Retourne aussi le validation_status déterministe.
 */
// Pays d'audience actuel = Burkina (abonnés PMUB). Refonte 2026-06-26 : les
// grandes courses PMU France (palier PMU_INTERNATIONAL) sont redistribuées par
// PMUB → on ne les pénalise pas vs LONACI-direct (CI). Bonus borné appliqué sur
// la composante "africa availability".
const AUDIENCE_COUNTRY: string = "BF";
const AUDIENCE_PMU_INTL_BONUS = AUDIENCE_COUNTRY === "BF" ? 15 : 0;

function computeAfricaCourseScore(
  candidate: CourseCandidate,
  evidence:  SourceEvidence[],
): { score: number; validation_status: ValidationStatus | null; missing: ScoredCandidate["missing_requirements"] } {
  const missing: NonNullable<ScoredCandidate["missing_requirements"]> = [];

  // Composantes 0-100
  let africaAvailability = 0;
  let sourceCrosscheck   = 0;
  let dataCompleteness   = 0;
  let fieldReadability   = 0;
  let disciplineConf     = 0;
  let subscriberRelev    = 0;
  let valueOpp           = 0;
  let contradictionRisk  = 0;
  let sourceFragility    = 0;

  // 1. Africa availability : a-t-on au moins 1 source qui valide la dispo ?
  const africaValidators = evidence.filter((ev) => {
    const entry = findSourceByName(ev.source_name);
    return ev.status === "MATCHED" && entry?.can_validate_africa_availability && !entry.is_forbidden;
  });
  const isLonaciDirect = africaValidators.some((ev) =>
    /^lonaci(\.ci)?$/i.test(ev.source_name) && ev.source_tier === "PRIMARY",
  );
  const hasPmuInternationalOnly =
    africaValidators.length > 0 &&
    africaValidators.every((ev) => /^pmu\.fr-international$/i.test(ev.source_name));
  if (africaValidators.length === 0) {
    missing.push("AFRICA_VALIDATION");
  } else if (isLonaciDirect) {
    // LONACI directe = preuve maximale (CI = 90% audience).
    africaAvailability = 100;
  } else if (hasPmuInternationalOnly) {
    // PMU.fr-International seul (3e palier) = redistribution probable mais
    // pas confirmée par un opérateur africain réel.
    // Confidence basée sur le max des critères remplis (65-80) — déjà calculée
    // côté collector dans ev.confidence. On la transpose ici sur l'échelle 0-100.
    africaAvailability = Math.max(...africaValidators.map((ev) => ev.confidence));
    // Audience Burkina (PMUB) : ces courses France SONT jouables au Burkina →
    // bonus pour ne pas les sous-classer face aux courses LONACI-direct (CI).
    africaAvailability = Math.min(100, africaAvailability + AUDIENCE_PMU_INTL_BONUS);
  } else {
    // Au moins un vrai opérateur africain (LONASE/LONAB/PMUC/PMUG/PMU Mali/
    // PMUB/SOREC...) a corroboré → palier intermédiaire.
    africaAvailability = Math.min(90, 60 + africaValidators.length * 10);
  }

  // 2. Source crosscheck : combien de sources whitelistées MATCHED ?
  const matchedWhitelisted = evidence.filter(
    (ev) => ev.status === "MATCHED" && isSourceAllowed(ev.source_name) && !isSourceForbidden(ev.source_name),
  );
  sourceCrosscheck = Math.min(100, matchedWhitelisted.length * 25);

  // 3. Data completeness : moyenne des confidence × nb de matched_fields
  if (matchedWhitelisted.length > 0) {
    const avgConfidence = matchedWhitelisted.reduce((s, ev) => s + ev.confidence, 0) / matchedWhitelisted.length;
    const avgFields     = matchedWhitelisted.reduce((s, ev) => s + ev.matched_fields.length, 0) / matchedWhitelisted.length;
    dataCompleteness = Math.min(100, avgConfidence * 0.5 + Math.min(50, avgFields * 10));
  } else {
    missing.push("DATA_COMPLETENESS");
  }

  // 4. Field readability : basée sur nb_partants (sweet spot 10-16)
  if (candidate.nb_partants >= 10 && candidate.nb_partants <= 16) fieldReadability = 100;
  else if (candidate.nb_partants >= 8 && candidate.nb_partants <= 18) fieldReadability = 75;
  else if (candidate.nb_partants >= 6 && candidate.nb_partants <= 20) fieldReadability = 50;
  else                                                                  fieldReadability = 25;

  // 5. Discipline confirmation : a-t-on une source DISCIPLINE_OFFICIAL ?
  const disciplineConfirmer = evidence.find(
    (ev) => ev.source_tier === "DISCIPLINE_OFFICIAL" && ev.status === "MATCHED",
  );
  if (disciplineConfirmer) {
    disciplineConf = 100;
  } else if (candidate.discipline === null) {
    missing.push("DISCIPLINE_CONFIRMATION");
  } else {
    disciplineConf = 40;  // discipline supposée par BDD mais non confirmée par source
  }

  // 6. Subscriber relevance : Quinté/Quarté > Tiercé > autres (proxy via nb_partants ≥ 14)
  subscriberRelev = candidate.nb_partants >= 14 ? 100 : candidate.nb_partants >= 10 ? 70 : 40;

  // 7. Value opportunity : hippodrome prestigieux ?
  const prestigeHippodromes = /vincennes|longchamp|chantilly|auteuil|deauville|cagnes|saint-cloud|paris/i;
  valueOpp = prestigeHippodromes.test(candidate.hippodrome) ? 100 : 50;

  // 8. Contradiction risk : sources en CONFLICT
  const conflicts = evidence.filter((ev) => ev.status === "CONFLICT");
  contradictionRisk = Math.min(100, conflicts.length * 50);

  // 9. Source fragility : sources MISSING vs MATCHED
  const totalEvidence = evidence.length;
  const matchedCount  = matchedWhitelisted.length;
  sourceFragility = totalEvidence > 0
    ? Math.min(100, ((totalEvidence - matchedCount) / totalEvidence) * 100)
    : 100;

  // Application de la formule §9.3
  const rawScore =
      0.25 * africaAvailability
    + 0.20 * sourceCrosscheck
    + 0.15 * dataCompleteness
    + 0.15 * fieldReadability
    + 0.10 * disciplineConf
    + 0.10 * subscriberRelev
    + 0.05 * valueOpp
    - 0.15 * contradictionRisk
    - 0.10 * sourceFragility;

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Détermination déterministe du validation_status (hiérarchie de
  // robustesse : LONACI > Afrique corroborée > PMU international).
  // Les booléens isLonaciDirect / hasPmuInternationalOnly sont déjà calculés
  // plus haut pour éviter une 2e passe sur africaValidators.
  let validation_status: ValidationStatus | null = null;
  if (africaValidators.length > 0 && score >= 60) {
    if (isLonaciDirect) {
      validation_status = "VALIDATION_LONACI_DIRECTE";
    } else if (hasPmuInternationalOnly) {
      validation_status = "VALIDATION_PMU_INTERNATIONAL";
    } else {
      // Au moins un vrai opérateur africain (LONASE/LONAB/PMUC/PMUG/PMU
      // Mali/PMUB/SOREC...) a corroboré, éventuellement avec PMU.fr-International
      // en complément. On garde l'étiquette plus forte : AFRIQUE_CORROBOREE.
      validation_status = "VALIDATION_AFRIQUE_CORROBOREE";
    }
  }

  return { score, validation_status, missing };
}

/**
 * Filtre + score toutes les candidates en parallèle.
 */
async function scoreCandidates(candidates: CourseCandidate[]): Promise<ScoredCandidate[]> {
  return Promise.all(
    candidates.map(async (c) => {
      const evidence = await loadSourceEvidence(c.course_id);
      const { score, validation_status, missing } = computeAfricaCourseScore(c, evidence);

      // Vérification source interdite explicite
      const usesForbidden = evidence.some((ev) => isSourceForbidden(ev.source_name));

      let rejected_reason: string | undefined;
      if (usesForbidden) {
        rejected_reason = "Source interdite parmi les preuves";
      } else if (!validation_status) {
        rejected_reason = "Validation Afrique absente (cf source_evidence)";
      } else if (score < 60) {
        rejected_reason = `africa_course_score=${score} < 60`;
      }

      return {
        candidate:           c,
        evidence,
        africa_course_score: score,
        validation_status:   usesForbidden ? null : validation_status,
        rejected_reason,
        missing_requirements: missing && missing.length > 0 ? missing : undefined,
      };
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Prompt LLM (Sonnet 4.5)
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es CourseSelector, agent de sélection éditoriale du système Elite-Turf.

Mission :
À partir d'une liste de courses CANDIDATES déjà pré-validées Afrique (validation_status renseigné, africa_course_score ≥ 60), choisir éditorialement :
- 1 course "free" (gratuite, fidélisation) — DOIT être différente des elite_featured
- 1 course "starter_pro" (Quinté Pro/Starter)
- 1 à 3 courses "elite_featured" (Quinté Elite premium)

Tu n'inventes RIEN. Tu choisis parmi les candidates fournies.
Tu ne valides PAS la disponibilité Afrique — c'est déjà fait en amont.
Ton choix est éditorial : pertinence sportive, lisibilité, intérêt abonné, anti-cannibalisation FREE/ELITE.

Règles strictes :
1. Anti-cannibalisation : la course "free" doit avoir un course_id différent de toutes les "elite_featured".
2. Niveau ELITE : sélectionne en priorité les courses avec africa_course_score ≥ 85 et nb_partants 12-16.
3. Niveau PRO/STARTER : score 75-84 ou course Elite secondaire.
4. Niveau FREE : score 68-84 (cahier §9.3), mais JAMAIS une course Elite déjà choisie.
5. Si aucune candidate n'a africa_course_score ≥ 85, status = NEEDS_HUMAN_REVIEW.
6. Si moins de 2 candidates valides, status = NOT_ENOUGH_VALIDATED_AFRICA_COURSES.
7. Pour chaque course retenue, fournir un "reason" éditorial court (≤ 200 chars).
8. Ne jamais inclure une course rejetée dans selected_courses.

Format de sortie :
JSON STRICT conforme au schéma fourni. Aucun texte en dehors du JSON.`;

interface LlmDecision {
  free?:          { course_id: string; reason: string };
  starter_pro?:   { course_id: string; reason: string };
  elite_featured?: Array<{ course_id: string; priority: number; reason: string }>;
  status:         CourseSelectorStatus;
  admin_note:     string;
}

function buildUserPrompt(
  date: string,
  validCandidates: ScoredCandidate[],
): string {
  const compact = validCandidates.map((c) => ({
    course_id:           c.candidate.course_id,
    meeting:             c.candidate.meeting,
    race_number:         c.candidate.race_number,
    race_name:           c.candidate.race_name,
    hippodrome:          c.candidate.hippodrome,
    hippodrome_pays:     c.candidate.hippodrome_pays,
    discipline:          c.candidate.discipline,
    nb_partants:         c.candidate.nb_partants,
    start_time_paris:    c.candidate.start_time_paris,
    start_time_abidjan:  c.candidate.start_time_abidjan,
    validation_status:   c.validation_status,
    africa_course_score: c.africa_course_score,
    n_sources_matched:   c.evidence.filter((ev) => ev.status === "MATCHED").length,
  }));

  return `Date cible : ${date}
Marché cible : AFRIQUE_FRANCOPHONE

Candidates pré-validées Afrique (${compact.length}) :
${JSON.stringify(compact, null, 2)}

Réponds avec un JSON suivant ce schéma exact :
{
  "free":           { "course_id": "...", "reason": "..." } | null,
  "starter_pro":    { "course_id": "...", "reason": "..." } | null,
  "elite_featured": [ { "course_id": "...", "priority": 1, "reason": "..." } ],
  "status":         "COURSES_SELECTED" | "NOT_ENOUGH_VALIDATED_AFRICA_COURSES" | "NEEDS_HUMAN_REVIEW",
  "admin_note":     "Synthèse 2 phrases max pour l'admin."
}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Mappage LLM decision → CourseSelectorResult
// ─────────────────────────────────────────────────────────────────────────

function buildSelectedCourse(
  scored:   ScoredCandidate,
  reason:   string,
): SelectedCourse {
  if (!scored.validation_status) {
    throw new Error(`buildSelectedCourse appelé sans validation_status pour ${scored.candidate.course_id}`);
  }
  return {
    course_id:                scored.candidate.course_id,
    meeting:                  scored.candidate.meeting,
    race_number:              scored.candidate.race_number,
    race_name:                scored.candidate.race_name,
    start_time_paris:         scored.candidate.start_time_paris ?? "",
    start_time_abidjan:       scored.candidate.start_time_abidjan ?? "",
    validation_status:        scored.validation_status,
    mandatory_public_mention: VALIDATION_BADGES[scored.validation_status],
    africa_course_score:      scored.africa_course_score,
    reason,
  };
}

function applyLlmDecision(
  date:        string,
  scoredById:  Map<string, ScoredCandidate>,
  decision:    LlmDecision,
): CourseSelectorResult {
  const evidence_aggregated: SourceEvidence[] = [];
  for (const sc of Array.from(scoredById.values())) {
    evidence_aggregated.push(...sc.evidence);
  }

  const rejected_courses = Array.from(scoredById.values())
    .filter((sc) => sc.rejected_reason)
    .map((sc) => ({
      course_id:           sc.candidate.course_id,
      reason:              sc.rejected_reason!,
      missing_requirements: sc.missing_requirements ?? [],
    }));

  // Aucune candidate valide → status = NOT_ENOUGH_VALIDATED_AFRICA_COURSES
  const validCount = Array.from(scoredById.values()).filter((sc) => !sc.rejected_reason).length;
  if (validCount === 0) {
    return {
      agent:           "CourseSelector",
      date,
      target_market:   "AFRIQUE_FRANCOPHONE",
      status:          "NOT_ENOUGH_VALIDATED_AFRICA_COURSES",
      selected_courses: null,
      source_evidence:  evidence_aggregated,
      rejected_courses,
      admin_note:       "Aucune course n'a passé la validation Afrique aujourd'hui. Vérifier les flux LONACI/PMU/sources Afrique.",
    };
  }

  const eliteList = (decision.elite_featured ?? [])
    .filter((e) => scoredById.has(e.course_id) && !scoredById.get(e.course_id)!.rejected_reason)
    .map((e) => ({
      ...buildSelectedCourse(scoredById.get(e.course_id)!, e.reason),
      priority: e.priority,
    }));

  const eliteIds = new Set(eliteList.map((e) => e.course_id));

  // Anti-cannibalisation FREE/ELITE : si le LLM se trompe, on force NEEDS_HUMAN_REVIEW
  let antiCanibPassed = true;
  let freeCourse: (SelectedCourse & { must_be_different_from_elite: boolean }) | null = null;
  if (decision.free && scoredById.has(decision.free.course_id)) {
    const sc = scoredById.get(decision.free.course_id)!;
    if (sc.rejected_reason) {
      antiCanibPassed = false;
    } else if (eliteIds.has(decision.free.course_id)) {
      antiCanibPassed = false;
    } else {
      freeCourse = {
        ...buildSelectedCourse(sc, decision.free.reason),
        must_be_different_from_elite: true,
      };
    }
  }

  let starterProCourse: SelectedCourse | null = null;
  if (decision.starter_pro && scoredById.has(decision.starter_pro.course_id)) {
    const sc = scoredById.get(decision.starter_pro.course_id)!;
    if (!sc.rejected_reason) {
      starterProCourse = buildSelectedCourse(sc, decision.starter_pro.reason);
    }
  }

  let status: CourseSelectorStatus = decision.status;
  if (!antiCanibPassed)                 status = "NEEDS_HUMAN_REVIEW";
  if (eliteList.length === 0 && !freeCourse && !starterProCourse) {
    status = "NEEDS_HUMAN_REVIEW";
  }
  // Vérif seuil Elite : pas d'elite sans score ≥ ELITE seuil
  const eliteBelowThreshold = eliteList.filter(
    (e) => e.africa_course_score < MIN_AFRICA_SCORE_BY_LEVEL.ELITE,
  );
  if (eliteBelowThreshold.length > 0 && status === "COURSES_SELECTED") {
    status = "NEEDS_HUMAN_REVIEW";
  }

  // Vérif review si certaines courses sont sous le seuil §9.3 (60-67)
  const needsReview = Array.from(scoredById.values()).some(
    (sc) => !sc.rejected_reason && sc.africa_course_score < AFRICA_SCORE_REVIEW_THRESHOLD + 8,
  );
  if (needsReview && status === "COURSES_SELECTED") {
    // On garde COURSES_SELECTED mais on l'annote
  }

  return {
    agent:         "CourseSelector",
    date,
    target_market: "AFRIQUE_FRANCOPHONE",
    status,
    selected_courses: status === "COURSES_SELECTED" || status === "NEEDS_HUMAN_REVIEW"
      ? {
          free:        freeCourse ?? ({
            ...buildSelectedCourse(Array.from(scoredById.values()).find((sc) => !sc.rejected_reason)!, "Fallback FREE (LLM n'a rien retourné)"),
            must_be_different_from_elite: true,
          }),
          starter_pro: starterProCourse ?? buildSelectedCourse(Array.from(scoredById.values()).find((sc) => !sc.rejected_reason)!, "Fallback STARTER/PRO"),
          elite_featured: eliteList,
        }
      : null,
    source_evidence:  evidence_aggregated,
    rejected_courses,
    admin_note:       decision.admin_note + (antiCanibPassed ? "" : " ⚠️ Anti-cannibalisation FREE/ELITE violée, review forcée."),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Point d'entrée
// ─────────────────────────────────────────────────────────────────────────

export async function runCourseSelectorAgent(
  input: CourseSelectorInput,
): Promise<CourseSelectorRunOutput> {
  // ── 1. Charger les candidates du jour ──────────────────────────────────
  const candidates = await loadCandidatesForDate(input.date);

  if (candidates.length === 0) {
    return {
      result: {
        agent:           "CourseSelector",
        date:            input.date,
        target_market:   "AFRIQUE_FRANCOPHONE",
        status:          "NOT_ENOUGH_VALIDATED_AFRICA_COURSES",
        selected_courses: null,
        source_evidence:  [],
        rejected_courses: [],
        admin_note:       "Aucune course PROGRAMME en BDD pour cette date.",
      },
      tokens_input:  0,
      tokens_output: 0,
    };
  }

  // ── 2. Scoring déterministe ────────────────────────────────────────────
  const scored = await scoreCandidates(candidates);
  const scoredById = new Map(scored.map((s) => [s.candidate.course_id, s]));
  const validCandidates = scored
    .filter((s) => !s.rejected_reason)
    .sort((a, b) => b.africa_course_score - a.africa_course_score)
    .slice(0, input.maxCandidates ?? 12);

  // ── 3. Cas dégénéré : 0 candidate valide ───────────────────────────────
  if (validCandidates.length === 0) {
    return {
      result: applyLlmDecision(input.date, scoredById, {
        status:     "NOT_ENOUGH_VALIDATED_AFRICA_COURSES",
        admin_note: "Aucune course du jour n'a passé le filtre Afrique. Vérifier course_source_evidence.",
      }),
      tokens_input:  0,
      tokens_output: 0,
    };
  }

  // ── 4. Appel LLM Sonnet pour arbitrage éditorial ───────────────────────
  const userPrompt = buildUserPrompt(input.date, validCandidates);
  const llm = await callClaude<LlmDecision>({
    model:        CLAUDE_MODELS.SONNET,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens:    2000,
    expectJson:   true,
  });

  if (!llm.parsed) {
    throw new Error("CourseSelector LLM n'a pas retourné de JSON parseable");
  }

  // ── 5. Mappage vers CourseSelectorResult ───────────────────────────────
  const result = applyLlmDecision(input.date, scoredById, llm.parsed);

  return {
    result,
    tokens_input:  llm.tokens_input,
    tokens_output: llm.tokens_output,
  };
}
