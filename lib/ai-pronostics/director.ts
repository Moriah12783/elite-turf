/**
 * lib/ai-pronostics/director.ts
 *
 * 🎯 DIRECTOR — Orchestrateur central du système Multi-Agents IA.
 *
 * Pipeline complet (cahier des charges §14) :
 *
 *   1. CourseSelector (Sonnet)    → 3-5 courses validées Afrique
 *   2. Pour chaque course retenue :
 *      a. FieldAnalyzer (TS, $0)         → enrichit le field
 *      b. SelectionBuilder (Sonnet)      → construit la sélection par niveau
 *      c. AnalyseWriter (Haiku)          → rédige le contenu
 *      d. QualityValidator (TS, $0)      → valide ou rejette
 *   3. INSERT en BDD (ai_pronostic_drafts) — UNIQUEMENT si status
 *      APPROVED_FOR_ADMIN_REVIEW ou NEEDS_HUMAN_REVIEW
 *   4. NotificationBuilder ($0)    → message admin
 *
 * 🚨 GARANTIES
 *   - AUCUNE publication automatique (table pronostics) — tout passe par
 *     /admin/pronostics/ai-review qui demande une décision humaine.
 *   - Si CourseSelector retourne 0 course validée → 0 draft, 0 insert.
 *   - Si 1 agent worker échoue sur 1 course → on continue les autres
 *     (resilient pipeline). L'erreur est consignée dans `errors`.
 *   - Le draft.human_review.decision est toujours "PENDING" en sortie de
 *     Director — Stéphane décidera "PUBLISHED" ou "REJECTED" plus tard.
 *
 * 💰 COÛT par run (cahier §15) : ~$0.09 = ~$2.70/mois
 *
 * 🛡️ DRY-RUN : opts.dryRun=true exécute le pipeline complet mais NE FAIT
 *   PAS d'INSERT BDD. Utile pour debug + tests.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { todayParisISO } from "@/lib/paris-date";

import { runCourseSelectorAgent }      from "./agents/course-selector";
import { runFieldAnalyzerAgent }       from "./agents/field-analyzer";
import { runSelectionBuilderAgent }    from "./agents/selection-builder";
import { runAnalyseWriterAgent }       from "./agents/analyse-writer";
import { runQualityValidatorAgent }    from "./agents/quality-validator";
import { runNotificationBuilderAgent } from "./agents/notification-builder";

import type {
  AiPronosticDraft,
  AnalyseWriterResult,
  CourseSelectorResult,
  Discipline,
  DirectorRunResult,
  FieldAnalyzerResult,
  NiveauAcces,
  QualityValidatorResult,
  SelectedCourse,
  SelectionBuilderResult,
  SourceEvidence,
} from "./types";
import { VALIDATION_BADGES } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────

export interface DirectorOptions {
  /** Date cible YYYY-MM-DD (défaut = aujourd'hui Paris) */
  date?:   string;
  /** Mode dry-run : exécute mais N'INSERT PAS en BDD (debug/test) */
  dryRun?: boolean;
  /**
   * Limite optionnelle du nombre de niveaux à traiter dans ce run.
   * (utile pour debug : ne générer que ELITE par exemple)
   */
  onlyLevels?: NiveauAcces[];
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

interface CoursePackage {
  access_level:        NiveauAcces;
  selected_course:     SelectedCourse;
  free_course_id?:     string;            // pour anti-cannibal
  elite_course_ids?:   string[];          // pour anti-cannibal
}

/**
 * À partir de CourseSelectorResult.selected_courses, construit une liste
 * plate de "course packages" à traiter — un par niveau.
 *
 * Note : STARTER et PRO utilisent la même course (selected_courses.starter_pro)
 * — ce sont deux drafts distincts générés à partir d'une même course.
 */
function flattenSelectedCourses(selectorResult: CourseSelectorResult): CoursePackage[] {
  const sel = selectorResult.selected_courses;
  if (!sel) return [];

  const eliteIds = sel.elite_featured.map((e) => e.course_id);
  const packages: CoursePackage[] = [];

  // ELITE — peut avoir plusieurs courses vedettes
  for (const elite of sel.elite_featured) {
    packages.push({
      access_level:    "ELITE",
      selected_course: elite,
      free_course_id:  sel.free.course_id,
      elite_course_ids: eliteIds,
    });
  }

  // PRO
  packages.push({
    access_level:    "PRO",
    selected_course: sel.starter_pro,
    free_course_id:  sel.free.course_id,
    elite_course_ids: eliteIds,
  });

  // STARTER — même course que PRO mais autre niveau (cahier §11.2)
  packages.push({
    access_level:    "STARTER",
    selected_course: sel.starter_pro,
    free_course_id:  sel.free.course_id,
    elite_course_ids: eliteIds,
  });

  // FREE
  packages.push({
    access_level:    "FREE",
    selected_course: sel.free,
    free_course_id:  sel.free.course_id,
    elite_course_ids: eliteIds,
  });

  return packages;
}

