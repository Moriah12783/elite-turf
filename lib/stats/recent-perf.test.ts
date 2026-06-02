import { describe, it, expect } from "vitest";
import { computeRecentPerf } from "./recent-perf";

describe("computeRecentPerf", () => {
  it("compte les gagnants et le taux de réussite", () => {
    const r = computeRecentPerf([
      { resultat: "GAGNANT", rapport_gagnant: 5 },
      { resultat: "GAGNANT", rapport_gagnant: 3 },
      { resultat: "PERDANT" },
    ]);
    expect(r.nb).toBe(3);
    expect(r.gagnants).toBe(2);
    expect(r.tauxReussite).toBe(67);
  });

  it("roi = null quand AUCUN rapport n'est connu (pas de −100% trompeur)", () => {
    const r = computeRecentPerf([
      { resultat: "GAGNANT", rapport_gagnant: null },
      { resultat: "GAGNANT", rapport_gagnant: null },
      { resultat: "PERDANT", rapport_gagnant: null },
    ]);
    expect(r.gagnants).toBe(2);
    expect(r.roi).toBeNull(); // ← le cœur du fix
  });

  it("roi calculé dès qu'un rapport existe", () => {
    const r = computeRecentPerf([
      { resultat: "GAGNANT", rapport_gagnant: 4 }, // gains 4
      { resultat: "PERDANT", rapport_gagnant: null },
    ]);
    expect(r.roi).toBe(100); // (4 − 2) / 2 = +100 %
  });

  it("liste vide → tout null/0", () => {
    expect(computeRecentPerf([])).toEqual({ nb: 0, gagnants: 0, tauxReussite: null, roi: null, gains: 0 });
  });
});
