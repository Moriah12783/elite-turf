import { describe, it, expect } from "vitest";
import { buildArriveePodium, estPlace } from "./arrivee";

describe("buildArriveePodium", () => {
  const partants = [
    { numero: 4, nom_cheval: "Imperator d'Em" },
    { numero: 2, nom_cheval: "Goldy Smile" },
    { numero: 5, nom_cheval: "High Tech Roc" },
  ];
  it("classe les places 1..N et mappe les noms", () => {
    expect(buildArriveePodium([4, 2, 5], partants)).toEqual([
      { rank: 1, numero: 4, nom: "Imperator d'Em" },
      { rank: 2, numero: 2, nom: "Goldy Smile" },
      { rank: 3, numero: 5, nom: "High Tech Roc" },
    ]);
  });
  it("nom null si partant absent ou nom manquant", () => {
    expect(buildArriveePodium([9], partants)[0].nom).toBeNull();
    expect(buildArriveePodium([7], [{ numero: 7 }])[0].nom).toBeNull();
  });
  it("arrivée vide ou null → []", () => {
    expect(buildArriveePodium([], partants)).toEqual([]);
    expect(buildArriveePodium(null, partants)).toEqual([]);
  });
});

describe("estPlace — « placé » = dans les 3 premiers de l'arrivée", () => {
  // Arrivée RÉELLE du Quinté+ du 06/10/2026 : 7 chevaux enregistrés.
  const ARRIVEE_06_10 = [8, 2, 7, 3, 15, 12, 9];

  it("les 3 premiers sont placés", () => {
    expect(estPlace(8, ARRIVEE_06_10)).toBe(true);
    expect(estPlace(2, ARRIVEE_06_10)).toBe(true);
    expect(estPlace(7, ARRIVEE_06_10)).toBe(true);
  });

  it("4e à 7e : dans l'arrivée enregistrée, mais PAS placés (décision du 06/10/2026)", () => {
    expect(estPlace(3, ARRIVEE_06_10)).toBe(false);
    expect(estPlace(15, ARRIVEE_06_10)).toBe(false);
    expect(estPlace(12, ARRIVEE_06_10)).toBe(false);
    expect(estPlace(9, ARRIVEE_06_10)).toBe(false);
  });

  it("cheval absent de l'arrivée, ou arrivée inconnue → non placé", () => {
    expect(estPlace(4, ARRIVEE_06_10)).toBe(false);
    expect(estPlace(8, [])).toBe(false);
    expect(estPlace(8, null)).toBe(false);
    expect(estPlace(8, undefined)).toBe(false);
  });
});
