/**
 * scripts/pmu-rattrapage-cli.ts
 *
 * Rattrapage ponctuel depuis le programme PMU officiel
 * (lib/sync/pmu-rattrapage.ts) : arrivées manquantes + heures de départ
 * enregistrées en GMT. N'écrase aucune arrivée, ne juge aucun pronostic.
 *
 * Lancé par le workflow manuel rattrapage-arrivees.yml, ou en local :
 *   node --env-file=.env.local <bundle esbuild>
 *
 * Env : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY ;
 *   RATTRAPAGE_SINCE   YYYY-MM-DD (obligatoire)
 *   RATTRAPAGE_UNTIL   YYYY-MM-DD (défaut : hier, heure de Paris)
 *   RATTRAPAGE_DRY_RUN true = ne rien écrire
 *   RATTRAPAGE_CORRIGER true = remplacer par l'arrivée PMU les arrivées
 *                      contredites des courses SANS pronostic
 */
import { runRattrapagePmu } from "@/lib/sync/pmu-rattrapage";
import { todayParisISO } from "@/lib/paris-date";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function veille(iso: string): string {
  return new Date(Date.parse(iso + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const depuis = process.env.RATTRAPAGE_SINCE || "";
  if (!ISO.test(depuis)) throw new Error("RATTRAPAGE_SINCE (YYYY-MM-DD) est obligatoire");
  const jusqua = ISO.test(process.env.RATTRAPAGE_UNTIL || "")
    ? (process.env.RATTRAPAGE_UNTIL as string)
    : veille(todayParisISO());

  const result = await runRattrapagePmu({
    depuis,
    jusqua,
    dryRun: process.env.RATTRAPAGE_DRY_RUN === "true",
    corrigerDivergentes: process.env.RATTRAPAGE_CORRIGER === "true",
  });
  console.log("✅ RESULT", JSON.stringify(result));
  if (result.echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error("❌ pmu-rattrapage-cli:", e instanceof Error ? e.message : e);
  process.exit(1);
});
