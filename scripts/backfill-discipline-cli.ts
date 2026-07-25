/**
 * scripts/backfill-discipline-cli.ts
 *
 * Backfill de `courses.categorie` via l'overlay discipline GenyBet, sur les N
 * derniers jours. Réutilise `runGenybetDisciplineSync` — EXACTEMENT le même code
 * que le flux quotidien (branché dans `runGenyProgrammeSync`), donc zéro logique
 * de correction dupliquée.
 *
 * Anti-fabrication : une course non retrouvée chez GenyBet (hippodrome hors
 * périmètre France/Maroc, date non servie…) est comptée `unmatched` et laissée
 * telle quelle — jamais réétiquetée à l'aveugle.
 *
 * Env : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 *   BACKFILL_DAYS  nombre de jours (défaut 8 = fenêtre today-7 → today).
 *   DRY_RUN=1      calcule sans écrire (validation avant application réelle).
 */
import { runGenybetDisciplineSync } from "@/lib/sync/genybet-discipline";

function isoMinus(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const pad = (n: number, w: number) => String(n).padStart(w);

async function main(): Promise<void> {
  const days   = parseInt(process.env.BACKFILL_DAYS || "8", 10);
  const dryRun = process.env.DRY_RUN === "1";
  console.log(`Backfill discipline GenyBet — ${days} jours — dryRun=${dryRun}\n`);

  let tMatched = 0, tUpdated = 0, tUnchanged = 0, tUnmatched = 0, tApplied = 0;
  for (let i = 0; i < days; i++) {
    const date = isoMinus(i);
    try {
      const r = await runGenybetDisciplineSync(date, { dryRun });
      const unmatched = r.unmatched_hippodrome + r.unmatched_course;
      tMatched += r.matched; tUpdated += r.updated; tUnchanged += r.unchanged;
      tUnmatched += unmatched; tApplied += r.applied;
      console.log(
        `  ${date}  db=${pad(r.db_courses, 3)}  parsed=${pad(r.parsed_total, 3)}  ` +
        `matched=${pad(r.matched, 3)}  updated=${pad(r.updated, 3)}  ` +
        `unchanged=${pad(r.unchanged, 3)}  unmatched=${pad(unmatched, 3)}  applied=${pad(r.applied, 3)}`,
      );
    } catch (e) {
      console.error(`  ${date}  ERREUR: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(
    `\nTOTAL  matched=${tMatched}  updated=${tUpdated}  unchanged=${tUnchanged}  ` +
    `unmatched=${tUnmatched}  applied=${tApplied}${dryRun ? "   (DRY RUN — rien écrit)" : ""}`,
  );
}

main().catch((e) => {
  console.error("backfill-discipline-cli:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
