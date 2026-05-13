/**
 * lib/ai-pronostics/source-crawlers/matcher.ts
 *
 * Matche les courses BDD avec les courses LONACI pour construire des
 * preuves `course_source_evidence`.
 *
 * 🎯 STRATÉGIE DE MATCHING
 *   Une course BDD matche une LonaciRace si :
 *     - date_course (BDD) === racedt.date (LONACI)
 *     - numero_reunion (BDD) === nReunion (LONACI)
 *     - numero_course (BDD) === course_number (LONACI)
 *     - hippodrome.nom (BDD) ~ libelle (LONACI) — fuzzy match
 *
 *   Le matching strict (R+C+date) est très fiable. Le fuzzy hippodrome
 *   est juste un cross-check secondaire pour détecter les anomalies
 *   (mauvais R+C par erreur d'import).
 *
 * 📊 CONFIDENCE SCORE
 *   - 100 : R+C+date+hippodrome fuzzy match
 *   -  85 : R+C+date match mais hippodrome ne matche pas (anomalie possible)
 *   -  60 : R+C+date match approximatif (partants count mismatch p.ex.)
 *   -   0 : pas de match → status MISSING
 */

import type { CourseSeenByCrawler } from "./types";
import type { LonaciRace, LonaciReunion } from "./lonaci";
import { lonaciDateFromRacedt, normalizeHippodromeName } from "./lonaci";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface LonaciMatch {
  matched_race:        LonaciRace | null;
  matched_reunion:     LonaciReunion | null;
  /** 0-100. 0 = pas de match. */
  confidence:          number;
  /** Champs confirmés par la source */
  matched_fields:      string[];
  /** Statut conforme `course_source_evidence.status` */
  status:              "MATCHED" | "PARTIAL" | "CONFLICT" | "MISSING";
  /** URL profonde LONACI pour cette course (best-effort) */
  source_url?:         string;
  notes?:              string;
}

// ─────────────────────────────────────────────────────────────────────────
// Matcher principal
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cherche dans la liste LONACI la course qui correspond à `bddCourse`.
 *
 * Algorithme :
 *   1. Filtre par date (racedt.date === bddCourse.date_course)
 *   2. Cherche par (nReunion, course_number) exacts
 *   3. Si match exact trouvé : cross-check hippodrome fuzzy → confidence finale
 *   4. Sinon : retourne MISSING
 */
export function matchCourseToLonaci(
  bddCourse: CourseSeenByCrawler,
  lonaciReunions: LonaciReunion[],
): LonaciMatch {
  const targetDate = bddCourse.date_course;

  // Étape 1+2 : recherche stricte par (date, nReunion, course_number)
  for (const reunion of lonaciReunions) {
    if (reunion.nReunion !== bddCourse.numero_reunion) continue;

    for (const race of reunion.races) {
      const raceDate = lonaciDateFromRacedt(race.racedt);
      if (raceDate !== targetDate) continue;
      if (race.course_number !== bddCourse.numero_course) continue;

      // Match strict trouvé. Calcul de confidence finale via cross-check
      // hippodrome (norme du nom).
      const bddHippoNorm    = normalizeHippodromeName(bddCourse.hippodrome_nom);
      const lonaciHippoNorm = normalizeHippodromeName(reunion.libelle);

      const hippoFuzzyMatch =
        !!bddHippoNorm && !!lonaciHippoNorm &&
        (bddHippoNorm.includes(lonaciHippoNorm) ||
         lonaciHippoNorm.includes(bddHippoNorm));

      // Cross-check nb_partants — diff > 2 = signal d'incohérence
      const partantsBdd = bddCourse.nb_partants ?? 0;
      const partantsLnc = race.partantnb ?? 0;
      const partantsDiff = Math.abs(partantsBdd - partantsLnc);
      const partantsMatch = partantsBdd > 0 && partantsLnc > 0 && partantsDiff <= 2;

      const matched_fields: string[] = [
        "date_course",
        "numero_reunion",
        "numero_course",
      ];
      if (hippoFuzzyMatch)  matched_fields.push("hippodrome");
      if (partantsMatch)    matched_fields.push("nb_partants");
      if (race.libelle)     matched_fields.push("libelle_race");

      let confidence = 70;
      if (hippoFuzzyMatch)    confidence += 20;
      if (partantsMatch)      confidence += 10;
      // Si partants diff > 2, c'est suspect → on baisse
      if (partantsBdd > 0 && partantsLnc > 0 && partantsDiff > 2) confidence -= 15;
      confidence = Math.max(0, Math.min(100, confidence));

      let status: LonaciMatch["status"] = "MATCHED";
      let notes: string | undefined;

      if (!hippoFuzzyMatch && bddHippoNorm && lonaciHippoNorm) {
        // R+C+date matchent mais l'hippodrome NE matche pas → anomalie
        // Probablement collision de numérotation (rare). On flag PARTIAL.
        status = "PARTIAL";
        notes  = `Hippodrome BDD "${bddCourse.hippodrome_nom}" ≠ LONACI "${reunion.libelle}"`;
      }

      if (partantsBdd > 0 && partantsLnc > 0 && partantsDiff > 2) {
        notes = (notes ? notes + " ; " : "") +
          `nb_partants diff BDD=${partantsBdd} LONACI=${partantsLnc}`;
        if (status === "MATCHED") status = "PARTIAL";
      }

      return {
        matched_race:    race,
        matched_reunion: reunion,
        confidence,
        matched_fields,
        status,
        source_url: `https://pmu.lonacionline.ci/#/turf/home`,
        notes,
      };
    }
  }

  // Aucun match
  return {
    matched_race:    null,
    matched_reunion: null,
    confidence:      0,
    matched_fields:  [],
    status:          "MISSING",
    notes:           "Course absente du programme LONACI du jour",
  };
}
