/**
 * scripts/geny-arrivees-cli.ts
 *
 * Sync des ARRIVÉES Geny → Supabase, exécuté par GitHub Actions (IP Azure
 * propre). Geny renvoie HTTP 403 à l'IP du Worker Cloudflare → on déplace le
 * scraping ici (même raison + même pattern que scripts/geny-enrich-cli.ts).
 *
 * Réutilise la logique partagée `runGenyArriveesSync()` (qui crée son client
 * via la version PURE de createServiceClient — cf. lib/supabase/service-client).
 *
 * Env : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 */
import { runGenyArriveesSync } from "@/lib/sync/geny-arrivees";
import { runPmuRapportsSync } from "@/lib/sync/pmu-rapports";
import { runRattrapagePmu } from "@/lib/sync/pmu-rattrapage";
import { todayParisISO } from "@/lib/paris-date";

function decaler(iso: string, jours: number): string {
  return new Date(Date.parse(iso + "T12:00:00Z") + jours * 86400000).toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const result = await runGenyArriveesSync();
  console.log("✅ RESULT", JSON.stringify(result));

  // Rapports PMU définitifs des courses arrivées (2 derniers jours), depuis
  // l'API PMU officielle. Best-effort : n'affecte jamais le statut du job, et
  // n'alimente pas le ROI (propagation coupée le 02/10/2026).
  try {
    const aujourdhui = todayParisISO();
    const avantHier = new Date(Date.parse(aujourdhui + "T12:00:00Z") - 2 * 86400000).toISOString().slice(0, 10);
    const r = await runPmuRapportsSync({ depuis: avantHier, jusqua: aujourdhui, portee: "toutes" });
    console.log("✅ RAPPORTS", JSON.stringify(r));
  } catch (e) {
    console.warn(`⚠️ rapports PMU non synchronisés : ${e instanceof Error ? e.message : String(e)}`);
  }

  // Rattrapage des 3 jours écoulés depuis le programme PMU (02/10/2026) : la
  // synchro ci-dessus ne traite que le jour en cours, et une arrivée publiée
  // trop tard restait manquante pour toujours (1 113 courses du 01/05 au
  // 01/10). N'ajoute que des arrivées absentes (+ heures GMT), ne réécrit
  // aucune arrivée, ne juge aucun pronostic. Best-effort.
  try {
    const aujourdhui = todayParisISO();
    const r = await runRattrapagePmu({ depuis: decaler(aujourdhui, -3), jusqua: decaler(aujourdhui, -1) });
    console.log("✅ RATTRAPAGE", JSON.stringify(r));
  } catch (e) {
    console.warn(`⚠️ rattrapage PMU non effectué : ${e instanceof Error ? e.message : String(e)}`);
  }
}

main().catch((e) => {
  console.error("❌ geny-arrivees-cli:", e instanceof Error ? e.message : e);
  process.exit(1);
});
