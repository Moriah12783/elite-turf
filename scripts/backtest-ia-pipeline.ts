/**
 * scripts/backtest-ia-pipeline.ts
 *
 * 🎯 OBJECTIF (Mouvement 2 — chantier qualité pronostics IA)
 *   Mesurer la performance prédictive du pipeline Multi-Agents sur des
 *   courses passées dont on connaît l'arrivée. Permet de :
 *     1. Calibrer les seuils MIN_SELECTION_CONFIDENCE_SCORE et MIN_AFRICA_*.
 *     2. Comparer l'IA à un joueur naïf "top N favoris cote".
 *     3. Identifier les disciplines/hippodromes où l'IA est la plus fiable.
 *
 * 🚫 NON-OBJECTIFS (volontairement hors scope étape A)
 *   - Pas d'appel LLM (ni Sonnet ni Haiku). On reste sur le scoring
 *     déterministe du SelectionBuilder (§11.4 du cahier). Étape C distincte
 *     ajoutera un sous-échantillon avec LLM pour mesurer l'apport.
 *   - Pas de modification du code de prod (lib/ai-pronostics/*). On importe
 *     les agents tels quels et on recode localement le scoring si nécessaire.
 *
 * 🛠️ MODES (--mode)
 *   - DETERMINISTIC   : FieldAnalyzer → scoring §11.4 → top-N par
 *                       global_selection_score.
 *   - NAIVE_FAVORIS   : top-N partants par cote croissante (baseline).
 *   - NAIVE_RANDOM    : tirage aléatoire seedé (sanity check).
 *
 * 📊 MÉTRIQUES PRINCIPALES (par course + agrégées)
 *   - hits_top5    = nb chevaux de la sélection présents dans les 5 premiers
 *   - is_5sur5     = tous les 5 premiers sont dans la sélection (Quinté+ jackpot)
 *   - is_4plus_sur5= au moins 4 sur 5 (Quinté+ désordre)
 *
 * 🧪 USAGE
 *   tsx scripts/backtest-ia-pipeline.ts \
 *     --mode=DETERMINISTIC --level=ELITE --limit=120 --label="det-elite-v1"
 *
 *   Variables d'env requises :
 *     NEXT_PUBLIC_SUPABASE_URL
 *     SUPABASE_SERVICE_ROLE_KEY
 */

// ── Charger .env.local manuellement ───────────────────────────────────────
// tsx ne fait pas le chargement automatique que Next.js fait, donc on lit
// .env.local à la main (même pattern que scripts/send-test-email.ts).
// Doit être fait AVANT les imports qui touchent à process.env (Supabase).
import { readFileSync } from "fs";
import { join } from "path";

function loadEnvLocal(): void {
  try {
    const content = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    console.error("⚠ Impossible de charger .env.local :", err);
    process.exit(1);
  }
}
loadEnvLocal();

import { createServiceClient } from "@/lib/supabase/server";
import { runFieldAnalyzerAgent } from "@/lib/ai-pronostics/agents/field-analyzer";
import { SELECTION_SIZES } from "@/lib/ai-pronostics/types";
import type { NiveauAcces, RunnerAnalysis } from "@/lib/ai-pronostics/types";

// ─────────────────────────────────────────────────────────────────────────
// Args CLI
// ─────────────────────────────────────────────────────────────────────────

type RunMode = "DETERMINISTIC" | "NAIVE_FAVORIS" | "NAIVE_RANDOM";

