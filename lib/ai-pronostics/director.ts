/**
 * lib/ai-pronostics/director.ts
 *
 * DIRECTOR Agent — Orchestrateur central du système Multi-Agents.
 *
 * Workflow complet :
 *   1. CourseSelector → 3 courses (1 Elite, 1 Pro, 1 Gratuit)
 *   2. FieldAnalyzer × 3 → enrichit chaque field (parallèle)
 *   3. SelectionBuilder × 3 → construit la sélection par niveau (parallèle)
 *   4. AnalyseWriter × 3 → rédige les analyses_courtes (parallèle)
 *   5. QualityValidator × 3 → valide chaque pronostic (séquentiel, déterministe)
 *   6. INSERT en BDD (source='AI-MULTI-AGENT', publie=false)
 *
 * Garanties :
 *   - Si CourseSelector échoue → 0 pronostic généré (abort)
 *   - Si 1 agent worker échoue sur 1 course → 2/3 pronostics insérés (resilient)
 *   - Tous les drafts insérés ont publie=false → attendent review Stéphane
 *
 * Coût total estimé par run :
 *   - CourseSelector (Sonnet) : ~$0.015
 *   - FieldAnalyzer × 3 : $0 (pas de LLM)
 *   - SelectionBuilder × 3 (Sonnet) : ~$0.06
 *   - AnalyseWriter × 3 (Haiku) : ~$0.015
 *   - QualityValidator × 3 : $0
 *   ─────────────────────────────────
 *   TOTAL : ~$0.09 / jour = $2.70/mois
 */

import { createServiceClient } from "@/lib/supabase/server";
import { todayParisISO } from "@/lib/paris-date";
import { runCourseSelectorAgent }   from "./agents/course-selector";
import { runFieldAnalyzerAgent }    from "./agents/field-analyzer";
import { runSelectionBuilderAgent } from "./agents/selection-builder";
import { runAnalyseWriterAgent }    from "./agents/analyse-writer";
import { runQualityValidatorAgent } from "./agents/quality-validator";
import type { DirectorRunResult, AiPronosticDraft, NiveauAcces } from "./types";

interface DirectorOptions {
  /** Date cible (défaut = aujourd'hui Paris) */
  date?: string;
  /** Mode dry-run : exécute les agents mais n'INSERT PAS en BDD */
  dryRun?: boolean;
}

/**
 * Point d'entrée principal : exécute le workflow complet Multi-Agents.
 *
 * @returns DirectorRunResult avec drafts générés + erreurs détaillées
 *
 * @example Usage depuis le cron :
 *   const result = await runDirector({ dryRun: false });
 *   await notifySlack(result);
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

  // TODO Phase 2/3 : pipeline complet
  //
  // ── ÉTAPE 1 : Sélection des 3 courses ─────────────────────────────────
  // const selectorOut = await runCourseSelectorAgent(date);
  // result.tokens_used.sonnet_input  += selectorOut.tokens_input;
  // result.tokens_used.sonnet_output += selectorOut.tokens_output;
  // if (!selectorOut.result) {
  //   result.errors.push({ agent: "CourseSelector", message: selectorOut.error ?? "no result" });
  //   result.duration_ms = Date.now() - t0;
  //   return result;
  // }
  // const { elite, pro, gratuit } = selectorOut.result;
  //
  // ── ÉTAPE 2-4 : pour chaque course, pipeline parallèle ────────────────
  // const niveaux: Array<{ niveau: NiveauAcces; course: typeof elite }> = [
  //   { niveau: "ELITE",   course: elite },
  //   { niveau: "PRO",     course: pro },
  //   { niveau: "GRATUIT", course: gratuit },
  // ];
  //
  // const drafts: PronosticDraft[] = [];
  // for (const { niveau, course } of niveaux) {
  //   try {
  //     // 2. Field analysis
  //     const fieldOut = await runFieldAnalyzerAgent(course.id);
  //     if (!fieldOut.result) {
  //       result.errors.push({ agent: "FieldAnalyzer", course_id: course.id, message: fieldOut.error ?? "no result" });
  //       continue;
  //     }
  //
  //     // 3. Selection
  //     const selOut = await runSelectionBuilderAgent({
  //       field: fieldOut.result,
  //       niveau,
  //       course_libelle:    course.libelle,
  //       course_hippodrome: course.hippodrome,
  //     });
  //     result.tokens_used.sonnet_input  += selOut.tokens_input;
  //     result.tokens_used.sonnet_output += selOut.tokens_output;
  //     if (!selOut.result) {
  //       result.errors.push({ agent: "SelectionBuilder", course_id: course.id, message: selOut.error ?? "no result" });
  //       continue;
  //     }
  //
  //     // 4. Analyse écrite
  //     const writerOut = await runAnalyseWriterAgent({
  //       selection: selOut.result,
  //       field:     fieldOut.result,
  //       niveau,
  //       course_libelle:    course.libelle,
  //       course_hippodrome: course.hippodrome,
  //       course_heure:      course.heure_depart ?? "",
  //     });
  //     result.tokens_used.haiku_input  += writerOut.tokens_input;
  //     result.tokens_used.haiku_output += writerOut.tokens_output;
  //     if (!writerOut.result) {
  //       result.errors.push({ agent: "AnalyseWriter", course_id: course.id, message: writerOut.error ?? "no result" });
  //       continue;
  //     }
  //
  //     // 5. Build draft + validation
  //     const draft: PronosticDraft = {
  //       course_id:      course.id,
  //       niveau_acces:   niveau,
  //       type_pari:      selOut.result.type_pari,
  //       selection:      selOut.result.selection,
  //       confiance:      selOut.result.confiance,
  //       analyse_courte: writerOut.result.analyse_courte,
  //       analyse_texte:  writerOut.result.analyse_texte,
  //       source:         "AI-MULTI-AGENT",
  //       publie:         false,  // ⚠️ ATTEND REVIEW HUMAINE
  //     };
  //
  //     const validation = runQualityValidatorAgent({ draft, field: fieldOut.result });
  //     if (!validation.ok) {
  //       result.errors.push({ agent: "QualityValidator", course_id: course.id, message: validation.errors.join(" | ") });
  //       continue;
  //     }
  //     drafts.push(draft);
  //   } catch (err) {
  //     result.errors.push({
  //       agent:     "Director",
  //       course_id: course.id,
  //       message:   err instanceof Error ? err.message : String(err),
  //     });
  //   }
  // }
  //
  // ── ÉTAPE 6 : INSERT BDD si dryRun=false ──────────────────────────────
  // if (!dryRun && drafts.length > 0) {
  //   const supabase = createServiceClient();
  //   const { error } = await supabase.from("pronostics").insert(drafts);
  //   if (error) {
  //     result.errors.push({ agent: "Director", message: `Insert BDD: ${error.message}` });
  //   }
  // }
  // result.drafts = drafts;
  // result.ok = drafts.length > 0 && result.errors.length === 0;

  // Phase 1 — pas encore implémenté
  void createServiceClient;
  void runCourseSelectorAgent;
  void runFieldAnalyzerAgent;
  void runSelectionBuilderAgent;
  void runAnalyseWriterAgent;
  void runQualityValidatorAgent;
  void dryRun;
  void ({} as AiPronosticDraft);
  void ({} as NiveauAcces);

  result.errors.push({
    agent:   "Director",
    message: "Multi-Agents système non implémenté (Session 1 — fondations uniquement alignées sur cahier des charges). Pipeline complet à venir Sessions 3-5.",
  });
  result.duration_ms = Date.now() - t0;
  return result;
}
