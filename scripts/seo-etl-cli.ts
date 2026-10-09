/**
 * scripts/seo-etl-cli.ts
 *
 * Rafraîchit les fiches chevaux / jockeys / entraîneurs (lib/sync/seo-etl.ts).
 * Lancé chaque nuit par .github/workflows/seo-etl.yml, ou en local :
 *   npx -y esbuild scripts/seo-etl-cli.ts --bundle --platform=node --format=esm \
 *     --target=node20 --tsconfig=tsconfig.json --packages=external --outfile=seo-etl.mjs
 *   SEO_ETL_DRY_RUN=true node --env-file=.env.local seo-etl.mjs
 *
 * Env : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY ;
 *   SEO_ETL_DRY_RUN             true = rapport seulement, aucune écriture
 *   SEO_ETL_ENTITES             chevaux,jockeys,entraineurs (défaut : les trois)
 *   SEO_ETL_FORCER_SUPPRESSIONS true = lève le garde-fou des suppressions
 *                               (premier passage après la fusion des graphies)
 *   SEO_ETL_RAPPORT             chemin d'un fichier où écrire le rapport JSON
 *
 * Un passage réel est journalisé dans cron_logs (cron_name « seo-etl »).
 */
import { writeFileSync } from "node:fs";
import { runSeoEtl, type EntiteType } from "@/lib/sync/seo-etl";
import { createServiceClient } from "@/lib/supabase/service-client";

const TYPES: EntiteType[] = ["chevaux", "jockeys", "entraineurs"];

async function journaliser(status: "success" | "failure", details: Record<string, unknown>, duration_ms: number) {
  try {
    const { error } = await createServiceClient()
      .from("cron_logs")
      .insert({ cron_name: "seo-etl", status, details, duration_ms });
    if (error) console.error("❌ insert cron_logs KO :", error.message);
  } catch (e) {
    console.error("❌ insert cron_logs KO :", e instanceof Error ? e.message : String(e));
  }
}

async function main(): Promise<void> {
  const dryRun = process.env.SEO_ETL_DRY_RUN === "true";
  const entites = (process.env.SEO_ETL_ENTITES || "")
    .split(",").map((s) => s.trim())
    .filter((s): s is EntiteType => (TYPES as string[]).includes(s));
  const start = Date.now();

  try {
    const result = await runSeoEtl({
      entites,
      dryRun,
      forcerSuppressions: process.env.SEO_ETL_FORCER_SUPPRESSIONS === "true",
    });

    console.log(`${dryRun ? "🧪 ESSAI À BLANC" : "✅ ÉCRIT"} — ${result.lignes_lues} partants lus, ` +
      `${result.doublons_ecartes} doublons de course écartés, ${Math.round(result.elapsed_ms / 1000)} s`);
    console.table(result.results.map((r) => ({
      entite: r.entite, fiches: r.fiches, avant: r.existantes, nouvelles: r.nouvelles,
      supprimees: r.supprimees, noms_changes: r.renommees, alias: r.alias,
      musiques: r.ecartees_musique, collisions: r.collisions_slug, erreurs: r.errors,
    })));
    for (const r of result.results) {
      console.log(`\n── ${r.entite} ──`);
      console.log("  nouvelles :", r.exemples.nouvelles.join(", ") || "—");
      console.log("  supprimées :", r.exemples.supprimees.join(", ") || "—");
      console.log("  noms changés :", r.exemples.renommees.join(" | ") || "—");
    }
    if (process.env.SEO_ETL_RAPPORT) writeFileSync(process.env.SEO_ETL_RAPPORT, JSON.stringify(result, null, 2));

    const errors = result.results.reduce((n, r) => n + r.errors, 0);
    if (!dryRun) await journaliser(errors > 0 ? "failure" : "success", { ...result }, Date.now() - start);
    if (errors > 0) process.exit(1);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("❌ seo-etl-cli:", msg);
    if (!dryRun) await journaliser("failure", { error: msg }, Date.now() - start);
    process.exit(1);
  }
}

main();
