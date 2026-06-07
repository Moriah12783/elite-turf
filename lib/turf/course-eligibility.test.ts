import { describe, expect, it } from "vitest";
import {
  normHippodrome,
  isHippodromeLointain,
  hasPariNational,
  isCourseEligible,
  isCourseVedette,
} from "./course-eligibility";

describe("normHippodrome", () => {
  it("normalise accents / casse / tirets / espaces", () => {
    expect(normHippodrome("Marseille-Borély")).toBe("marseilleborely");
    expect(normHippodrome("Cagnes-sur-Mer")).toBe("cagnessurmer");
    expect(normHippodrome("ParisLongchamp")).toBe("parislongchamp");
    expect(normHippodrome("Le Croisé-Laroche")).toBe("lecroiselaroche");
    expect(normHippodrome(null)).toBe("");
  });
});

describe("isHippodromeLointain", () => {
  it("exclut le lointain (Asie / Amériques / Océanie / Afrique du Sud)", () => {
    expect(isHippodromeLointain("Sha Tin")).toBe(true);        // Hong Kong
    expect(isHippodromeLointain("Happy Valley")).toBe(true);   // Hong Kong
    expect(isHippodromeLointain("Concepcion")).toBe(true);     // Chili
    expect(isHippodromeLointain("Churchill Downs")).toBe(true); // USA
    expect(isHippodromeLointain("Kalgoorlie")).toBe(true);     // Australie
    expect(isHippodromeLointain("Greyville")).toBe(true);      // Afrique du Sud
  });
  it("GARDE l'Europe, le Maghreb et la France", () => {
    expect(isHippodromeLointain("Curragh")).toBe(false);       // Irlande
    expect(isHippodromeLointain("Newmarket")).toBe(false);     // Angleterre
    expect(isHippodromeLointain("Wolvega")).toBe(false);       // Pays-Bas
    expect(isHippodromeLointain("Casablanca")).toBe(false);    // Maroc
    expect(isHippodromeLointain("Bollène")).toBe(false);       // France provinciale
    expect(isHippodromeLointain("Vincennes")).toBe(false);     // France vedette
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

describe("isCourseEligible (on n'exclut QUE le lointain)", () => {
  it("garde France, Europe, Maghreb", () => {
    expect(isCourseEligible({ hippodromeNom: "Bollène" })).toBe(true);      // FR provinciale
    expect(isCourseEligible({ hippodromeNom: "Vincennes" })).toBe(true);    // FR vedette
    expect(isCourseEligible({ hippodromeNom: "Curragh" })).toBe(true);      // Europe
    expect(isCourseEligible({ hippodromeNom: "Casablanca" })).toBe(true);   // Maghreb
  });
  it("exclut le lointain étranger", () => {
    expect(isCourseEligible({ hippodromeNom: "Sha Tin" })).toBe(false);
    expect(isCourseEligible({ hippodromeNom: "Concepcion" })).toBe(false);
  });
  it("garde-fou : course AVEC pronostic → gardée même si lointaine", () => {
    expect(isCourseEligible({ hippodromeNom: "Sha Tin", aPronostic: true })).toBe(true);
  });
});

describe("isCourseVedette (mise en avant, pas un filtre)", () => {
  it("hippodrome vedette OU pari national", () => {
    expect(isCourseVedette({ hippodromeNom: "ParisLongchamp" })).toBe(true);
    expect(isCourseVedette({ hippodromeNom: "Bollène", aPariNational: true })).toBe(true); // Quinté+ provincial
    expect(isCourseVedette({ hippodromeNom: "Bollène" })).toBe(false);
    expect(isCourseVedette({ hippodromeNom: "Eauze" })).toBe(false);
  });
});
