/**
 * GET /api/cron/morning-safety-net
 *
 * 🛡️ FILET DE SÉCURITÉ MATINAL — déclenché par le cron-worker ("30 8 * * *").
 *
 *   Le pipeline IA tourne à 06:45 UTC (source-evidence-collector 06:15 +
 *   ia-pronostics-v2 06:45). Si les courses du jour n'étaient pas encore
 *   chargées à ce moment (ex. pmu-demain a échoué la veille au soir, ou le
 *   pmu-sync de 05:10 a échoué), le pipeline voit 0 course → 0 preuve →
 *   0 pronostic (incident vérifié le 31/05).
 *
 *   Ce cron, planifié ~1h45 APRÈS le pipeline, rattrape ce cas :
 *     1. (Re)charge le programme du JOUR — runGenyProgrammeSync("today").
 *     2. Si 0 course (jour creux) → stop.
 *     3. Si le pipeline a DÉJÀ réussi aujourd'hui → stop (idempotent : pas de
 *        doublon de drafts ni de coût IA inutile).
 *     4. Sinon → (re)collecte les preuves puis relance le Director.
 *
 *   Idempotent : sur une journée saine, l'étape 3 court-circuite tout le
 *   travail IA. Le coût (~$0.09) n'est payé que les jours d'incident.
 *
 * 🔐 AUTH   Bearer CRON_SECRET
 * 📊 QUERY  ?date=YYYY-MM-DD (défaut = aujourd'hui Paris) · ?dry_run=1 · ?force=1
 */

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";
import { requireBearerOnly } from "@/lib/auth/checkAdminAuth";
import { createServiceClient } from "@/lib/supabase/server";
import { todayParisISO } from "@/lib/paris-date";
import { runGenyProgrammeSync } from "@/lib/sync/geny-programme";
import { collectSourceEvidenceForDate } from "@/lib/ai-pronostics/source-crawlers";
import { runDirector } from "@/lib/ai-pronostics/director";

export const dynamic     = "force-dynamic";
export const maxDuration = 90;   // peut relancer le pipeline IA complet (~30-50s)

/**
 * Le pipeline IA a-t-il déjà réussi aujourd'hui ? Évite de re-générer (et de
 * payer) si le run de 06:45 a abouti. À 08:30 UTC la date Paris == la date UTC,
 * donc `${dateISO}T00:00:00Z` est bien minuit du jour courant.
 */
async function pipelineAlreadySucceededToday(dateISO: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("cron_logs")
      .select("id")
      .eq("cron_name", "ia-pronostics-v2")
      .eq("status", "success")
      .gte("executed_at", `${dateISO}T00:00:00Z`)
      .limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    // En cas de doute (table absente, erreur réseau) on rattrape : mieux vaut
    // re-générer que laisser une journée sans pronostic.
    return false;
  }
}

export async function GET(req: NextRequest) {
  const authError = requireBearerOnly(req);
  if (authError) return authError;

  const url       = new URL(req.url);
  const dryRun    = url.searchParams.get("dry_run") === "1";
  const force     = url.searchParams.get("force") === "1";
  const dateParam = url.searchParams.get("date");
  const dateISO   = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : todayParisISO();

  const logger = logCronStart("morning-safety-net");

  try {
    // ── 1. (Re)charger le programme du jour — idempotent (upsert) ──────────
    const sync = await runGenyProgrammeSync(dateISO);

    // ── 2. Jour creux : rien à rattraper ──────────────────────────────────
    if (sync.courses === 0) {
      await logger.finish("skip", { ...sync, reason: "0 course France/Maroc" });
      return NextResponse.json({ ok: true, skipped: true, reason: "no_courses", date: dateISO, sync });
    }

    // ── 3. Idempotence : pipeline déjà OK aujourd'hui → ne rien refaire ────
    if (!force && (await pipelineAlreadySucceededToday(dateISO))) {
      await logger.finish("skip", {
        date:           dateISO,
        reason:         "ia-pronostics-v2 déjà réussi aujourd'hui",
        courses_loaded: sync.courses,
      });
      return NextResponse.json({ ok: true, skipped: true, reason: "already_done", date: dateISO, sync });
    }

    // ── 4. Rattrapage : preuves puis pipeline IA ──────────────────────────
    const evidence = await collectSourceEvidenceForDate({ date: dateISO, dryRun });
    const director = await runDirector({ date: dateISO, dryRun });

    const ok = director.errors.length === 0;
    await logger.finish(ok ? "success" : "failure", {
      date:                dateISO,
      recovered:           true,
      courses_loaded:      sync.courses,
      courses_processed:   evidence.courses_processed,
      evidence_inserted:   evidence.evidence_inserted,
      drafts_saved:        director.drafts_saved,
      drafts_needs_review: director.drafts_needs_review,
      errors_count:        director.errors.length,
      dry_run:             dryRun,
    });

    return NextResponse.json(
      { ok, date: dateISO, recovered: true, sync, evidence, director },
      { status: ok ? 200 : 500 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await logger.finish("failure", { error: msg, date: dateISO });
    return NextResponse.json({ error: msg, date: dateISO }, { status: 500 });
  }
}
