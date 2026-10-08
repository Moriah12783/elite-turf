import { describe, it, expect } from "vitest";
import { evaluateBaseVsArrivee, buildScoreboard } from "./selection-result";

describe("evaluateBaseVsArrivee", () => {
  it("base gagnante (1ʳᵉ)", () => {
    expect(evaluateBaseVsArrivee([7, 3], [7, 1, 9])).toEqual({
      base: 7,
      gagnant: true,
      place: true,
    });
  });
  it("base placée (top 3) mais pas 1ʳᵉ", () => {
    expect(evaluateBaseVsArrivee([3], [7, 3, 9])).toEqual({
      base: 3,
      gagnant: false,
      place: true,
    });
  });
  it("base ni gagnante ni placée", () => {
    expect(evaluateBaseVsArrivee([5], [7, 3, 9, 5])).toEqual({
      base: 5,
      gagnant: false,
      place: false,
    });
  });
  it("sélection vide ou arrivée vide → rien", () => {
    expect(evaluateBaseVsArrivee([], [7, 3])).toEqual({ base: null, gagnant: false, place: false });
    expect(evaluateBaseVsArrivee([7], [])).toEqual({ base: 7, gagnant: false, place: false });
    expect(evaluateBaseVsArrivee(null, null)).toEqual({ base: null, gagnant: false, place: false });
  });

  it("dead heat pour la victoire : les deux ex æquo sont gagnants (Deauville, 30/08/2026)", () => {
    // PMU : 4 et 11 ex æquo 1ers, puis 8, 9, 7 et 16 ex æquo 5es.
    const arrivee = [4, 11, 8, 9, 7, 16, 12];
    const rangs = [1, 1, 3, 4, 5, 5, 7];
    expect(evaluateBaseVsArrivee([11, 4], arrivee, rangs)).toEqual({ base: 11, gagnant: true, place: true });
    expect(evaluateBaseVsArrivee([11, 4], arrivee)).toEqual({ base: 11, gagnant: false, place: true });
  });

  it("un 3e ex æquo est placé (Prix de la Ville de Paris, 21/05/2026)", () => {
    expect(evaluateBaseVsArrivee([6], [4, 11, 3, 6, 15, 5], [1, 2, 3, 3, 5, 6])).toEqual({ base: 6, gagnant: false, place: true });
  });
});

describe("buildScoreboard", () => {
  it("agrège joués / gagnants / placés", () => {
    expect(
      buildScoreboard([
        { base: 1, gagnant: true, place: true },
        { base: 2, gagnant: false, place: true },
        { base: 3, gagnant: false, place: false },
      ]),
    ).toEqual({ joues: 3, gagnants: 1, places: 2 });
  });
  it("aucune course → zéros", () => {
    expect(buildScoreboard([])).toEqual({ joues: 0, gagnants: 0, places: 0 });
  });
});
