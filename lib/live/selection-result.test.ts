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
