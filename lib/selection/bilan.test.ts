import { describe, it, expect } from "vitest";
import { calculerBilan, type LigneBilan } from "./bilan";

const marche12: Record<string, number> = {
  "1": 2.5, "2": 3, "3": 4, "4": 5, "5": 7, "6": 9, "7": 11, "8": 14, "9": 18, "10": 22, "11": 30, "12": 45,
};

const courseA: LigneBilan = {
  numeros: [1, 2, 3, 4, 5, 6, 7, 8], nbPartants: 10, cotesMarche: {}, arrivee: [3, 9, 1, 2, 4],
};
const courseB: LigneBilan = {
  numeros: [2, 4, 6, 8, 10, 12, 1, 3], nbPartants: 12, cotesMarche: marche12, arrivee: [4, 2, 6, 1, 3],
  pronoPayant: [12, 10, 8, 6, 4, 2],
};

describe("calculerBilan — sélection photographiée avant le départ", () => {
  const b = calculerBilan([courseA, courseB]);

  it("compte gagnant, 3 premiers et 5 premiers dans la sélection", () => {
    expect(b.courses).toBe(2);
    expect(b.selection.gagnant).toBeCloseTo(1);
    expect(b.selection.troisPremiers).toBeCloseTo(0.5);
    expect(b.selection.cinqPremiers).toBeCloseTo(0.5);
  });

  it("compare au hasard avec le même nombre de chevaux", () => {
    expect(b.hasard.gagnant).toBeCloseTo((8 / 10 + 8 / 12) / 2);
    expect(b.hasard.troisPremiers).toBeCloseTo((336 / 720 + 336 / 1320) / 2);
    expect(b.hasard.cinqPremiers).toBeCloseTo((6720 / 30240 + 6720 / 95040) / 2);
  });

  it("payant contre marché de la même heure, à nombre de chevaux égal", () => {
    expect(b.payant.courses).toBe(1);
    expect(b.payant.prono).toMatchObject({ gagnant: 1, troisPremiers: 1, cinqPremiers: 0 });
    expect(b.payant.marche).toMatchObject({ gagnant: 1, troisPremiers: 1, cinqPremiers: 1 });
  });

  it("aucune course → zéros, pas de division par zéro", () => {
    const vide = calculerBilan([]);
    expect(vide.courses).toBe(0);
    expect(vide.selection.gagnant).toBe(0);
    expect(vide.payant.courses).toBe(0);
  });

  it("arrivée de moins de 5 chevaux : le « 5 premiers » n'est pas compté", () => {
    const court = calculerBilan([{ ...courseA, arrivee: [3, 1, 2] }]);
    expect(court.selection.nCinq).toBe(0);
    expect(court.selection.troisPremiers).toBe(1);
  });
});
