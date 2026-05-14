/**
 * lib/ai-pronostics/source-crawlers/index.ts
 *
 * Orchestrateur de collecte des preuves source pour une date donnée.
 *
 * 🎯 OBJECTIF
 *   Pour chaque course du jour en BDD, générer 1+ lignes
 *   `course_source_evidence` qui prouvent (ou non) sa disponibilité
 *   Afrique selon les sources auxquelles on a accès.
 *
 * 📋 SOURCES IMPLÉMENTÉES (Session 6 — v1)
 *   1. **LONACI**  (`pmu.lonacionline.ci`, API publique)
 *        → tier PRIMARY, role AFRICA_AVAILABILITY
 *        → match strict (date, R, C) + cross-check hippodrome/partants
 *        → Présence dans le programme LONACI = VALIDATION_LONACI_DIRECTE possible
 *
 *   2. **PMU.fr**  (heuristique BDD)
 *        → tier PRIMARY, role CENTRAL_PROGRAM
 *        → Toute course en BDD provient de l'import Geny→PMU.fr,
 *          donc on émet automatiquement une preuve PARTIAL pour PMU.fr.
 *          Confidence 80 (heuristique mais fiable empiriquement).
 *
 * 📋 SOURCES À AJOUTER (sessions ultérieures)
 *   - LeTROT (`letrot.com`) pour DISCIPLINE_CONFIRMATION trot
 *   - France Galop (`france-galop.com`) pour DISCIPLINE_CONFIRMATION plat/obstacle
 *   - SOREC (`sorec.ma`) pour MAROC_LOCAL
 *
 * 🛡️ IDEMPOTENT
 *   La collecte commence par DELETE FROM course_source_evidence WHERE
 *   course_id IN (...) puis INSERT. Permet de rejouer le cron sans
 *   dupliquer les preuves.
 */

import { createServiceClient } from "@/lib/supabase/server";
import type { CourseSeenByCrawler } from "./types";
import type { LonaciReunion } from "./lonaci";
import { fetchLonaciActiveGames } from "./lonaci";
import { matchCourseToLonaci } from "./matcher";

// ─────────────────────────────────────────────────────────────────────────
// Types résultat
// ─────────────────────────────────────────────────────────────────────────

export interface CollectionResult {
  date:                          string;
  courses_processed:             number;
  evidence_inserted:             number;
  lonaci_available:              boolean;
  lonaci_matches:                number;
  lonaci_missing:                number;
  pmu_heuristic_count:           number;
  /**
   * Compteur du 3e palier de validation (cahier §4 amendé 2026-05-14).
   * Nombre de courses pour lesquelles on a généré une preuve
   * `PMU.fr-International` MATCHED car au moins un des 3 critères de
   * redistribution internationale est rempli (cf evaluatePmuInternational).
   */
  pmu_international_count:       number;
  /** Détail des 3 critères pour audit / monitoring débit */
  pmu_international_by_criterion: {
    pari_premium:           number;  // courses qui ont passé sur critère A
    colocalisation_lonaci:  number;  // critère B
    reunion_1:              number;  // critère C
  };
  errors:                        string[];
  duration_ms:                   number;
}

