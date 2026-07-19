#!/usr/bin/env node
/**
 * scripts/build.mjs
 *
 * Lance `next build` avec un heap Node élargi. Le point clé : le drapeau est
 * posé via la variable d'environnement NODE_OPTIONS, donc il est HÉRITÉ par les
 * workers de génération statique que Next lance en sous-processus — c'est eux
 * qui tombaient en "out of memory" sur ce gros site SSG (~1 100 pages).
 *
 * Zéro dépendance (pas de cross-env) → fonctionne sur Windows ET Linux, donc le
 * gate local `npm run build` passe sans avoir à exporter NODE_OPTIONS à la main.
 *
 * Ne touche pas au chemin de déploiement Cloudflare (`build:cf`), inchangé.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HEAP = "--max-old-space-size=8192";

// Respecte un NODE_OPTIONS déjà défini (et n'ajoute pas le drapeau deux fois).
const current = process.env.NODE_OPTIONS ?? "";
process.env.NODE_OPTIONS = current.includes("max-old-space-size")
  ? current
  : `${current} ${HEAP}`.trim();

// Résout l'entrée JS de Next et la lance avec le node courant (pas de shell →
// robuste multi-plateforme). Les sous-processus héritent de process.env.
const nextBin = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);

const res = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: process.env,
});

process.exit(res.status ?? 1);
