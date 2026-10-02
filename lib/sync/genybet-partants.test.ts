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

// Les tableaux TROT et OBSTACLE n'ont pas les colonnes du plat. Lus par position
// jusqu'au 02/10/2026 : l'entraîneur partait en « jockey », les gains (ou la
// valeur) en « entraîneur », et la cote de référence en « musique ».
describe("parseGenybetPartants — colonnes lues par leur en-tête (trot, obstacle)", () => {
  it("trot (Vincennes R1C8, 02/10/2026) : driver, entraîneur, vraie musique", () => {
    const p1 = parseGenybetPartants(loadFixture("genybet-course-trot-sample.html")).find((p) => p.numPmu === 1)!;
    expect(p1.nom).toBe("Impérial Marandais");      // sans les icônes (□□)
    expect(p1.jockey?.nom).toBe("F. Touchard");      // colonne « Driver »
    expect(p1.entraineur?.nom).toBe("L. Barassin");  // et non les gains « 143 570 »
    expect(p1.musique).toBe("7a7a9a0a");             // et non la cote de référence « 29 »
    expect(p1.sexe).toBe("H");
    expect(p1.age).toBe(8);
    expect(p1.poids).toBeUndefined();
    expect(p1.placeCorde).toBeUndefined();
  });

  it("obstacle (Dax R2C1, 02/10/2026) : jockey, entraîneur, poids, vraie musique", () => {
    const p1 = parseGenybetPartants(loadFixture("genybet-course-obstacle-sample.html")).find((p) => p.numPmu === 1)!;
    expect(p1.nom).toBe("Avaya");
    expect(p1.jockey?.nom).toBe("L. Zuliani");
    expect(p1.entraineur?.nom).toBe("H&G. Lageneste & Macaire");
    expect(p1.musique).toBe("0h1h");                 // et non la cote de référence « 2.8 »
    expect(p1.poids).toBe(67);
    expect(p1.sexe).toBe("F");
    expect(p1.age).toBe(3);
  });

  it("jamais un simple nombre en musique, jamais un nombre en jockey ou entraîneur", () => {
    for (const fixture of ["genybet-course-trot-sample.html", "genybet-course-obstacle-sample.html", "genybet-course-sample.html"]) {
      for (const p of parseGenybetPartants(loadFixture(fixture))) {
        if (p.musique) expect(p.musique).toMatch(/[0-9DATR][a-z]|^Inédit$/);
        if (p.jockey) expect(p.jockey.nom).toMatch(/[A-Za-z]/);
        if (p.entraineur) expect(p.entraineur.nom).toMatch(/[A-Za-z]/);
        expect(p.nom).not.toMatch(/[-]/);
      }
    }
  });
});

describe("parseGenybetCourseIds — mapping réunion|course -> ID GenyBet", () => {
  it("mappe R1C1 des Sables vers son ID de course (= même ID PMU/Geny)", () => {
    const map = parseGenybetCourseIds(HTML_REUNION);
    expect(map.size).toBeGreaterThan(20);
    expect(map.get("1|1")).toBe(1665355);
  });
});