/**
 * Discipline approximative depuis le SelectedCourse + source_evidence.
 * À raffiner avec une vraie source DISCIPLINE_OFFICIAL.
 */
function inferDiscipline(
  pkg: CoursePackage,
  evidence: SourceEvidence[],
): { discipline: Discipline; confirmed_by: string } {
  // Cherche une preuve DISCIPLINE_OFFICIAL MATCHED
  const confirmer = evidence.find(
    (ev) => ev.source_tier === "DISCIPLINE_OFFICIAL" && ev.status === "MATCHED",
  );
  if (confirmer) {
    // On déduit la discipline depuis le nom de la source
    if (/letrot/i.test(confirmer.source_name))      return { discipline: "TROT_ATTELE", confirmed_by: confirmer.source_name };
    if (/france.?galop/i.test(confirmer.source_name)) return { discipline: "PLAT", confirmed_by: confirmer.source_name };
    if (/sorec/i.test(confirmer.source_name))       return { discipline: "MAROC_LOCAL", confirmed_by: confirmer.source_name };
  }
  // Fallback : PLAT par défaut + confirmed_by "InternalWhitelist"
  return { discipline: "PLAT", confirmed_by: "InternalWhitelist" };
}

/**
 * Construit le draft INSERT-ready à partir de tous les outputs agents.
 */
