import { describe, it, expect } from "vitest";
import { parseConsensus } from "./parse";

describe("parseConsensus", () => {
  it("parse le format complet numero citations cote bases", () => {
    const { partants, errors } = parseConsensus("11 28 3.2 12\n10 25 4.0 8");
    expect(errors).toEqual([]);
    expect(partants).toEqual([
      { numero: 11, citations: 28, cote: 3.2, bases: 12 },
      { numero: 10, citations: 25, cote: 4.0, bases: 8 },
    ]);
  });

  it("accepte le point-virgule comme séparateur et la virgule décimale", () => {
    const { partants } = parseConsensus("5;18;6;0\n7 15 8,5 2");
    expect(partants[0]).toEqual({ numero: 5, citations: 18, cote: 6, bases: 0 });
    expect(partants[1]).toEqual({ numero: 7, citations: 15, cote: 8.5, bases: 2 });
  });

  it("ignore l'en-tête, les lignes vides et les commentaires", () => {
    const { partants } = parseConsensus("Cheval Citations Cote\n# AUTEUIL\n\n11 28 3.2\n");
    expect(partants).toEqual([{ numero: 11, citations: 28, cote: 3.2 }]);
  });

  it("gère le format minimal numero citations", () => {
    const { partants } = parseConsensus("8 22");
    expect(partants).toEqual([{ numero: 8, citations: 22 }]);
  });

  it("signale les doublons et les garde une seule fois", () => {
    const { partants, errors } = parseConsensus("11 28\n11 10");
    expect(partants).toEqual([{ numero: 11, citations: 28 }]);
    expect(errors.length).toBe(1);
  });
});
