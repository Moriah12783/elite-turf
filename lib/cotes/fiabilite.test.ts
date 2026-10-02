import { describe, it, expect } from "vitest";
import { cotesPlausibles, SOMME_PROBA_MAX } from "./fiabilite";

describe("cotesPlausibles — une vraie cote de marché, pas une valeur par défaut", () => {
  it("vraies cotes PMU (Vincennes R1C4, 02/10/2026) → plausibles", () => {
    const vraies = [64, 34, 16, 5.4, 15, 6.2, 23, 43, 8.5, 23, 6.7, 17, 6.6, 14];
    expect(cotesPlausibles(vraies)).toBe(true);
  });

  it("LONACI « 1,2 » pour chaque cheval (Anfa R9C5, 02/10/2026) → pas une cote", () => {
    expect(cotesPlausibles(Array(12).fill(1.2))).toBe(false);
  });

  it("masse sans pari : même cote pour tous (0,85 × 4 = 3,4) → pas une cote", () => {
    expect(cotesPlausibles([3.4, 3.4, 3.4, 3.4])).toBe(false);
  });

  it(`somme des probabilités > ${SOMME_PROBA_MAX} (Settat R9C8, 18/09/2026) → pas une cote`, () => {
    expect(cotesPlausibles([1.2, 1.9, 1.2, 1.9, 1.9, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2])).toBe(false);
  });

  it("un vrai gros favori à 1,2 reste plausible", () => {
    expect(cotesPlausibles([1.2, 6.5, 9, 14, 21, 35])).toBe(true);
  });

  it("trop peu de cotes pour juger → on ne tranche pas (plausible)", () => {
    expect(cotesPlausibles([1.2, 1.2, 1.2])).toBe(true);
    expect(cotesPlausibles([])).toBe(true);
  });

  it("ignore les cotes absentes et accepte les nombres sous forme de texte", () => {
    expect(cotesPlausibles([null, undefined, "1.20", "1.20", "1.20", "1.20"])).toBe(false);
    expect(cotesPlausibles(["2.5", null, "4", "7.5", "12"])).toBe(true);
  });
});
