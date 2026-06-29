import { describe, it, expect } from "vitest";
import { combinations, computeMetrics, betLengthFor, aggregate } from "./metrics";

describe("combinations", () => {
  it("calcule C(n,k)", () => {
    expect(combinations(6, 5)).toBe(6);
    expect(combinations(8, 5)).toBe(56);
    expect(combinations(5, 5)).toBe(1);
    expect(combinations(5, 3)).toBe(10);
    expect(combinations(4, 5)).toBe(0);
  });
});

describe("betLengthFor", () => {
  it("mappe le type de pari", () => {
    expect(betLengthFor("QUINTE_PLUS")).toBe(5);
    expect(betLengthFor("QUARTE")).toBe(4);
    expect(betLengthFor("TIERCE")).toBe(3);
  });
});

describe("computeMetrics", () => {
  it("Quinté gagnant (couverture 5/5) → ROI positif si rapport > coût", () => {
    const m = computeMetrics({ selection: [1, 2, 3, 4, 5, 6], arrivee: [1, 2, 3, 4, 5, 7, 8], betLength: 5, rapport: 8 });
    expect(m.couverture).toBe(5);
    expect(m.couvertureComplete).toBe(true);
    expect(m.categorie).toBe("GAGNANT");
    expect(m.combinaisons).toBe(6); // C(6,5)
    expect(m.cout).toBe(6);
    expect(m.gain).toBe(8);
    expect(m.roi).toBeCloseTo((8 - 6) / 6, 5);
    expect(m.vainqueurHit).toBe(true);
  });

  it("couverture complète mais petit rapport → ROI négatif (couverture != profit)", () => {
    const m = computeMetrics({ selection: [1, 2, 3, 4, 5, 6], arrivee: [1, 2, 3, 4, 5], betLength: 5, rapport: 4 });
    expect(m.categorie).toBe("GAGNANT");
    expect(m.roi).toBeCloseTo((4 - 6) / 6, 5); // ≈ -0.333 : on a "gagné" en perdant de l'argent
  });

  it("4/5 couverts → PARTIEL, gain 0 (hors Bonus), ROI -1", () => {
    const m = computeMetrics({ selection: [1, 2, 3, 4, 6, 7], arrivee: [1, 2, 3, 4, 9], betLength: 5, rapport: 50 });
    expect(m.couverture).toBe(4);
    expect(m.categorie).toBe("PARTIEL");
    expect(m.gain).toBe(0);
    expect(m.roi).toBe(-1);
  });

  it("vainqueur hors sélection → vainqueurHit false, PERDANT", () => {
    const m = computeMetrics({ selection: [1, 2, 3, 4, 5], arrivee: [9, 1, 2], betLength: 5, rapport: 10 });
    expect(m.vainqueurHit).toBe(false);
    expect(m.couverture).toBe(2);
    expect(m.categorie).toBe("PERDANT");
  });

  it("ROI null si rapport inconnu", () => {
    const m = computeMetrics({ selection: [1, 2, 3, 4, 5, 6], arrivee: [1, 2, 3, 4, 5], betLength: 5 });
    expect(m.roi).toBeNull();
  });
});

describe("aggregate", () => {
  it("agrège plusieurs pronostics d'une méthode", () => {
    const a = aggregate([
      { selection: [1, 2, 3, 4, 5, 6], arrivee: [1, 2, 3, 4, 5], typePari: "QUINTE_PLUS", rapport: 8 }, // GAGNANT, roi +0.333, cout6 gain8
      { selection: [1, 2, 3, 4, 6, 7], arrivee: [1, 2, 3, 4, 9], typePari: "QUINTE_PLUS", rapport: 50 }, // PARTIEL, cout6 gain0
    ]);
    expect(a.n).toBe(2);
    expect(a.pctGagnant).toBe(50);
    expect(a.pctPartiel).toBe(50);
    expect(a.pctVainqueur).toBe(100);
    // ROI global = (8 - 12) / 12 = -0.333
    expect(a.roiGlobal).toBeCloseTo((8 - 12) / 12, 3);
  });

  it("renvoie des zéros sur liste vide", () => {
    const a = aggregate([]);
    expect(a.n).toBe(0);
    expect(a.roiGlobal).toBeNull();
  });
});
