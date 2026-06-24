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

async function main(): Promise<void> {
  const result = await runGenyArriveesSync();
  console.log("✅ RESULT", JSON.stringify(result));
}

main().catch((e) => {
  console.error("❌ geny-arrivees-cli:", e instanceof Error ? e.message : e);
  process.exit(1);
});
