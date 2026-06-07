import { describe, expect, it } from "vitest";
import {
  normHippodrome,
  isHippodromePrioritaire,
  isHippodromeEtranger,
  hasPariNational,
  isCourseEligible,
} from "./course-eligibility";

describe("normHippodrome", () => {
  it("normalise accents / casse / tirets / espaces", () => {
    expect(normHippodrome("Marseille-Borély")).toBe("marseilleborely");
    expect(normHippodrome("Cagnes-sur-Mer")).toBe("cagnessurmer");
    expect(normHippodrome("ParisLongchamp")).toBe("parislongchamp");
    expect(normHippodrome("Le Croisé-Laroche")).toBe("lecroiselaroche");
    expect(normHippodrome(null)).toBe("");
    expect(normHippodrome(undefined)).toBe("");
  });
});

describe("isHippodromePrioritaire", () => {
  it("inclut les vedettes FR, robuste aux variations d'écriture", () => {
    expect(isHippodromePrioritaire("Vincennes")).toBe(true);
    expect(isHippodromePrioritaire("ParisLongchamp")).toBe(true);
    expect(isHippodromePrioritaire("marseille borely")).toBe(true);
    expect(isHippodromePrioritaire("Cagnes-sur-Mer")).toBe(true);
    expect(isHippodromePrioritaire("Bordeaux-Le Bouscat")).toBe(true);
  });
  it("exclut l'étranger et les petits locaux", () => {
    expect(isHippodromePrioritaire("Sha Tin")).toBe(false);
    expect(isHippodromePrioritaire("Happy Valley")).toBe(false);
    expect(isHippodromePrioritaire("Concepcion")).toBe(false);
    expect(isHippodromePrioritaire("Churchill Downs")).toBe(false);
    expect(isHippodromePrioritaire("Hyères")).toBe(false);
    expect(isHippodromePrioritaire(null)).toBe(false);
  });
});

describe("isHippodromeEtranger", () => {
  it("repère les hippodromes étrangers connus", () => {
    expect(isHippodromeEtranger("Sha Tin")).toBe(true);
    expect(isHippodromeEtranger("Happy Valley")).toBe(true);
    expect(isHippodromeEtranger("Churchill Downs")).toBe(true);
    expect(isHippodromeEtranger("Curragh")).toBe(true);
    expect(isHippodromeEtranger("Vincennes")).toBe(false);
    expect(isHippodromeEtranger("Bollène")).toBe(false);
  });
});

describe("hasPariNational", () => {
  it("détecte Quinté+ / Quarté+ / Tiercé", () => {
    expect(hasPariNational(["COUPLE", "QUINTE_PLUS"])).toBe(true);
    expect(hasPariNational(["TIERCE"])).toBe(true);
    expect(hasPariNational(["COUPLE_GAGNANT", "TRIO"])).toBe(false);
    expect(hasPariNational(null)).toBe(false);
  });
});

describe("isCourseEligible", () => {
  it("vedette + > 10 partants → gardée", () => {
    expect(isCourseEligible({ hippodromeNom: "Vincennes", nbPartants: 14 })).toBe(true);
    expect(isCourseEligible({ hippodromeNom: "ParisLongchamp", nbPartants: 16 })).toBe(true);
  });
  it("vedette mais ≤ 10 partants → exclue", () => {
    expect(isCourseEligible({ hippodromeNom: "Vincennes", nbPartants: 10 })).toBe(false);
    expect(isCourseEligible({ hippodromeNom: "Vincennes", nbPartants: 9 })).toBe(false);
  });
  it("petit local FR sans pari national → exclu", () => {
    expect(isCourseEligible({ hippodromeNom: "Bollène", nbPartants: 14 })).toBe(false);
  });
  it("pari national sur piste FR provinciale → gardée (grande course du jour)", () => {
    expect(isCourseEligible({ hippodromeNom: "Bollène", nbPartants: 14, aPariNational: true })).toBe(true);
  });
  it("étranger exclu même avec pari national ou > 10 partants", () => {
    expect(isCourseEligible({ hippodromeNom: "Sha Tin", nbPartants: 14 })).toBe(false);
    expect(isCourseEligible({ hippodromeNom: "Sha Tin", nbPartants: 14, aPariNational: true })).toBe(false);
    expect(isCourseEligible({ hippodromeNom: "Happy Valley", nbPartants: 12 })).toBe(false);
  });
  it("garde-fou : course AVEC pronostic → toujours gardée", () => {
    expect(isCourseEligible({ hippodromeNom: "Sha Tin", nbPartants: 5, aPronostic: true })).toBe(true);
    expect(isCourseEligible({ hippodromeNom: "Hyères", nbPartants: 6, aPronostic: true })).toBe(true);
  });
});
