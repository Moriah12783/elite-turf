import { describe, it, expect } from "vitest";
import { buildConsensus, type ConsensusInput } from "./engine";

/**
 * Exemple réaliste : une course de 16 partants, consensus agrégé sur 30 sources.
 * Chiffres choisis pour des assertions claires (favoris très cités, outsiders et
 * tocards diversement cités).
 */
const RACE: ConsensusInput = {
  nbSources: 30,
  partants: [
    { numero: 11, nom: "A", citations: 28, bases: 12, cote: 3.2 }, // favori, top score
    { numero: 10, nom: "B", citations: 25, bases: 8, cote: 4.0 }, // favori
    { numero: 8, nom: "C", citations: 22, bases: 5, cote: 4.8 }, // favori
    { numero: 5, nom: "D", citations: 18, bases: 3, cote: 6.0 }, // outsider
    { numero: 7, nom: "E", citations: 15, bases: 2, cote: 8.0 }, // outsider
    { numero: 4, nom: "F", citations: 12, bases: 1, cote: 9.5 }, // outsider
    { numero: 6, nom: "G", citations: 10, bases: 1, cote: 11.0 }, // outsider
    { numero: 12, nom: "H", citations: 8, bases: 0, cote: 18.0 }, // tocard le + cité
    { numero: 2, nom: "I", citations: 6, bases: 0, cote: 22.0 }, // tocard
    { numero: 3, nom: "J", citations: 5, bases: 0, cote: 25.0 }, // tocard
    { numero: 1, nom: "K", citations: 4, bases: 0, cote: 4.5 }, // favori peu cité
    { numero: 9, nom: "L", citations: 3, bases: 0, cote: 14.0 }, // tocard
    { numero: 14, nom: "M", citations: 1, bases: 0, cote: 40.0 }, // délaissé
    { numero: 13, nom: "N", citations: 0, bases: 0, cote: 30.0 },
    { numero: 15, nom: "O", citations: 0, bases: 0, cote: 33.0 },
    { numero: 16, nom: "P", citations: 0, bases: 0, cote: 50.0 },
  ],
};

describe("buildConsensus", () => {
  const r = buildConsensus(RACE);

  it("trie par score de consensus et expose les plus cités", () => {
    expect(r.topCites.map((p) => p.numero)).toEqual([11, 10, 8, 5, 7]);
    expect(r.topCites[0].scoreConsensus).toBe(28 + 0.5 * 12); // 34
  });

  it("classe favoris / outsiders / tocards selon la cote", () => {
    const byNum: Record<number, string> = {};
    r.partants.forEach((p) => (byNum[p.numero] = p.categorie));
    expect(byNum[11]).toBe("FAVORI");
    expect(byNum[1]).toBe("FAVORI"); // cote 4.5 < 5 même si peu cité
    expect(byNum[5]).toBe("OUTSIDER");
    expect(byNum[12]).toBe("TOCARD");
  });

  it("produit les 3 tops demandés (favoris / outsiders / tocards cités)", () => {
    expect(r.topFavoris.map((p) => p.numero)).toEqual([11, 10, 8, 1]);
    expect(r.topOutsiders.map((p) => p.numero)).toEqual([5, 7, 4, 6]);
    expect(r.topTocards.map((p) => p.numero)).toEqual([12, 2, 3, 9, 14]);
  });

  it("calcule le taux de citation", () => {
    expect(r.partants.find((p) => p.numero === 11)!.tauxCitation).toBeCloseTo(28 / 30, 5);
  });

  it("assemble la sélection Elite (6) = base 3 + value 2 + coup 1", () => {
    expect(r.elite.base).toEqual([11, 10, 8]);
    expect(r.elite.value).toEqual([5, 7]);
    expect(r.elite.coup).toEqual([12]);
    expect(r.elite.selection).toEqual([11, 10, 8, 5, 7, 12]);
  });

  it("assemble la sélection Pro (8) = base 4 + value 3 + coup 1", () => {
    expect(r.pro.selection).toEqual([11, 10, 8, 5, 7, 4, 6, 12]);
    expect(r.pro.selection.length).toBe(8);
  });

  it("ne produit aucun doublon dans les sélections", () => {
    expect(new Set(r.elite.selection).size).toBe(r.elite.selection.length);
    expect(new Set(r.pro.selection).size).toBe(r.pro.selection.length);
  });

  it("respecte des compositions personnalisées", () => {
    const r2 = buildConsensus(RACE, { elite: { base: 2, value: 1, coup: 0, total: 3 } });
    expect(r2.elite.selection).toEqual([11, 10, 5]);
  });
});
