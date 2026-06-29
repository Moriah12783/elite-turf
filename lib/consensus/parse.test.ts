import { describe, it, expect } from "vitest";
import { parseConsensus } from "./parse";

describe("parseConsensus", () => {
  it("parse le nouveau format numero citations bases (sans cote)", () => {
    const { partants, errors } = parseConsensus("11 28 12\n10 25 8");
    expect(errors).toEqual([]);
    expect(partants).toEqual([
      { numero: 11, citations: 28, bases: 12 },
      { numero: 10, citations: 25, bases: 8 },
    ]);
  });

  it("tolère l'ancien format avec cote en 3e champ : cote ignorée, bases en 4e", () => {
    const { partants } = parseConsensus("11 28 3.2 12\n7 15 8,5 2");
    expect(partants[0]).toEqual({ numero: 11, citations: 28, bases: 12 });
    expect(partants[1]).toEqual({ numero: 7, citations: 15, bases: 2 });
  });

  it("cote seule (sans bases) → ignorée, aucun champ parasite", () => {
    const { partants } = parseConsensus("11 28 3.2");
    expect(partants).toEqual([{ numero: 11, citations: 28 }]);
  });

  it("accepte le point-virgule comme séparateur", () => {
    const { partants } = parseConsensus("5;18;3\n8 22");
    expect(partants[0]).toEqual({ numero: 5, citations: 18, bases: 3 });
    expect(partants[1]).toEqual({ numero: 8, citations: 22 });
  });

  it("ignore l'en-tête, les lignes vides et les commentaires", () => {
    const { partants } = parseConsensus("Cheval Citations Bases\n# AUTEUIL\n\n11 28 5\n");
    expect(partants).toEqual([{ numero: 11, citations: 28, bases: 5 }]);
  });

  it("3e champ ENTIER = bases (jamais interprété comme une cote)", () => {
    expect(parseConsensus("11 28 4").partants).toEqual([{ numero: 11, citations: 28, bases: 4 }]);
    expect(parseConsensus("12 8 0").partants).toEqual([{ numero: 12, citations: 8, bases: 0 }]);
  });

  it("gère le format minimal numero citations", () => {
    const { partants } = parseConsensus("8 22");
    expect(partants).toEqual([{ numero: 8, citations: 22 }]);
  });

  it("détecte « Nb sources : N » et l'expose", () => {
    const r = parseConsensus("Nb sources : 29\n7 30 11\n8 27");
    expect(r.nbSources).toBe(29);
    expect(r.partants).toEqual([
      { numero: 7, citations: 30, bases: 11 },
      { numero: 8, citations: 27 },
    ]);
  });

  it("ignore SILENCIEUSEMENT la prose et les nombres seuls (collage du fichier entier)", () => {
    const r = parseConsensus("Date : 2026-06-29\n7\n29\n11\n7 30\n8 27");
    expect(r.partants).toEqual([
      { numero: 7, citations: 30 },
      { numero: 8, citations: 27 },
    ]);
    expect(r.errors).toEqual([]); // aucun avertissement sur le bruit
  });

  it("signale les doublons et les garde une seule fois", () => {
    const { partants, errors } = parseConsensus("11 28\n11 10");
    expect(partants).toEqual([{ numero: 11, citations: 28 }]);
    expect(errors.length).toBe(1);
  });
});
