/**
 * Garde-fou (audit du 09/10/2026) : les rapports lus sur Geny étaient faux
 * (Tiercé et Quinté+ sur des courses qui n'en ont pas, montants d'un autre
 * opérateur). `arrivees.rapports_pmu` ne reçoit plus que les rapports de l'API
 * PMU officielle (lib/sync/pmu-rapports.ts).
 *
 * Aucun code de production (hors tests) ne doit donc lire les rapports d'une
 * page Geny : un seul appel à `parseRapportsPMU` suffirait à réécrire des
 * rapports fantômes, que la synchro PMU (qui n'écrit que dans un rapport vide)
 * ne remplacerait jamais. Le parser reste pour le type `RapportsPMU`,
 * `parseCommentaire` et ses propres tests.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const RACINE = fileURLToPath(new URL("../../", import.meta.url));
const DOSSIERS = ["app", "lib", "components", "scripts", "cron-worker/src"];
const DEFINITION = "lib/sync/geny-rapports-parser.ts";

function fichiersSource(dossier: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dossier)) {
    if (nom === "node_modules" || nom.startsWith(".")) continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) out.push(...fichiersSource(chemin));
    else if (/\.(ts|tsx|mjs|js)$/.test(nom) && !/\.test\.ts$/.test(nom)) out.push(chemin);
  }
  return out;
}

describe("rapports Geny : plus aucun lecteur en production", () => {
  it("aucun fichier hors tests n'utilise parseRapportsPMU", () => {
    const fautifs = DOSSIERS
      .flatMap((d) => fichiersSource(join(RACINE, d)))
      .map((f) => relative(RACINE, f).replace(/\\/g, "/"))
      .filter((f) => f !== DEFINITION)
      .filter((f) => /\bparseRapportsPMU\b/.test(readFileSync(join(RACINE, f), "utf8")));
    expect(fautifs).toEqual([]);
  });
});
