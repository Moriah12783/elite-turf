import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { casesQuinte, jsonbRapportsToRapportsList, plusieursCombinaisons } from "./rapports-pmu-format";
import { combinaisonsMultiples, lignesPrincipales, parseRapportsDefinitifs } from "./sync/pmu-rapports";
import type { RapportsPMU } from "./sync/geny-rapports-parser";

const fixture = (nom: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./sync/__fixtures__/${nom}`, import.meta.url)), "utf8"));

const dividendes = (rapports: RapportsPMU, arrivee: number[], typePari: string) =>
  jsonbRapportsToRapportsList(rapports, arrivee).find((r) => r.typePari === typePari)?.dividendes;

describe("casesQuinte — grille Quinté+ de la page des arrivées", () => {
  it("Versailles : une case par Quinté+ payé, puis les bonus", () => {
    const r = parseRapportsDefinitifs(fixture("pmu-rapports-definitifs-20261008-R1C1.json"), [1, 5, 8, 4, 15, 16, 10])!;
    expect(casesQuinte(r)).toEqual([
      { label: "Ordre 1-5-8-4-15", value: 6145.8, accent: true },
      { label: "Ordre 1-5-8-4-16", value: 3227.8, accent: true },
      { label: "Désordre 1-5-8-4-15", value: 72.2, accent: false },
      { label: "Désordre 1-5-8-4-16", value: 39.2, accent: false },
      { label: "Bonus 4", value: 3, accent: false },
      { label: "Bonus 3", value: 2.6, accent: false },
    ]);
  });

  it("sans ex æquo : les quatre cases habituelles, valeurs absentes omises", () => {
    expect(casesQuinte({ quinte_plus: { ordre: 26003.8, desordre: 248, bonus3: 6.2 } })).toEqual([
      { label: "Ordre", value: 26003.8, accent: true },
      { label: "Désordre", value: 248, accent: false },
      { label: "Bonus 3", value: 6.2, accent: false },
    ]);
    expect(casesQuinte({ tierce: { ordre: 1 } })).toEqual([]);
  });
});

describe("plusieursCombinaisons", () => {
  it("vrai seulement pour un pari où l'ex æquo multiplie les combinaisons", () => {
    const r = parseRapportsDefinitifs(fixture("pmu-rapports-definitifs-20261008-R1C1.json"), [1, 5, 8, 4, 15, 16, 10])!;
    expect(plusieursCombinaisons(r, "QUINTE_PLUS")).toBe(true);
    expect(plusieursCombinaisons(r, "TIERCE")).toBe(false);
    expect(plusieursCombinaisons({ tierce: { ordre: 1 } }, "TIERCE")).toBe(false);
  });
});

describe("jsonbRapportsToRapportsList — ex æquo : toutes les combinaisons payées", () => {
  it("Versailles (08/10/2026) : les deux Quinté+, puis les bonus", () => {
    const arrivee = [1, 5, 8, 4, 15, 16, 10];
    const r = parseRapportsDefinitifs(fixture("pmu-rapports-definitifs-20261008-R1C1.json"), arrivee)!;
    expect(dividendes(r, arrivee, "QUINTE_PLUS")).toEqual([
      { combinaison: "1-5-8-4-15 (Ordre)", rapport: 6145.8 },
      { combinaison: "1-5-8-4-16 (Ordre)", rapport: 3227.8 },
      { combinaison: "1-5-8-4-15 (Désordre)", rapport: 72.2 },
      { combinaison: "1-5-8-4-16 (Désordre)", rapport: 39.2 },
      { combinaison: "Bonus 4", rapport: 3 },
      { combinaison: "Bonus 3", rapport: 2.6 },
    ]);
    // Tiercé sans ex æquo : inchangé.
    expect(dividendes(r, arrivee, "TIERCE")).toEqual([
      { combinaison: "1-5-8 (Ordre)", rapport: 55.3 },
      { combinaison: "1-5-8 (Désordre)", rapport: 7.7 },
    ]);
  });

  it("Ville de Paris (21/05/2026) : 147 € est le tiercé 4-11-6, pas 4-11-3", () => {
    const arrivee = [4, 11, 3, 6, 15, 5];
    // Rapports Geny réellement en base (prix des points de vente), complétés.
    const r: RapportsPMU = {
      tierce: { ordre: 147, desordre: 22.6 },
      simple_gagnant: 10.26,
      simple_place: [2.36, 1.83, 1.31],
      combinaisons: {
        source: "points_de_vente",
        lignes: combinaisonsMultiples(lignesPrincipales(fixture("pmu-rapports-offline-20260521-R1C7.json"), "points_de_vente")),
      },
    };
    expect(dividendes(r, arrivee, "TIERCE")).toEqual([
      { combinaison: "4-11-3 (Ordre)", rapport: 109.2 },
      { combinaison: "4-11-6 (Ordre)", rapport: 147 },
      { combinaison: "4-11-3 (Désordre)", rapport: 16.9 },
      { combinaison: "4-11-6 (Désordre)", rapport: 22.6 },
    ]);
    expect(dividendes(r, arrivee, "SIMPLE_PLACE")?.map((d) => d.combinaison)).toEqual(["4", "11", "3", "6"]);
    // Un seul gagnant : le montant en base reste affiché.
    expect(dividendes(r, arrivee, "SIMPLE_GAGNANT")).toEqual([{ combinaison: "4", rapport: 10.26 }]);
  });

  it("sans combinaisons (cas général) : affichage inchangé", () => {
    const r: RapportsPMU = { tierce: { ordre: 646.4, desordre: 98.5 } };
    expect(dividendes(r, [15, 3, 14], "TIERCE")).toEqual([
      { combinaison: "15-3-14 (Ordre)", rapport: 646.4 },
      { combinaison: "15-3-14 (Désordre)", rapport: 98.5 },
    ]);
  });
});