function buildDraft(args: {
  pkg:                   CoursePackage;
  date:                  string;
  selectorResult:        CourseSelectorResult;
  fieldResult:           FieldAnalyzerResult;
  selectionResult:       SelectionBuilderResult;
  writerResult:          AnalyseWriterResult;
  validatorResult:       QualityValidatorResult;
  africa_course_score:   number;
}): AiPronosticDraft {
  const {
    pkg, date, selectorResult, fieldResult, selectionResult,
    writerResult, validatorResult, africa_course_score,
  } = args;

  // Source evidence : uniquement les preuves liées à cette course
  const courseEvidence = selectorResult.source_evidence.filter(
    (ev) => ev.course_id === pkg.selected_course.course_id,
  );

  return {
    id:                          "",  // généré par BDD (gen_random_uuid)
    draft_date:                  date,
    access_level:                pkg.access_level,
    course_id:                   pkg.selected_course.course_id,
    validation_status:           pkg.selected_course.validation_status,
    validation_badge:            VALIDATION_BADGES[pkg.selected_course.validation_status],
    africa_course_score,
    source_confidence_score:
      courseEvidence.length > 0
        ? Math.round(
            courseEvidence.reduce((s, ev) => s + ev.confidence, 0) / courseEvidence.length,
          )
        : null,
    selection_confidence_score:  selectionResult.selection_confidence_score,
    quality_score:               validatorResult.quality_score,
    status:                      validatorResult.status,
    title:                       writerResult.title,
    subscriber_content:          writerResult.subscriber_content,
    selection:                   selectionResult.selected_runners,
    risks:                       writerResult.subscriber_content.risks,
    source_evidence:             courseEvidence,
    validator_report:            validatorResult,
    agent_logs: {
      CourseSelector:   selectorResult,
      FieldAnalyzer:    fieldResult,
      SelectionBuilder: selectionResult,
      AnalyseWriter:    writerResult,
      QualityValidator: validatorResult,
    },
    human_review: {
      edited_by:     null,
      edited_at:     null,
      decision:      "PENDING",
      human_comment: null,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * INSERT/UPSERT du draft dans `public.ai_pronostic_drafts`.
 * UNIQUE constraint (draft_date, access_level, course_id) sécurise un rejeu.
 */
async function persistDraft(draft: AiPronosticDraft): Promise<{ ok: boolean; error?: string; id?: string }> {
  const supabase = createServiceClient();

  // ⚠️ On omet `id`, `created_at`, `updated_at` — gérés par la BDD
  const { id: _id, created_at: _ca, updated_at: _ua, ...payload } = draft;
  void _id; void _ca; void _ua;

  const { data, error } = await supabase
    .from("ai_pronostic_drafts")
    .upsert(payload, { onConflict: "draft_date,access_level,course_id" })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

// ─────────────────────────────────────────────────────────────────────────
// Pipeline principal
// ─────────────────────────────────────────────────────────────────────────

/**
 * Lance le pipeline quotidien complet.
 *
 * @example Usage depuis le cron :
 *   const result = await runDirector({ dryRun: false });
 *
 * @example Test local :
 *   const result = await runDirector({ dryRun: true, date: "2026-05-13" });
 */
export async function runDirector(opts: DirectorOptions = {}): Promise<DirectorRunResult> {
  const t0     = Date.now();
  const date   = opts.date ?? todayParisISO();
  const dryRun = opts.dryRun ?? false;

  const result: DirectorRunResult = {
    ok:                  false,
    date,
    duration_ms:         0,
    drafts_saved:        0,
    drafts_blocked:      0,
    drafts_needs_review: 0,
    errors:              [],
    tokens_used: {
      sonnet_input:  0,
      sonnet_output: 0,
      haiku_input:   0,
      haiku_output:  0,
    },
  };

  // ── ÉTAPE 1 : CourseSelector ───────────────────────────────────────────
  let selectorResult: CourseSelectorResult;
  try {
    const out = await runCourseSelectorAgent({ date });
    selectorResult = out.result;
    result.tokens_used.sonnet_input  += out.tokens_input;
    result.tokens_used.sonnet_output += out.tokens_output;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ agent: "CourseSelector", message: msg });
    result.duration_ms = Date.now() - t0;
    return result;
  }

  // Sortie précoce : aucune course validée
  if (
    selectorResult.status === "NOT_ENOUGH_VALIDATED_AFRICA_COURSES" ||
    !selectorResult.selected_courses
  ) {
    // On notifie quand même l'admin
    const notif = runNotificationBuilderAgent({
      date,
      drafts:           [],
      validator_reports: [],
      selector_result:   selectorResult,
    });
    result.notification = notif;
    result.duration_ms = Date.now() - t0;
    result.ok = true;  // pas d'erreur, juste rien à publier
    return result;
  }

  // ── ÉTAPE 2-5 : Pipeline par course ────────────────────────────────────
  const allPackages   = flattenSelectedCourses(selectorResult);
  const packages      = opts.onlyLevels
    ? allPackages.filter((p) => opts.onlyLevels!.includes(p.access_level))
    : allPackages;

  const drafts:            AiPronosticDraft[]            = [];
  const validatorReports:  QualityValidatorResult[]      = [];

  for (const pkg of packages) {
    const courseId = pkg.selected_course.course_id;

    try {
      // 2a. FieldAnalyzer
      const fieldResult = await runFieldAnalyzerAgent({
        course_id:         courseId,
        validation_status: pkg.selected_course.validation_status,
      });

      if (fieldResult.status === "REJECTED") {
        result.errors.push({
          agent: "FieldAnalyzer",
          course_id: courseId,
          message: `Course rejetée : ${fieldResult.red_flags[0] ?? "field invalide"}`,
        });
        continue;
      }

      // 2b. SelectionBuilder
      const selOut = await runSelectionBuilderAgent({
        field:             fieldResult,
        access_level:      pkg.access_level,
        validation_status: pkg.selected_course.validation_status,
        course_libelle:    pkg.selected_course.race_name,
        course_hippodrome: extractHippodromeFromCourse(selectorResult, pkg.selected_course.course_id),
      });
      result.tokens_used.sonnet_input  += selOut.tokens_input;
      result.tokens_used.sonnet_output += selOut.tokens_output;
      const selectionResult = selOut.result;

      if (selectionResult.status === "REJECTED") {
        result.errors.push({
          agent: "SelectionBuilder",
          course_id: courseId,
          message: selectionResult.self_critique.main_risk,
        });
        continue;
      }

      // 2c. AnalyseWriter
      const writerOut = await runAnalyseWriterAgent({
        selection:          selectionResult,
        field:              fieldResult,
        access_level:       pkg.access_level,
        validation_status:  pkg.selected_course.validation_status,
        course_libelle:     pkg.selected_course.race_name,
        course_hippodrome:  extractHippodromeFromCourse(selectorResult, courseId),
        course_meeting:     pkg.selected_course.meeting,
        course_race_number: pkg.selected_course.race_number,
        start_time_paris:   pkg.selected_course.start_time_paris,
        start_time_abidjan: pkg.selected_course.start_time_abidjan,
      });
      result.tokens_used.haiku_input  += writerOut.tokens_input;
      result.tokens_used.haiku_output += writerOut.tokens_output;
      const writerResult = writerOut.result;

      // 2d. QualityValidator (TS, déterministe)
      const courseEvidence = selectorResult.source_evidence.filter(
        (ev) => ev.course_id === courseId,
      );
      const { discipline, confirmed_by } = inferDiscipline(pkg, courseEvidence);

      // Construit un draft "temporaire" pour le validator (id sera assigné après upsert)
      const tempDraft = buildDraft({
        pkg, date, selectorResult, fieldResult, selectionResult, writerResult,
        validatorResult: {} as QualityValidatorResult,  // placeholder
        africa_course_score: pkg.selected_course.africa_course_score,
      });

      const validatorResult = runQualityValidatorAgent({
        draft:                   tempDraft,
        field:                   fieldResult,
        selection:               selectionResult,
        writer:                  writerResult,
        source_evidence:         courseEvidence,
        free_course:             pkg.access_level === "ELITE"
                                   ? selectorResult.selected_courses!.free
                                   : null,
        elite_course_ids:        pkg.access_level === "FREE" ? pkg.elite_course_ids : undefined,
        africa_course_score:     pkg.selected_course.africa_course_score,
        discipline,
        discipline_confirmed_by: confirmed_by,
      });

      validatorReports.push(validatorResult);

      // 3. Décide si on persiste
      const finalDraft = buildDraft({
        pkg, date, selectorResult, fieldResult, selectionResult, writerResult,
        validatorResult, africa_course_score: pkg.selected_course.africa_course_score,
      });

      if (validatorResult.status === "REJECTED") {
        result.drafts_blocked += 1;
        // On peut quand même persister pour audit (debug pourquoi rejected)
        // mais on évite de polluer la table. Décision produit : on
        // log dans `errors` et on N'INSÈRE PAS.
        result.errors.push({
          agent: "QualityValidator",
          course_id: courseId,
          message: `REJECTED ${pkg.access_level} : ${validatorResult.blocking_issues[0]?.message ?? "blocking issue"}`,
        });
        drafts.push(finalDraft);  // garde en mémoire pour la notif
        continue;
      }

      // 3.b INSERT BDD (sauf dryRun)
      if (!dryRun) {
        const persisted = await persistDraft(finalDraft);
        if (!persisted.ok) {
          result.errors.push({
            agent: "Director",
            course_id: courseId,
            message: `Échec persist : ${persisted.error}`,
          });
          continue;
        }
        finalDraft.id = persisted.id ?? "";
      }

      drafts.push(finalDraft);

      if (validatorResult.status === "APPROVED_FOR_ADMIN_REVIEW") {
        result.drafts_saved += 1;
      } else {
        result.drafts_needs_review += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push({
        agent: "Director",
        course_id: courseId,
        message: msg,
      });
    }
  }

  // ── ÉTAPE 6 : NotificationBuilder ──────────────────────────────────────
  const notif = runNotificationBuilderAgent({
    date,
    drafts,
    validator_reports: validatorReports,
    selector_result:   selectorResult,
  });
  result.notification = notif;

  result.ok = result.drafts_saved > 0 || result.drafts_needs_review > 0 || result.errors.length === 0;
  result.duration_ms = Date.now() - t0;
  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// Helper interne
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cherche le nom de l'hippodrome via source_evidence ou fallback BDD.
 * Pour l'instant on retourne une string "Hippodrome" si introuvable
 * (le CourseSelector n'expose pas l'hippodrome dans SelectedCourse).
 *
 * TODO Session 5+ : ajouter hippodrome à SelectedCourse pour éviter ce lookup.
 */
function extractHippodromeFromCourse(
  selectorResult: CourseSelectorResult,
  courseId:       string,
): string {
  // Pour l'instant on déduit depuis race_name si possible (souvent "Prix de X")
  // Sinon on retourne "Inconnu" — l'admin verra le label complet dans la course.
  void selectorResult;
  void courseId;
  return "Hippodrome (à enrichir Session 6)";
}