export interface CollectionOptions {
  /** Date YYYY-MM-DD (défaut = aujourd'hui Paris, calculé par le caller) */
  date: string;
  /** Mode dry-run : ne fait pas les écritures BDD */
  dryRun?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Loader BDD : courses du jour
// ─────────────────────────────────────────────────────────────────────────

async function loadCoursesForDate(date: string): Promise<CourseSeenByCrawler[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("courses")
    .select(`
      id, date_course, numero_reunion, numero_course, libelle, categorie,
      nb_partants, source_import, paris_disponibles,
      hippodrome:hippodromes ( nom, pays )
    `)
    .eq("date_course", date);

  if (error || !data) return [];

  return data.map((c: any): CourseSeenByCrawler => ({
    course_id:        c.id,
    date_course:      c.date_course,
    numero_reunion:   c.numero_reunion,
    numero_course:    c.numero_course,
    libelle:          c.libelle,
    categorie:        c.categorie ?? null,
    nb_partants:      c.nb_partants ?? null,
    paris_disponibles: Array.isArray(c.paris_disponibles) ? c.paris_disponibles : [],
    source_import:    c.source_import ?? null,
    geny_url:         null,  // colonne non sélectionnée mais réservée — non bloquant
    hippodrome_nom:   c.hippodrome?.nom  ?? null,
    hippodrome_pays:  c.hippodrome?.pays ?? null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Construction des lignes evidence pour 1 course
// ─────────────────────────────────────────────────────────────────────────

interface EvidenceRow {
  course_id:       string;
  source_name:     string;
  source_domain:   string | null;
  source_tier:     string;
  validation_role: string;
  matched_fields:  Record<string, true>;
  source_url:      string | null;
  confidence:      number;
  status:          string;
  notes:           string | null;
}

/**
 * Génère les preuves LONACI + PMU.fr (preuves "directes") pour une course.
 * Les preuves PMU.fr-International (3e palier) sont générées dans une
 * 2e passe, une fois qu'on connaît les meetings LONACI MATCHED — voir
 * `buildPmuInternationalEvidence`.
 */
function buildDirectEvidenceForCourse(
  course:         CourseSeenByCrawler,
  lonaciReunions: LonaciReunion[] | null,
): { rows: EvidenceRow[]; lonaciMatched: boolean } {
  const rows: EvidenceRow[] = [];
  let lonaciMatched = false;

  // ── 1. LONACI — match direct depuis API ────────────────────────────────
  if (lonaciReunions !== null) {
    const match = matchCourseToLonaci(course, lonaciReunions);
    const matchedFieldsObj: Record<string, true> = {};
    for (const f of match.matched_fields) matchedFieldsObj[f] = true;
    lonaciMatched = match.status === "MATCHED";

    rows.push({
      course_id:       course.course_id,
      source_name:     "LONACI",
      source_domain:   "pmu.lonacionline.ci",
      source_tier:     "PRIMARY",
      validation_role: "AFRICA_AVAILABILITY",
      matched_fields:  matchedFieldsObj,
      source_url:      match.source_url ?? null,
      confidence:      match.confidence,
      status:          match.status,
      notes:           match.notes ?? null,
    });
  }
  // Si lonaciReunions === null, on N'INSÈRE PAS de preuve LONACI : on saura
  // que l'API était down (via collection.lonaci_available = false). Mieux
  // que de marquer toutes les courses MISSING (fausse info).

  // ── 2. PMU.fr — heuristique BDD ────────────────────────────────────────
  // Toute course en BDD provient de Geny.com qui scrape PMU.fr → si
  // source_import = 'PMU' (ou null = ancien import), on présume PMU.fr.
  // Confidence 80 : élevé mais pas 100 (heuristique, pas vérification directe).
  const isFromPmu = course.source_import === "PMU" || course.source_import == null;
  rows.push({
    course_id:       course.course_id,
    source_name:     "PMU.fr",
    source_domain:   "pmu.fr",
    source_tier:     "PRIMARY",
    validation_role: "CENTRAL_PROGRAM",
    matched_fields:  {
      date_course:    true,
      numero_reunion: true,
      numero_course:  true,
      libelle:        true,
    },
    source_url:      null,  // pas d'URL profonde sans scraping PMU
    confidence:      isFromPmu ? 80 : 50,
    status:          isFromPmu ? "PARTIAL" : "MISSING",
    notes:           isFromPmu
                       ? "Heuristique : course importée depuis Geny→PMU.fr (preuve indirecte)"
                       : "Source d'import inconnue, présence PMU.fr non confirmée",
  });

  return { rows, lonaciMatched };
}

// ─────────────────────────────────────────────────────────────────────────
// PMU.fr-International — 3e palier de validation Afrique (cahier §4 amendé)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Clé d'un meeting pour la déduplication co-localisation LONACI.
 * Format : `${hippodrome}::R${numero_reunion}::${date}`
 */
function meetingKey(course: { hippodrome_nom: string | null; numero_reunion: number; date_course: string }): string {
  return `${(course.hippodrome_nom ?? "?").toLowerCase().trim()}::R${course.numero_reunion}::${course.date_course}`;
}

/**
 * Paris premium qui sont SYSTÉMATIQUEMENT redistribués par les opérateurs
 * nationaux africains (PMU France → LONACI/LONASE/LONAB/PMUC/PMUG/PMU Mali/
 * PMUB/SOREC). Le critère A de VALIDATION_PMU_INTERNATIONAL est rempli si
 * au moins UN de ces types de pari est disponible sur la course.
 */
const PARIS_PREMIUM_INTERNATIONAL: ReadonlySet<string> = new Set([
  "QUINTE_PLUS",
  "QUARTE",
  "TIERCE",
]);

interface PmuIntlEvaluation {
  /** Au moins un critère est rempli → preuve à générer */
  valid:              boolean;
  /** Confidence à utiliser : 80 (Quinté+) > 75 (co-LONACI) > 65 (R1) */
  confidence:         number;
  /** Détail des critères remplis (pour audit + matched_fields) */
  criterion_pari_premium:        boolean;
  criterion_colocalisation_lonaci: boolean;
  criterion_reunion_1:           boolean;
  /** Liste des paris premium détectés (pour la note) */
  paris_premium_detected:        string[];
}

/**
 * Évalue les 3 critères de redistribution internationale pour une course
 * qui N'EST PAS dans LONACI (sinon on aurait VALIDATION_LONACI_DIRECTE
 * de toute façon, pas besoin du 3e palier).
 *
 * Combinaison "OR" : un seul critère suffit. La confidence retournée est
 * celle du plus fort critère rempli.
 *
 * 🎯 Critères (décision PO 2026-05-14) :
 *   A. Pari premium  : paris_disponibles contient QUINTE_PLUS/QUARTE/TIERCE
 *      → contrats commerciaux internationaux, redistribution quasi-100%
 *      → confidence 80
 *   B. Co-localisation LONACI : autre course du même (hippodrome, R, date)
 *      a été MATCHED par LONACI dans cette même collecte
 *      → LONACI prend les meetings, pas les courses isolées
 *      → confidence 75
 *   C. Réunion 1 (R1) : numero_reunion === 1
 *      → R1 = réunion vedette du jour selon Geny/PMU.fr, toujours
 *        redistribuée par TOUS les opérateurs africains
 *      → confidence 65
 */
function evaluatePmuInternational(
  course:                  CourseSeenByCrawler,
  lonaciMatchedMeetings:   Set<string>,
): PmuIntlEvaluation {
  const parisPremiumDetected = (course.paris_disponibles ?? []).filter((p) =>
    PARIS_PREMIUM_INTERNATIONAL.has(p),
  );
  const criterion_pari_premium          = parisPremiumDetected.length > 0;
  const criterion_colocalisation_lonaci = lonaciMatchedMeetings.has(meetingKey(course));
  const criterion_reunion_1             = course.numero_reunion === 1;

  const valid = criterion_pari_premium
             || criterion_colocalisation_lonaci
             || criterion_reunion_1;

  // Confidence = max des critères remplis (hiérarchie : A > B > C)
  let confidence = 0;
  if (criterion_reunion_1)             confidence = 65;
  if (criterion_colocalisation_lonaci) confidence = 75;
  if (criterion_pari_premium)          confidence = 80;

  return {
    valid,
    confidence,
    criterion_pari_premium,
    criterion_colocalisation_lonaci,
    criterion_reunion_1,
    paris_premium_detected: parisPremiumDetected,
  };
}

/**
 * Construit une preuve PMU.fr-International MATCHED pour une course qui
 * remplit au moins UN des critères A/B/C. À appeler UNIQUEMENT si
 * `evaluatePmuInternational(course).valid === true`.
 *
 * 🚨 Cette source ne doit JAMAIS être citée par un autre code que ce
 * collector. Elle est virtuelle et signale spécifiquement la corroboration
 * de redistribution internationale, pas une vraie source distincte.
 */
function buildPmuInternationalEvidence(
  course: CourseSeenByCrawler,
  evaluation: PmuIntlEvaluation,
): EvidenceRow {
  const matchedFields: Record<string, true> = {};
  if (evaluation.criterion_pari_premium)          matchedFields.criterion_pari_premium          = true;
  if (evaluation.criterion_colocalisation_lonaci) matchedFields.criterion_colocalisation_lonaci = true;
  if (evaluation.criterion_reunion_1)             matchedFields.criterion_reunion_1             = true;

  const notesParts: string[] = [];
  if (evaluation.criterion_pari_premium) {
    notesParts.push(`Pari premium détecté : ${evaluation.paris_premium_detected.join("+")}`);
  }
  if (evaluation.criterion_colocalisation_lonaci) {
    notesParts.push("Meeting co-localisé avec une course validée LONACI directe");
  }
  if (evaluation.criterion_reunion_1) {
    notesParts.push("Réunion 1 (réunion vedette du jour)");
  }

  return {
    course_id:       course.course_id,
    source_name:     "PMU.fr-International",
    source_domain:   "pmu.fr",
    source_tier:     "PRIMARY",
    validation_role: "AFRICA_AVAILABILITY",
    matched_fields:  matchedFields,
    source_url:      null,
    confidence:      evaluation.confidence,
    status:          "MATCHED",
    notes:           notesParts.join(" | "),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Écriture BDD : DELETE + INSERT (idempotent)
// ─────────────────────────────────────────────────────────────────────────

async function persistEvidence(
  rows: EvidenceRow[],
  courseIds: string[],
): Promise<{ ok: boolean; error?: string; inserted: number }> {
  if (courseIds.length === 0) return { ok: true, inserted: 0 };

  const supabase = createServiceClient();

  // Idempotence : on supprime les preuves existantes de ces courses pour
  // les sources qu'on remplace (LONACI + PMU.fr + PMU.fr-International).
  // On NE TOUCHE PAS aux éventuelles preuves d'autres sources (LeTROT,
  // France Galop, etc.) qui seront ajoutées par d'autres crawlers ou jobs.
  const { error: errDel } = await supabase
    .from("course_source_evidence")
    .delete()
    .in("course_id", courseIds)
    .in("source_name", ["LONACI", "PMU.fr", "PMU.fr-International"]);

  if (errDel) return { ok: false, error: `DELETE failed: ${errDel.message}`, inserted: 0 };

  if (rows.length === 0) return { ok: true, inserted: 0 };

  const { error: errIns, count } = await supabase
    .from("course_source_evidence")
    .insert(rows, { count: "exact" });

  if (errIns) return { ok: false, error: `INSERT failed: ${errIns.message}`, inserted: 0 };
  return { ok: true, inserted: count ?? rows.length };
}

// ─────────────────────────────────────────────────────────────────────────
// Orchestrateur principal
// ─────────────────────────────────────────────────────────────────────────

/**
 * Collecte les preuves source pour toutes les courses d'une date donnée.
 *
 * @example
 *   const result = await collectSourceEvidenceForDate({ date: "2026-05-13" });
 *   console.log(`${result.lonaci_matches}/${result.courses_processed} matchent LONACI`);
 */
export async function collectSourceEvidenceForDate(
  opts: CollectionOptions,
): Promise<CollectionResult> {
  const t0 = Date.now();
  const errors: string[] = [];

  // ── 1. Charger les courses BDD ─────────────────────────────────────────
  const courses = await loadCoursesForDate(opts.date);
  if (courses.length === 0) {
    return {
      date:                           opts.date,
      courses_processed:              0,
      evidence_inserted:              0,
      lonaci_available:               false,
      lonaci_matches:                 0,
      lonaci_missing:                 0,
      pmu_heuristic_count:            0,
      pmu_international_count:        0,
      pmu_international_by_criterion: { pari_premium: 0, colocalisation_lonaci: 0, reunion_1: 0 },
      errors:                         [`Aucune course en BDD pour ${opts.date}`],
      duration_ms:                    Date.now() - t0,
    };
  }

  // ── 2. Fetch LONACI (peut être null si API down) ───────────────────────
  const lonaciReunions = await fetchLonaciActiveGames();
  const lonaciAvailable = lonaciReunions !== null;

  if (!lonaciAvailable) {
    errors.push("LONACI API indisponible — preuves AFRICA_AVAILABILITY non générées pour LONACI");
  }

  // ── 3a. Phase 1 — Preuves directes (LONACI + PMU.fr) + identification
  //        des meetings LONACI MATCHED pour la phase suivante.
  const allRows:               EvidenceRow[] = [];
  const lonaciMatchedMeetings: Set<string>   = new Set();
  let lonaciMatches = 0;
  let lonaciMissing = 0;
  let pmuCount      = 0;

  for (const course of courses) {
    const { rows, lonaciMatched } = buildDirectEvidenceForCourse(course, lonaciReunions);
    for (const r of rows) {
      allRows.push(r);
      if (r.source_name === "LONACI") {
        if (r.status === "MATCHED" || r.status === "PARTIAL") lonaciMatches++;
        else                                                   lonaciMissing++;
      }
      if (r.source_name === "PMU.fr") pmuCount++;
    }
    if (lonaciMatched) {
      lonaciMatchedMeetings.add(meetingKey(course));
    }
  }

  // ── 3b. Phase 2 — Preuves PMU.fr-International pour les courses qui
  //        N'ONT PAS été matched par LONACI mais remplissent au moins 1
  //        critère de redistribution (Quinté+/Quarté+/Tiercé+, co-LONACI, R1).
  //
  //        On NE génère PAS de preuve PMU.fr-International quand LONACI a
  //        déjà MATCHED — ce serait redondant et brouillerait l'audit.
  const lonaciMatchedCourseIds = new Set(
    allRows
      .filter((r) => r.source_name === "LONACI" && r.status === "MATCHED")
      .map((r) => r.course_id),
  );

  let pmuIntlCount        = 0;
  let critPariPremium     = 0;
  let critColocLonaci     = 0;
  let critReunion1        = 0;

  for (const course of courses) {
    if (lonaciMatchedCourseIds.has(course.course_id)) continue;  // déjà couvert LONACI directe

    const evaluation = evaluatePmuInternational(course, lonaciMatchedMeetings);
    if (!evaluation.valid) continue;

    allRows.push(buildPmuInternationalEvidence(course, evaluation));
    pmuIntlCount++;
    if (evaluation.criterion_pari_premium)          critPariPremium++;
    if (evaluation.criterion_colocalisation_lonaci) critColocLonaci++;
    if (evaluation.criterion_reunion_1)             critReunion1++;
  }

  // ── 4. Persist (sauf dry-run) ──────────────────────────────────────────
  let inserted = 0;
  if (!opts.dryRun) {
    const courseIds = courses.map((c) => c.course_id);
    const persistResult = await persistEvidence(allRows, courseIds);
    if (!persistResult.ok) {
      errors.push(persistResult.error ?? "persist failed");
    }
    inserted = persistResult.inserted;
  } else {
    inserted = allRows.length;  // simulation : count uniquement
  }

  return {
    date:                           opts.date,
    courses_processed:              courses.length,
    evidence_inserted:              inserted,
    lonaci_available:               lonaciAvailable,
    lonaci_matches:                 lonaciMatches,
    lonaci_missing:                 lonaciMissing,
    pmu_heuristic_count:            pmuCount,
    pmu_international_count:        pmuIntlCount,
    pmu_international_by_criterion: {
      pari_premium:          critPariPremium,
      colocalisation_lonaci: critColocLonaci,
      reunion_1:             critReunion1,
    },
    errors,
    duration_ms:                    Date.now() - t0,
  };
}

// Re-exports pratiques
export { fetchLonaciActiveGames } from "./lonaci";
export { matchCourseToLonaci }     from "./matcher";
