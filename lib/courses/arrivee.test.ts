import { describe, it, expect } from "vitest";
import { buildArriveePodium } from "./arrivee";

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
