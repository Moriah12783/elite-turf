import { describe, it, expect } from "vitest";
import { estMusique, parseMusique } from "./musique";

describe("estMusique — une musique, jamais un simple nombre", () => {
  it("accepte les vraies musiques et « Inédit »", () => {
    expect(estMusique("7a7a9a0a")).toBe(true);
    expect(estMusique("0h1h")).toBe(true);
    expect(estMusique("Dm0aDaDa")).toBe(true);
    expect(estMusique("5p1p1p(25)1p")).toBe(true);
    expect(estMusique("Inédit")).toBe(true);
  });
  it("refuse les nombres (cote de référence, gains, valeur) et le vide", () => {
    for (const t of ["29", "4.6", "135", "143 570", "52,5", "", null, undefined]) expect(estMusique(t)).toBe(false);
  });
});

describe("parseMusique — part de podiums dans la musique", () => {
  it("compte chaque course, podium ou non", () => {
    expect(parseMusique("1p6p7p5p")).toEqual({ top3: 1, courses: 4, ratio: 0.25 });
    expect(parseMusique("9p2p3p2p")).toEqual({ top3: 3, courses: 4, ratio: 0.75 });
  });

  it("disqualifications et « 0 » (au-delà du 9e) sont des courses hors podium", () => {
    // Avant le 02/10/2026, lu comme 100 % de podiums (seuls les chiffres 1 à 99 comptaient).
    expect(parseMusique("1mDaDa0a")).toEqual({ top3: 1, courses: 4, ratio: 0.25 });
    expect(parseMusique("Dm1mDmDm")!.ratio).toBe(0.25);
  });

  it("ignore les années « (25) »", () => {
    expect(parseMusique("1a2a(25)3a0a")).toEqual({ top3: 3, courses: 4, ratio: 0.75 });
  });

  it("rien d'exploitable → null", () => {
    expect(parseMusique("Inédit")).toBeNull();
    expect(parseMusique("In&eacute;dit")).toBeNull();
    expect(parseMusique("107")).toBeNull();
    expect(parseMusique("")).toBeNull();
    expect(parseMusique(null)).toBeNull();
  });
});
