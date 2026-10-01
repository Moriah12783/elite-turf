/**
 * scripts/seo/similarite-pays.ts
 *
 * Mesure la similarité des 12 pages `/pronostics-pmu-*` (brief « pages pays »
 * du 01/10/2026, §5). Méthode et seuils : lib/seo/similarite.ts.
 *
 * Usage (même convention que les autres CLI du dépôt) :
 *   npx -y esbuild scripts/seo/similarite-pays.ts --bundle --platform=node \
 *     --format=esm --target=node20 --tsconfig=tsconfig.json \
 *     --packages=external --outfile=similarite-pays.mjs
 *   node similarite-pays.mjs [--base http://localhost:3000] [--out rapport.md]
 *                            [--titre "Mesure de référence"] [--strict]
 *
 *   --base    site à mesurer (défaut : serveur local `next start`)
 *   --out     écrit le rapport Markdown dans ce fichier (sinon sortie standard)
 *   --strict  code de sortie 1 si un seuil est dépassé (usage CI)
 */
import { writeFileSync } from "node:fs";
import { COUNTRIES, type Country } from "@/lib/geo/countries";
import {
  analyserPages, extraireTexteMain, texteDePremiere, metaDescription,
  SEUIL_SIMILARITE_MAX, SEUIL_PART_PROPRE_MIN, type JetonsPays, type PageMesuree,
} from "@/lib/seo/similarite";

/** Gentilés et autres désignations du pays, remplacés comme le nom. */
const AUTRES_NOMS: Record<string, string[]> = {
  CI: ["ivoirien", "ivoirienne", "ivoiriens", "ivoiriennes"],
  SN: ["sénégalais", "sénégalaise", "sénégalaises"],
  CM: ["camerounais", "camerounaise", "camerounaises"],
  MA: ["marocain", "marocaine", "marocains", "marocaines", "royaume du maroc"],
  ML: ["malien", "malienne", "maliens", "maliennes"],
  BF: ["burkinabè", "burkinabé", "burkinabés", "burkina"],
  TD: ["tchadien", "tchadienne", "tchadiens", "tchadiennes"],
  GA: ["gabonais", "gabonaise", "gabonaises"],
  TG: ["togolais", "togolaise", "togolaises"],
  CG: ["congolais", "congolaise", "congolaises", "congo", "congo-brazzaville"],
  MG: ["malgache", "malgaches", "grande île"],
  // Pas « réunion » seul : c'est aussi la réunion de courses, sur toutes les pages.
  RE: ["réunionnais", "réunionnaise", "réunionnaises", "974"],
};

/** Désignations de devise : un seul jeton pour toutes les pages. */
const DEVISES = ["francs cfa", "franc cfa", "fcfa", "xof", "xaf", "dirhams", "dirham", "dh", "mad", "euros", "euro", "eur", "€", "mga", "ariary"];

