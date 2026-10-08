/**
 * scripts/backfill-arrivee-rangs.ts
 *
 * Pose les rangs officiels (ex æquo) sur les arrivées déjà en base, d'après le
 * programme PMU (lib/sync/arrivee-rangs-backfill.ts). N'écrit QUE des rangs :
 * ni arrivée, ni rapport, ni pronostic.
 *
 * ESSAI À BLANC PAR DÉFAUT. Écrire exige BACKFILL_RANGS_ECRIRE=true, et la
 * migration 20261008_arrivee_rangs.sql appliquée.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-arrivee-rangs.ts
 *
 * Env : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY ;
 *   BACKFILL_RANGS_SINCE  YYYY-MM-DD (défaut : 2026-02-14, première arrivée en base)
 *   BACKFILL_RANGS_UNTIL  YYYY-MM-DD (défaut : aujourd'hui, heure de Paris)
 *   BACKFILL_RANGS_ECRIRE true = écrire (sinon essai à blanc)
 */
import { runBackfillRangs } from "@/lib/sync/arrivee-rangs-backfill";
import { todayParisISO } from "@/lib/paris-date";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function main(): Promise<void> {
  const depuis = ISO.test(process.env.BACKFILL_RANGS_SINCE || "") ? (process.env.BACKFILL_RANGS_SINCE as string) : "2026-02-14";
  const jusqua = ISO.test(process.env.BACKFILL_RANGS_UNTIL || "") ? (process.env.BACKFILL_RANGS_UNTIL as string) : todayParisISO();
  const ecrire = process.env.BACKFILL_RANGS_ECRIRE === "true";

  console.log(`${ecrire ? "✍️  ÉCRITURE" : "🔍 ESSAI À BLANC"} des rangs du ${depuis} au ${jusqua}`);
  const r = await runBackfillRangs({ depuis, jusqua, dryRun: !ecrire });

  console.log(`\nJours lus : ${r.jours} (PMU indisponible : ${r.jours_indisponibles.length ? r.jours_indisponibles.join(", ") : "aucun"})`);
  console.log(`Courses PMU avec un ex æquo : ${r.courses_pmu_ex_aequo}`);
  console.log(`\nRangs à poser (${r.a_ecrire.length}) :`);
  for (const l of r.a_ecrire) console.log(`  ${l}`);
  console.log(`\nDéjà posés : ${r.deja} · ex æquo hors de la partie enregistrée : ${r.sans_ex_aequo_enregistre}`);
  console.log(`Arrivées en base différentes du PMU, non touchées (${r.non_concordantes.length}) :`);
  for (const l of r.non_concordantes) console.log(`  ${l}`);
  console.log(`courses ≠ arrivees, non touchées (${r.desynchronisees.length}) :`);
  for (const l of r.desynchronisees) console.log(`  ${l}`);
  if (ecrire) console.log(`\nÉcrites : ${r.ecrites} · échecs : ${r.echecs}`);
  if (r.echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error("❌ backfill-arrivee-rangs:", e instanceof Error ? e.message : e);
  process.exit(1);
});
