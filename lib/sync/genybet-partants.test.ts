import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseGenybetPartants, parseGenybetCourseIds } from "./genybet-partants";

function loadFixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");
}

const HTML_COURSE  = loadFixture("genybet-course-sample.html");    // /courses/partants-pronostics/1665422
const HTML_REUNION = loadFixture("genybet-reunions-sample.html");  // 06-07-2026

describe("parseGenybetPartants — champs de forme (SANS cote, JS chez GenyBet)", () => {
  const partants = parseGenybetPartants(HTML_COURSE);

  it("ramène tous les partants avec numéro + nom", () => {
    expect(partants.length).toBe(6);
    expect(partants.every((p) => Number.isInteger(p.numPmu) && p.nom.length > 0)).toBe(true);
  });

  it("parse le 1er partant : forme complète (corde, sexe/âge, poids, jockey, entraîneur, musique)", () => {
    const p1 = partants.find((p) => p.numPmu === 1)!;
    expect(p1.nom).toBe("Master Man");
    expect(p1.placeCorde).toBe(6);
    expect(p1.sexe).toBe("M");
    expect(p1.age).toBe(2);
    expect(p1.poids).toBe(57);
    expect(p1.jockey?.nom).toBe("A. Crastus");
    expect(p1.entraineur?.nom).toBe("R. Chotard (G)");
    expect(p1.musique).toBe("1p");
    expect(p1.nonPartant).toBe(false);
  });

  it("HTML vide -> [] sans throw", () => {
    expect(parseGenybetPartants("")).toEqual([]);
  });
});

describe("parseGenybetCourseIds — mapping réunion|course -> ID GenyBet", () => {
  it("mappe R1C1 des Sables vers son ID de course (= même ID PMU/Geny)", () => {
    const map = parseGenybetCourseIds(HTML_REUNION);
    expect(map.size).toBeGreaterThan(20);
    expect(map.get("1|1")).toBe(1665355);
  });
});