function variantesOperateur(c: Country): string[] {
  const op = c.operateurOfficiel;
  if (!op) return [];
  const v = [op.nom, op.site, op.site.replace(/^https?:\/\//, ""), op.site.replace(/^https?:\/\/(www\.)?/, "")];
  const sansParentheses = op.nom.replace(/\s*\([^)]*\)/g, "");
  v.push(sansParentheses);
  sansParentheses.split("/").forEach((morceau) => v.push(morceau.trim()));
  return v.filter((x) => x.length > 1);
}

function jetonsDe(c: Country): JetonsPays {
  return {
    pays: [c.nom, c.nomComplet, c.drapeau].concat(AUTRES_NOMS[c.code] || []),
    capitale: [c.capitale],
    operateur: variantesOperateur(c),
    devise: DEVISES,
  };
}

function lireArgs(argv: string[]) {
  const args: { base: string; out?: string; titre: string; strict: boolean } = {
    base: "http://localhost:3000", titre: "Mesure", strict: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base") args.base = argv[++i].replace(/\/$/, "");
    else if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--titre") args.titre = argv[++i];
    else if (argv[i] === "--strict") args.strict = true;
  }
  return args;
}

const pct = (x: number) => `${(x * 100).toFixed(0)} %`;

async function main() {
  const args = lireArgs(process.argv.slice(2));
  const pages: PageMesuree[] = [];
  const infos: Record<string, { statut: number; nbH1: number; mots: number }> = {};

  for (const c of COUNTRIES) {
    const url = `${args.base}/pronostics-pmu-${c.slug}`;
    const res = await fetch(url, { headers: { "User-Agent": "elite-turf-similarite-pays" } });
    const html = await res.text();
    const texte = extraireTexteMain(html);
    pages.push({
      slug: c.slug,
      titre: texteDePremiere(html, "title"),
      h1: texteDePremiere(html, "h1"),
      metaDescription: metaDescription(html),
      texte,
      jetons: jetonsDe(c),
    });
    infos[c.slug] = { statut: res.status, nbH1: (html.match(/<h1[\s>]/gi) || []).length, mots: texte.split(" ").length };
  }

  const r = analyserPages(pages);
  const l: string[] = [];
  l.push(`# Similarité des pages pays — ${args.titre}`);
  l.push("");
  l.push(`- Date : ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`);
  l.push(`- Source : \`${args.base}\` (12 pages \`/pronostics-pmu-*\`)`);
  l.push("- Méthode : texte du `<main>` sans `<script>`/`<style>` ni blocs `data-shared=\"true\"` ; minuscules ; nom du pays, gentilé, capitale, opérateur (nom et site) et devise remplacés par des jetons ; similarité de Jaccard sur les 5-grammes de mots, pour chaque paire (`lib/seo/similarite.ts`).");
  l.push(`- Seuils bloquants : similarité max par paire ≤ ${SEUIL_SIMILARITE_MAX} ; au moins ${pct(SEUIL_PART_PROPRE_MIN)} de 5-grammes propres par page ; titres, H1 et meta descriptions uniques.`);
  l.push("");
  l.push(r.infractions.length === 0
    ? "**Verdict : ✅ sous tous les seuils.**"
    : `**Verdict : ❌ ${r.infractions.length} dépassement(s) de seuil.**`);
  l.push("");
  l.push("## Par page");
  l.push("");
  l.push("| Page | HTTP | Mots | 5-grammes | Part propre | Similarité max | Page la plus proche | Nb de H1 |");
  l.push("|---|---|---|---|---|---|---|---|");
  for (const p of r.pages) {
    const i = infos[p.slug];
    l.push(`| ${p.slug} | ${i.statut} | ${i.mots} | ${p.nbNgrammes} | ${pct(p.partPropre)} | ${p.similariteMax.toFixed(2)} | ${p.plusProche} | ${i.nbH1} |`);
  }
  l.push("");
  l.push("## Les 15 paires les plus similaires");
  l.push("");
  l.push("| Page A | Page B | Similarité |");
  l.push("|---|---|---|");
  for (const p of r.paires.slice(0, 15)) l.push(`| ${p.a} | ${p.b} | ${p.similarite.toFixed(2)} |`);
  l.push("");
  l.push("## Titres, H1 et meta descriptions");
  l.push("");
  l.push("| Page | Titre | H1 | Meta description |");
  l.push("|---|---|---|---|");
  for (const p of pages) {
    const cel = (s: string) => (s || "∅").replace(/\|/g, "\\|");
    l.push(`| ${p.slug} | ${cel(p.titre)} | ${cel(p.h1)} | ${cel(p.metaDescription)} |`);
  }
  l.push("");
  if (r.infractions.length) {
    l.push("## Dépassements de seuil");
    l.push("");
    for (const inf of r.infractions) l.push(`- ${inf}`);
    l.push("");
  }

  const md = l.join("\n");
  if (args.out) writeFileSync(args.out, md, "utf8");
  else console.log(md);
  console.error(`[similarite-pays] ${r.infractions.length} dépassement(s) — similarité max ${r.paires[0]?.similarite.toFixed(2)}`);
  if (args.strict && r.infractions.length) process.exit(1);
}

main().catch((e) => {
  console.error("[similarite-pays] échec :", e);
  process.exit(1);
});
