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
  date:                  string;
  courses_processed:     number;
  evidence_inserted:     number;
  lonaci_available:      boolean;
  lonaci_matches:        number;
  lonaci_missing:        number;
  pmu_heuristic_count:   number;
  errors:                string[];
  duration_ms:           number;
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
      nb_partants, source_import,
      hippodrome:hippodromes ( nom, pays )
    `)
    .eq("date_course", date);

  if (error || !data) return [];

  return data.map((c: any): CourseSeenByCrawler => ({
    course_id:       c.id,
    date_course:     c.date_course,
    numero_reunion:  c.numero_reunion,
    numero_course:   c.numero_course,
    libelle:         c.libelle,
    categorie:       c.categorie ?? null,
    nb_partants:     c.nb_partants ?? null,
    source_import:   c.source_import ?? null,
    geny_url:        null,  // colonne non sélectionnée mais réservée — non bloquant
    hippodrome_nom:  c.hippodrome?.nom  ?? null,
    hippodrome_pays: c.hippodrome?.pays ?? null,
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
 * Génère toutes les preuves source pour une course :
 *   - 1 preuve LONACI (match ou MISSING)
 *   - 1 preuve PMU.fr heuristique (toujours PARTIAL, basée sur l'import)
 */
function buildEvidenceForCourse(
  course:         CourseSeenByCrawler,
  lonaciReunions: LonaciReunion[] | null,
): EvidenceRow[] {
  const rows: EvidenceRow[] = [];

  // ── 1. LONACI — match direct depuis API ────────────────────────────────
  if (lonaciReunions !== null) {
    const match = matchCourseToLonaci(course, lonaciReunions);
    const matchedFieldsObj: Record<string, true> = {};
    for (const f of match.matched_fields) matchedFieldsObj[f] = true;

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

  return rows;
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
  // les sources qu'on remplace (LONACI + PMU.fr). On NE TOUCHE PAS aux
  // éventuelles preuves d'autres sources (LeTROT, France Galop, etc.) qui
  // seront ajoutées par d'autres crawlers ou jobs.
  const { error: errDel } = await supabase
    .from("course_source_evidence")
    .delete()
    .in("course_id", courseIds)
    .in("source_name", ["LONACI", "PMU.fr"]);

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
      date:                opts.date,
      courses_processed:   0,
      evidence_inserted:   0,
      lonaci_available:    false,
      lonaci_matches:      0,
      lonaci_missing:      0,
      pmu_heuristic_count: 0,
      errors:              [`Aucune course en BDD pour ${opts.date}`],
      duration_ms:         Date.now() - t0,
    };
  }

  // ── 2. Fetch LONACI (peut être null si API down) ───────────────────────
  const lonaciReunions = await fetchLonaciActiveGames();
  const lonaciAvailable = lonaciReunions !== null;

  if (!lonaciAvailable) {
    errors.push("LONACI API indisponible — preuves AFRICA_AVAILABILITY non générées pour LONACI");
  }

  // ── 3. Construction des preuves pour chaque course ─────────────────────
  const allRows: EvidenceRow[] = [];
  let lonaciMatches = 0;
  let lonaciMissing = 0;
  let pmuCount      = 0;

  for (const course of courses) {
    const rows = buildEvidenceForCourse(course, lonaciReunions);
    for (const r of rows) {
      allRows.push(r);
      if (r.source_name === "LONACI") {
        if (r.status === "MATCHED" || r.status === "PARTIAL") lonaciMatches++;
        else                                                   lonaciMissing++;
      }
      if (r.source_name === "PMU.fr") pmuCount++;
    }
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
    date:                opts.date,
    courses_processed:   courses.length,
    evidence_inserted:   inserted,
    lonaci_available:    lonaciAvailable,
    lonaci_matches:      lonaciMatches,
    lonaci_missing:      lonaciMissing,
    pmu_heuristic_count: pmuCount,
    errors,
    duration_ms:         Date.now() - t0,
  };
}

// Re-exports pratiques
export { fetchLonaciActiveGames } from "./lonaci";
export { matchCourseToLonaci }     from "./matcher";
