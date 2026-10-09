/**
 * scripts/verif-cles-acteurs-cli.ts
 *
 * Après la migration 20261009_cles_acteurs : vérifie, sur TOUTES les lignes de
 * `partants`, que les clés calculées par Postgres (slug_acteur /
 * cle_personne) donnent exactement les clés du TypeScript
 * (lib/seo/cles-acteurs.ts). Un écart = une fiche qui raterait des courses.
 * Lecture seule.
 *
 *   npx -y esbuild scripts/verif-cles-acteurs-cli.ts --bundle --platform=node --format=esm \
 *     --target=node20 --tsconfig=tsconfig.json --packages=external --outfile=verif-cles.mjs
 *   node --env-file=.env.local verif-cles.mjs
 */
import { createServiceClient } from "@/lib/supabase/service-client";
import { cleCheval, clePersonne } from "@/lib/seo/cles-acteurs";

const PAGE = 1000;

async function main(): Promise<void> {
  const supabase = createServiceClient();
  let lignes = 0;
  const ecarts: string[] = [];
  const nb = { cheval: 0, jockey: 0, entraineur: 0 };

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("partants")
      .select("nom_cheval, jockey, entraineur, cheval_cle, jockey_cle, entraineur_cle")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as any[]) {
      lignes += 1;
      const attendu = {
        cheval:     cleCheval(r.nom_cheval) || null,
        jockey:     clePersonne(r.jockey) || null,
        entraineur: clePersonne(r.entraineur) || null,
      };
      const sql = { cheval: r.cheval_cle ?? null, jockey: r.jockey_cle ?? null, entraineur: r.entraineur_cle ?? null };
      for (const k of ["cheval", "jockey", "entraineur"] as const) {
        if (attendu[k] !== sql[k]) {
          nb[k] += 1;
          const nom = k === "cheval" ? r.nom_cheval : r[k];
          if (ecarts.length < 30) ecarts.push(`${k} ${JSON.stringify(nom)} : TS=${attendu[k]} SQL=${sql[k]}`);
        }
      }
    }
    if (!data || data.length < PAGE) break;
  }

  console.log(`${lignes} partants vérifiés — écarts : chevaux ${nb.cheval}, jockeys ${nb.jockey}, entraîneurs ${nb.entraineur}`);
  for (const e of ecarts) console.log("  ", e);
  if (nb.cheval + nb.jockey + nb.entraineur > 0) process.exit(1);
  console.log("✅ Parité TypeScript ↔ SQL parfaite");
}

main().catch((e) => {
  console.error("❌ verif-cles-acteurs:", e instanceof Error ? e.message : e);
  process.exit(1);
});
