import { describe, it, expect } from "vitest";
import { composerArgon, confianceArgon } from "./composition-argon";

// Prix Thémis du 16/10/2026 : édition T-90 scellée d'Argon.
const ARGON8 = [3, 6, 12, 13, 7, 4, 11, 14];
const TOUS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
// Avantages relevés le 16/10/2026 (après la course).
const AV: Record<number, number | null> = { 3: 6.5, 6: -0.1, 12: -0.7, 13: -0.4, 7: -1.3, 4: -1.4, 11: 0.3, 14: -0.3 };

function composition(partants: number[], avantage: Record<number, number | null>) {
  const r = composerArgon(ARGON8, partants, avantage);
  if (!r.ok) throw new Error(r.raison);
  return r.composition;
}

describe("composerArgon", () => {
  it("exemple réel du Prix Thémis : Pro 3-6-12-13 + 7-4 ; Elite values 11-14, associés 7-4", () => {
    expect(composerArgon(ARGON8, TOUS, AV)).toEqual({
      ok: true,
      composition: { pivot: 3, bases: [3, 6, 12, 13], valuesPro: [7, 4], valuesElite: [11, 14], associes: [7, 4], nonPartants: [] },
    });
  });

  it("3 avantages positifs ou plus : 3 values, 1 associé (values dans l'ordre d'Argon)", () => {
    const c = composition(TOUS, { ...AV, 7: 0.5, 4: 2, 11: 1 });
    expect([c.valuesElite, c.associes]).toEqual([[7, 4, 11], [14]]);
  });

  it("4 avantages positifs : toujours 3 values au plus", () => {
    const c = composition(TOUS, { ...AV, 7: 0.5, 4: 2, 11: 1, 14: 0.2 });
    expect([c.valuesElite, c.associes]).toEqual([[7, 4, 11], [14]]);
  });

  it("égalité d'avantage : l'ordre d'Argon départage", () => {
    const c = composition(TOUS, { ...AV, 7: 1, 4: 1, 11: -2, 14: -2 });
    expect([c.valuesElite, c.associes]).toEqual([[7, 4], [11, 14]]);
  });

  it("avantage absent (null) : traité comme le plus faible", () => {
    const c = composition(TOUS, { ...AV, 7: null, 4: null, 11: -5, 14: -6 });
    expect([c.valuesElite, c.associes]).toEqual([[11, 14], [7, 4]]);
  });

  it("cheval sans avantage connu (clé absente) : traité comme null", () => {
    const { 11: _onze, ...sansOnze } = AV;
    const c = composition(TOUS, sansOnze);
    expect([c.valuesElite, c.associes]).toEqual([[7, 14], [4, 11]]);
  });

  it("un non-partant parmi les bases (n°6) : les suivants remontent, Elite à 7 chevaux", () => {
    expect(composition(TOUS.filter((n) => n !== 6), AV)).toEqual({
      pivot: 3, bases: [3, 12, 13, 7], valuesPro: [4, 11], valuesElite: [11, 14], associes: [4], nonPartants: [6],
    });
  });

  it("deux non-partants : Elite à 6 chevaux, 2 values, aucun associé", () => {
    const c = composition(TOUS.filter((n) => n !== 6 && n !== 7), AV);
    expect(c).toEqual({
      pivot: 3, bases: [3, 12, 13, 4], valuesPro: [11, 14], valuesElite: [11, 14], associes: [], nonPartants: [6, 7],
    });
  });

  it("trois non-partants : moins de 6 partants → argon_partants_insuffisants", () => {
    expect(composerArgon(ARGON8, TOUS.filter((n) => [6, 7, 4].indexOf(n) === -1), AV))
      .toEqual({ ok: false, raison: "argon_partants_insuffisants" });
  });
});

describe("confianceArgon", () => {
  it("5 et 4 étoiles → ELEVE, 3 → MOYEN, 2 et 1 → FAIBLE", () => {
    expect([5, 4, 3, 2, 1].map(confianceArgon)).toEqual(["ELEVE", "ELEVE", "MOYEN", "FAIBLE", "FAIBLE"]);
  });
});
