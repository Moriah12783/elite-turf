/**
 * scripts/pmu-rapports-remplacement-cli.ts
 *
 * Remplacement ONE-SHOT des rapports en base par les rapports PMU officiels
 * (lib/sync/pmu-rapports-remplacement.ts — audit et décisions du 09/10/2026).
 * ESSAI À BLANC PAR DÉFAUT : rien n'est écrit sans `--ecrire`.
 *
 * Avant `--ecrire` : sauvegarde des rapports actuels dans le schéma
 * `sauvegarde` (SQL Editor ou MCP Supabase), puis vérification du compte.
 *
 * Usage :
 *   npx tsx scripts/pmu-rapports-remplacement-cli.ts [--plan=plan.json] [--depuis=AAAA-MM-JJ] [--jusqua=AAAA-MM-JJ] [--ecrire]
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ── Charger .env.local manuellement (pas de dotenv installé) ──────────────
function loadEnvLocal() {
  try {
    const content = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    console.error("⚠ Impossible de charger .env.local :", err);
    process.exit(1);
  }
}

function option(nom: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${nom}=`));
  return a ? a.slice(nom.length + 3) : undefined;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const { runRemplacementRapports } = await import("@/lib/sync/pmu-rapports-remplacement");
  const ecrire = process.argv.includes("--ecrire");
  const r = await runRemplacementRapports({ ecrire, depuis: option("depuis"), jusqua: option("jusqua") });

  const chemin = option("plan");
  if (chemin) writeFileSync(chemin, JSON.stringify(r.plan, null, 1));

  console.log(ecrire ? "✍️  ÉCRITURE" : "🧪 ESSAI À BLANC (rien d'écrit)");
  console.log(`lignes lues : ${r.lues}`);
  console.log("par action :", JSON.stringify(r.par_action, null, 1));
  console.log("par motif  :", JSON.stringify(r.par_motif, null, 1));
  if (ecrire) console.log(`écrites : ${r.ecrites} · échecs : ${r.echecs}`);
  if (chemin) console.log(`plan détaillé : ${chemin}`);
  if (r.echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error("❌ pmu-rapports-remplacement-cli :", e instanceof Error ? e.message : e);
  process.exit(1);
});
