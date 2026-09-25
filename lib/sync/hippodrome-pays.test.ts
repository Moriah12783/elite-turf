import { describe, it, expect } from "vitest";
import { estNomHippodromeMarocain } from "./hippodrome-pays";

describe("estNomHippodromeMarocain — les 7 hippodromes SOREC", () => {
  // Settat, Khemisset et Meknès étaient enregistrés « France » (25/09/2026) :
  // la LONACI ne donne pas le pays, et la liste d'origine n'en connaissait que 3.
  it("reconnaît les hippodromes marocains, quelle que soit la graphie", () => {
    for (const nom of ["ANFA", "Casablanca-Anfa", "SETTAT", "Khemisset", "MEKNES", "Meknès", "Marrakech", "RABAT", "El Jadida", "EL-JADIDA"]) {
      expect(estNomHippodromeMarocain(nom)).toBe(true);
    }
  });

  it("ne confond pas un hippodrome français", () => {
    for (const nom of ["Vincennes", "Saint-Cloud", "Nantes", "Salon-de-Provence", "ParisLongchamp", "Cagnes-sur-Mer", ""]) {
      expect(estNomHippodromeMarocain(nom)).toBe(false);
    }
    expect(estNomHippodromeMarocain(null)).toBe(false);
  });
});
