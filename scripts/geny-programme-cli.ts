/**
 * scripts/geny-programme-cli.ts
 *
 * Sync du PROGRAMME Geny (courses du JOUR ou J+1) → Supabase, exécuté par
 * GitHub Actions (IP Azure propre — Geny 403 l'IP du Worker Cloudflare).
 *
 * Le jour est piloté par l'env PROG_DAY ("today" | "demain"), posé par le
 * workflow appelant (pmu-sync.yml = today, pmu-demain.yml = demain).
 *
 * Réutilise la logique partagée `runGenyProgrammeSync()` (client via la version
 * PURE de createServiceClient — cf. lib/supabase/service-client).
 *
 * Env : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 */
import { runGenyProgrammeSync } from "@/lib/sync/geny-programme";

async function main(): Promise<void> {
  const day = process.env.PROG_DAY === "demain" ? "demain" : "today";
  const result = await runGenyProgrammeSync(day);
  console.log("✅ RESULT", JSON.stringify(result));
  // Programme vide = anomalie (Geny KO / parsing cassé) → exit 1 = job rouge
  // → GitHub envoie un email au propriétaire du repo (alerte anti-silent-failure).
  if (!result.courses || result.courses === 0) {
    console.error(`❌ 0 course chargée pour "${day}" — anomalie.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ geny-programme-cli:", e instanceof Error ? e.message : e);
  process.exit(1);
});