interface CliArgs {
  mode:   RunMode;
  level:  NiveauAcces;
  limit:  number;
  label:  string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback?: string): string => {
    const found = argv.find((a) => a.startsWith(`--${name}=`));
    if (found) return found.split("=", 2)[1];
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing --${name}=`);
  };

  const mode = get("mode") as RunMode;
  if (!["DETERMINISTIC", "NAIVE_FAVORIS", "NAIVE_RANDOM"].includes(mode)) {
    throw new Error(`Invalid --mode (got ${mode})`);
  }
  const level = get("level", "ELITE").toUpperCase() as NiveauAcces;
  if (!["FREE", "STARTER", "PRO", "ELITE"].includes(level)) {
    throw new Error(`Invalid --level (got ${level})`);
  }

  return {
    mode,
    level,
    limit:  parseInt(get("limit", "120"), 10),
    label:  get("label", `${mode.toLowerCase()}-${level.toLowerCase()}-${new Date().toISOString().slice(0,10)}`),
    dryRun: argv.includes("--dry-run"),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Scoring §11.4 (recodé localement pour éviter dépendance au LLM)
// ─────────────────────────────────────────────────────────────────────────

function clamp100(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computeGlobalSelectionScore(r: RunnerAnalysis): number {
  return clamp100(
      0.25 * r.confidence_score
    + 0.20 * r.regularity_score
    + 0.15 * r.form_score
    + 0.10 * r.distance_score
    + 0.10 * r.terrain_score
    + 0.10 * r.jockey_driver_score
    + 0.05 * r.trainer_score
    + 0.05 * r.value_score
    - 0.20 * r.risk_score,
  );
}

function isEligible(r: RunnerAnalysis): boolean {
  return r.profile !== "A_EVITER" && r.profile !== "INSUFFICIENT_DATA";
}

// ─────────────────────────────────────────────────────────────────────────
// Sélection par mode
// ─────────────────────────────────────────────────────────────────────────

/** Sélection déterministe = scoring §11.4 + top-N éligibles. */
async function selectDeterministic(
  courseId: string,
  level:    NiveauAcces,
): Promise<{ numeros: number[]; confidence: number; fieldCompleteness: number; fieldQuality: number; note?: string }> {
  const size = SELECTION_SIZES[level];
  // On feed le FieldAnalyzer avec une validation arbitraire — c'est juste pour
  // qu'il accepte de tourner. Le pipeline réel exigerait validation Afrique,
  // mais ici on teste la qualité prédictive intrinsèque, indépendamment du filtre.
  const field = await runFieldAnalyzerAgent({
    course_id:         courseId,
    validation_status: "VALIDATION_LONACI_DIRECTE",
  });

  if (field.runners_analysis.length === 0) {
    return { numeros: [], confidence: 0, fieldCompleteness: field.data_completeness_score, fieldQuality: field.field_quality_score, note: "field_vide" };
  }

  const eligible = field.runners_analysis.filter(isEligible);
  if (eligible.length < size) {
    // Fallback : on prend les moins pires (cf SelectionBuilder original)
    const fallback = [...field.runners_analysis]
      .sort((a, b) => computeGlobalSelectionScore(b) - computeGlobalSelectionScore(a))
      .slice(0, size);
    return {
      numeros:            fallback.map((r) => r.number),
      confidence:         clamp100(40),  // sélection forcée → confiance basse
      fieldCompleteness:  field.data_completeness_score,
      fieldQuality:       field.field_quality_score,
      note:               `eligible_under_size(${eligible.length}<${size})`,
    };
  }

  const ranked = eligible
    .map((r) => ({ runner: r, gss: computeGlobalSelectionScore(r) }))
    .sort((a, b) => b.gss - a.gss)
    .slice(0, size);

  // Confiance = moyenne des top-N global_selection_score (proxy raisonnable)
  const confidence = clamp100(ranked.reduce((s, x) => s + x.gss, 0) / ranked.length);

  return {
    numeros:           ranked.map((x) => x.runner.number),
    confidence,
    fieldCompleteness: field.data_completeness_score,
    fieldQuality:      field.field_quality_score,
  };
}

/** Sélection naïve = top-N favoris par cote croissante. */
async function selectNaiveFavoris(courseId: string, level: NiveauAcces): Promise<{ numeros: number[] }> {
  const supabase = createServiceClient();
  const size = SELECTION_SIZES[level];
  const { data } = await supabase
    .from("partants")
    .select("numero, cote, non_partant")
    .eq("course_id", courseId);

  if (!data) return { numeros: [] };

  const withCote = data
    .filter((p) => !p.non_partant && p.cote != null && p.cote > 0)
    .sort((a, b) => (a.cote as number) - (b.cote as number))
    .slice(0, size)
    .map((p) => p.numero);

  return { numeros: withCote };
}

/** Sélection aléatoire seedée (sanity check). */
async function selectNaiveRandom(courseId: string, level: NiveauAcces, seed: number): Promise<{ numeros: number[] }> {
  const supabase = createServiceClient();
  const size = SELECTION_SIZES[level];
  const { data } = await supabase
    .from("partants")
    .select("numero, non_partant")
    .eq("course_id", courseId);

  if (!data) return { numeros: [] };

  // Mulberry32 — PRNG simple seedé
  let s = seed >>> 0;
  const rand = (): number => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const numeros = data.filter((p) => !p.non_partant).map((p) => p.numero);
  // Fisher-Yates shuffle seedé
  for (let i = numeros.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [numeros[i], numeros[j]] = [numeros[j], numeros[i]];
  }
  return { numeros: numeros.slice(0, size) };
}

// ─────────────────────────────────────────────────────────────────────────
// Calcul hits vs arrivée
// ─────────────────────────────────────────────────────────────────────────

function computeHits(selection: number[], arrivee: number[]): { hits_top5: number; hits_top3: number; arrivee_top5: number[] } {
  const top5 = arrivee.slice(0, 5);
  const top3 = arrivee.slice(0, 3);
  const sel  = new Set(selection);
  return {
    hits_top5:    top5.filter((n) => sel.has(n)).length,
    hits_top3:    top3.filter((n) => sel.has(n)).length,
    arrivee_top5: top5,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Chargement des courses éligibles au backtest
// ─────────────────────────────────────────────────────────────────────────

interface BacktestCourse {
  id:           string;
  libelle:      string;
  categorie:    string;
  date_course:  string;
  arrivee:      number[];
}

async function loadEligibleCourses(limit: number): Promise<BacktestCourse[]> {
  const supabase = createServiceClient();
  // On veut : arrivee disponible, ≥ 5 chevaux dans l'arrivée, partants en BDD
  const { data, error } = await supabase
    .from("arrivees")
    .select(`
      ordre_arrivee,
      course:courses!inner(
        id, libelle, categorie, date_course, nb_partants
      )
    `)
    .order("horodatage", { ascending: false })
    .limit(limit * 2); // marge pour filtrer ensuite

  if (error || !data) {
    console.error("Failed to load arrivees:", error);
    return [];
  }

  const eligible: BacktestCourse[] = [];
  for (const row of data as any[]) {
    const arr: number[] = row.ordre_arrivee ?? [];
    if (arr.length < 5) continue;
    if (!row.course) continue;
    eligible.push({
      id:          row.course.id,
      libelle:     row.course.libelle,
      categorie:   row.course.categorie,
      date_course: row.course.date_course,
      arrivee:     arr,
    });
    if (eligible.length >= limit) break;
  }

  return eligible;
}

// ─────────────────────────────────────────────────────────────────────────
// Boucle principale
// ─────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  console.log("🧪 Backtest IA pipeline");
  console.log(`   mode=${args.mode}  level=${args.level}  limit=${args.limit}  label=${args.label}`);
  if (args.dryRun) console.log("   ⚠️  DRY-RUN : aucun INSERT BDD");

  const supabase = createServiceClient();

  // 1. Créer le run en BDD
  let runId: string | null = null;
  if (!args.dryRun) {
    const { data: run, error } = await supabase
      .from("backtest_runs")
      .insert({
        run_label:         args.label,
        run_mode:          args.mode,
        nb_courses_target: args.limit,
      })
      .select("id")
      .single();
    if (error || !run) {
      console.error("Failed to create run:", error);
      process.exit(1);
    }
    runId = run.id;
    console.log(`   run_id=${runId}`);
  }

  // 2. Charger les courses
  const courses = await loadEligibleCourses(args.limit);
  console.log(`   ${courses.length} courses chargées`);

  if (courses.length === 0) {
    console.error("Aucune course éligible (besoin d'arrivées avec ≥ 5 chevaux)");
    process.exit(1);
  }

  // 3. Boucle de backtest
  const attempts: Array<{
    course:        BacktestCourse;
    selection:     number[];
    confidence:    number;
    hits_top5:     number;
    hits_top3:     number;
    arrivee_top5:  number[];
    fieldComp:     number;
    fieldQual:     number;
    note?:         string;
  }> = [];

  let done = 0, skipped = 0;
  const errors: Array<{ course_id: string; error: string }> = [];

  for (const course of courses) {
    try {
      let selection:  number[] = [];
      let confidence: number   = 0;
      let fieldComp:  number   = 0;
      let fieldQual:  number   = 0;
      let note:       string | undefined;

      switch (args.mode) {
        case "DETERMINISTIC": {
          const out = await selectDeterministic(course.id, args.level);
          selection  = out.numeros;
          confidence = out.confidence;
          fieldComp  = out.fieldCompleteness;
          fieldQual  = out.fieldQuality;
          note       = out.note;
          break;
        }
        case "NAIVE_FAVORIS": {
          const out = await selectNaiveFavoris(course.id, args.level);
          selection = out.numeros;
          break;
        }
        case "NAIVE_RANDOM": {
          // Seed = hash simple du course_id pour reproductibilité
          const seed = course.id.split("").reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
          const out  = await selectNaiveRandom(course.id, args.level, seed);
          selection = out.numeros;
          break;
        }
      }

      if (selection.length === 0) {
        skipped += 1;
        continue;
      }

      const { hits_top5, hits_top3, arrivee_top5 } = computeHits(selection, course.arrivee);

      attempts.push({
        course, selection, confidence, hits_top5, hits_top3, arrivee_top5,
        fieldComp, fieldQual, note,
      });

      if (!args.dryRun && runId) {
        await supabase.from("backtest_attempts").insert({
          run_id:                   runId,
          course_id:                course.id,
          access_level:             args.level,
          selected_numeros:         selection,
          selection_confidence:     args.mode === "DETERMINISTIC" ? confidence : null,
          arrivee_top5,
          hits_top5,
          hits_top3,
          is_5sur5:                 hits_top5 === 5,
          is_4plus_sur5:            hits_top5 >= 4,
          field_data_completeness:  args.mode === "DETERMINISTIC" ? fieldComp : null,
          field_quality_score:      args.mode === "DETERMINISTIC" ? fieldQual : null,
          notes:                    note,
        });
      }

      done += 1;
      if (done % 10 === 0) console.log(`   ... ${done}/${courses.length} (skipped ${skipped})`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ course_id: course.id, error: msg });
      skipped += 1;
    }
  }

  // 4. Agrégats
  const n = attempts.length;
  if (n === 0) {
    console.error("Aucun attempt exploitable");
    process.exit(1);
  }

  const sum   = (arr: number[]) => arr.reduce((s, x) => s + x, 0);
  const mean  = (arr: number[]) => sum(arr) / arr.length;
  const med   = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  const hits         = attempts.map((a) => a.hits_top5);
  const precisions   = attempts.map((a) => a.hits_top5 / Math.max(1, a.selection.length));
  const pct5sur5     = attempts.filter((a) => a.hits_top5 === 5).length / n;
  const pct4plus     = attempts.filter((a) => a.hits_top5 >= 4).length / n;
  const pct3plus     = attempts.filter((a) => a.hits_top5 >= 3).length / n;
  const pctZero      = attempts.filter((a) => a.hits_top5 === 0).length / n;

  console.log("\n══════════════════════════════════════");
  console.log("📊 RÉSULTAT BACKTEST");
  console.log("══════════════════════════════════════");
  console.log(`  Mode               : ${args.mode}`);
  console.log(`  Niveau             : ${args.level} (sélection ${SELECTION_SIZES[args.level]} chevaux)`);
  console.log(`  Courses backtestées: ${n}/${courses.length} (skipped: ${skipped})`);
  console.log(`  Erreurs            : ${errors.length}`);
  console.log("");
  console.log(`  Hits top 5 moyen   : ${mean(hits).toFixed(2)}/5`);
  console.log(`  Hits top 5 médian  : ${med(hits)}/5`);
  console.log(`  Precision moyenne  : ${(mean(precisions) * 100).toFixed(1)}%`);
  console.log("");
  console.log(`  % 5/5  (jackpot)   : ${(pct5sur5 * 100).toFixed(1)}%`);
  console.log(`  % 4+/5 (désordre+) : ${(pct4plus * 100).toFixed(1)}%`);
  console.log(`  % 3+/5             : ${(pct3plus * 100).toFixed(1)}%`);
  console.log(`  % zéro hit         : ${(pctZero * 100).toFixed(1)}%`);
  console.log("══════════════════════════════════════\n");

  // 5. UPDATE run avec agrégats
  if (!args.dryRun && runId) {
    await supabase
      .from("backtest_runs")
      .update({
        nb_courses_done:    n,
        nb_courses_skipped: skipped,
        errors:             errors,
        hits_top5_mean:     mean(hits),
        hits_top5_median:   med(hits),
        pct_5sur5:          pct5sur5,
        pct_4plus_sur5:     pct4plus,
        pct_3plus_sur5:     pct3plus,
        pct_zero_hit:       pctZero,
        precision_mean:     mean(precisions),
        completed_at:       new Date().toISOString(),
        date_min:           attempts.map((a) => a.course.date_course).sort()[0],
        date_max:           attempts.map((a) => a.course.date_course).sort().slice(-1)[0],
      })
      .eq("id", runId);

    console.log(`✅ Run sauvegardé : run_id=${runId}\n`);
  }
}

main().catch((err) => {
  console.error("Backtest failed:", err);
  process.exit(1);
});
