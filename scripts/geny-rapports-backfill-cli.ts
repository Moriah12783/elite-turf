/**
 * scripts/geny-rapports-backfill-cli.ts
 *
 * Backfill ONE-SHOT des rapports PMU (re-fetch Geny + re-parse + UPDATE
 * arrivees.rapports_pmu), exécuté par GitHub Actions (IP Azure → Geny 200 ;
 * le Worker Cloudflare reçoit 403). Même pattern que geny-arrivees-cli.ts.
 *
 * Réglages via env (passés par le workflow_dispatch) :
 *   BACKFILL_SCOPE   "quinte" (défaut) | "all"
 *   BACKFILL_SINCE   borne basse date_course "YYYY-MM-DD" (optionnel)
 *   BACKFILL_LIMIT   plafond de courses (optionnel)
 *   BACKFILL_DRY_RUN "1" pour ne rien écrire (rapport seulement)
 *
 * Env requis : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 */
import { runRapportsBackfill, type BackfillScope } from "@/lib/sync/geny-rapports-backfill";

async function main(): Promise<void> {
  const scope = (process.env.BACKFILL_SCOPE === "all" ? "all" : "quinte") as BackfillScope;
  const since = process.env.BACKFILL_SINCE?.trim() || null;
  const limitRaw = process.env.BACKFILL_LIMIT?.trim();
  const limit = limitRaw ? parseInt(limitRaw, 10) : null;
  const dryRun = process.env.BACKFILL_DRY_RUN === "1" || process.env.BACKFILL_DRY_RUN === "true";

  const result = await runRapportsBackfill({
    scope,
    since,
    limit: limit && Number.isFinite(limit) ? limit : null,
    dryRun,
  });
  console.log("✅ RESULT", JSON.stringify(result));
}

main().catch((e) => {
  console.error("❌ geny-rapports-backfill-cli:", e instanceof Error ? e.message : e);
  process.exit(1);
});
