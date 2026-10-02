/**
 * scripts/pmu-rapports-backfill-cli.ts
 *
 * Remplissage ponctuel des rapports PMU définitifs (source API PMU officielle,
 * lib/sync/pmu-rapports.ts) dans `arrivees.rapports_pmu`. Remplace l'ancienne
 * version Geny (geny-rapports-backfill-cli.ts), bloquée par Geny (403).
 *
 * Lancé par le workflow manuel backfill-rapports.yml. N'écrase jamais un
 * rapport existant et n'alimente pas le ROI (propagation coupée).
 *
 * Env : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY ;
 *   BACKFILL_SCOPE  quinte (défaut) | all
 *   BACKFILL_SINCE  YYYY-MM-DD (défaut : 30 jours en arrière)
 *   BACKFILL_LIMIT  plafond de courses (optionnel)
 *   BACKFILL_DRY_RUN true = ne rien écrire
 */
import { runPmuRapportsSync } from "@/lib/sync/pmu-rapports";
import { todayParisISO } from "@/lib/paris-date";

function decaler(iso: string, jours: number): string {
  return new Date(Date.parse(iso + "T12:00:00Z") + jours * 86400000).toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const aujourdhui = todayParisISO();
  const depuis = /^\d{4}-\d{2}-\d{2}$/.test(process.env.BACKFILL_SINCE || "") ? (process.env.BACKFILL_SINCE as string) : decaler(aujourdhui, -30);
  const limite = parseInt(process.env.BACKFILL_LIMIT || "", 10);
  const result = await runPmuRapportsSync({
    depuis,
    jusqua: aujourdhui,
    portee: process.env.BACKFILL_SCOPE === "all" ? "toutes" : "quinte",
    limite: Number.isFinite(limite) && limite > 0 ? limite : undefined,
    dryRun: process.env.BACKFILL_DRY_RUN === "true",
  });
  console.log("✅ RESULT", JSON.stringify(result));
  if (result.echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error("❌ pmu-rapports-backfill-cli:", e instanceof Error ? e.message : e);
  process.exit(1);
});
