/**
 * scripts/backfill-distance-cli.ts
 *
 * Backfill de `courses.distance_metres` via l'overlay PMU, sur les N derniers
 * jours. Réutilise `runPmuDistanceSync` — EXACTEMENT le même code que le flux
 * quotidien (branché dans `runGenyProgrammeSync`), donc zéro logique dupliquée.
 *
 * Anti-fabrication : une course absente du programme PMU, ou dont PMU ne donne
 * pas la distance, est laissée strictement telle quelle (compteurs `unmatched`
 * / `source_sans_distance`). Aucune valeur n'est inventée, aucun 0 réécrit.
 *
 * Env : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 *   BACKFILL_DAYS  nombre de jours à remonter (défaut 8).
 *   BACKFILL_FROM  date de départ "YYYY-MM-DD" (défaut : aujourd'hui).
 *   DRY_RUN=1      calcule sans écrire.
 */
import { runPmuDistanceSync } from "@/lib/sync/pmu-distance";

function isoMinus(from: Date, days: number): string {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const pad = (n: number, w: number) => String(n).padStart(w);

async function main(): Promise<void> {
  const days   = parseInt(process.env.BACKFILL_DAYS || "8", 10);
  const dryRun = process.env.DRY_RUN === "1";
  const fromEnv = process.env.BACKFILL_FROM;
  const from = fromEnv && /^\d{4}-\d{2}-\d{2}$/.test(fromEnv)
    ? new Date(`${fromEnv}T12:00:00Z`)
    : new Date();

  console.log(`Backfill distance PMU — ${days} jours depuis ${from.toISOString().slice(0, 10)} — dryRun=${dryRun}\n`);

  let tMatched = 0, tUpdated = 0, tUnchanged = 0, tUnmatched = 0, tNoDist = 0, tApplied = 0, tAberrant = 0;
  let errors = 0;

  for (let i = 0; i < days; i++) {
    const date = isoMinus(from, i);
    try {
      const r = await runPmuDistanceSync(date, { dryRun });
      const unmatched = r.unmatched_hippodrome + r.unmatched_course;
      tMatched += r.matched; tUpdated += r.updated; tUnchanged += r.unchanged;
      tUnmatched += unmatched; tNoDist += r.source_sans_distance;
      tApplied += r.applied; tAberrant += r.rejected_aberrant;
      console.log(
        `  ${date}  db=${pad(r.db_courses, 3)}  pmu=${pad(r.parsed_total, 3)}  ` +
        `matched=${pad(r.matched, 3)}  updated=${pad(r.updated, 3)}  unchanged=${pad(r.unchanged, 3)}  ` +
        `unmatched=${pad(unmatched, 3)}  sans_dist=${pad(r.source_sans_distance, 2)}  applied=${pad(r.applied, 3)}`,
      );
    } catch (e) {
      errors++;
      console.error(`  ${date}  ERREUR: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(
    `\nTOTAL  matched=${tMatched}  updated=${tUpdated}  unchanged=${tUnchanged}  ` +
    `unmatched=${tUnmatched}  sans_distance=${tNoDist}  aberrantes_rejetees=${tAberrant}  ` +
    `applied=${tApplied}  erreurs=${errors}${dryRun ? "   (DRY RUN — rien écrit)" : ""}`,
  );
}

main().catch((e) => {
  console.error("backfill-distance-cli:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
