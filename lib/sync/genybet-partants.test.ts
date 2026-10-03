import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  parseGenybetPartants, parseGenybetCourseIds, parseGenybetHippodrome,
  memeCourseGenybet, completerAvecGenybet,
  type CourseGenybet, type PartantACompleter,
} from "./genybet-partants";

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

// Le 03/10/2026, notre R9 (Settat, Maroc, relayée par LONACI) a reçu les musiques
// de la R9 de GenyBet, Beaumont-de-Lomagne (trot) : (date, R, C) n'identifie pas
// une course. GenyBet ne sert plus que si c'est bien la même course.
describe("parseGenybetHippodrome — l'hippodrome de la page course", () => {
  it("lit l'hippodrome dans le titre « R9 - Beaumont-de-Lomagne »", () => {
    expect(parseGenybetHippodrome('<h1 class="titre">R9 - Beaumont-de-Lomagne</h1>')).toBe("Beaumont-de-Lomagne");
  });

  it("titre découpé en balises, sur plusieurs lignes", () => {
    expect(parseGenybetHippodrome("<h1>\n  <span>R1</span> - Paris-Vincennes\n</h1>")).toBe("Paris-Vincennes");
  });

  it("pas de titre au format attendu → null (on ne devine pas)", () => {
    expect(parseGenybetHippodrome("<div>rien</div>")).toBeNull();
    expect(parseGenybetHippodrome("<h1>Pronostics du jour</h1>")).toBeNull();
  });
});

const beaumont: CourseGenybet = {
  hippodrome: "Beaumont-de-Lomagne",
  partants: [
    { numPmu: 1, nom: "Nectar de Mone", musique: "DaDa", age: 4, sexe: "H", nonPartant: false },
    { numPmu: 2, nom: "Nuage des Lucas", musique: "Da", age: 4, nonPartant: false },
    { numPmu: 3, nom: "Nikkei de Cahot", musique: "7a6aDa", age: 4, entraineur: { nom: "E. Audebert" }, nonPartant: false },
    { numPmu: 4, nom: "Nils de Cossio", musique: "9aDa8a3a", age: 4, nonPartant: false },
  ],
};
const chevauxSettat = ["BUBBLE KIDDO", "TAHER", "MELISSA ZEMMOUR", "SAMANTHA ZEMMOUR"];

describe("memeCourseGenybet — même numéro, même course ?", () => {
  it("Settat R9 n'est pas la R9 GenyBet de Beaumont-de-Lomagne", () => {
    expect(memeCourseGenybet({ hippodrome: "Settat", noms: chevauxSettat }, beaumont)).toBe(false);
  });

  it("mêmes chevaux (majuscules, sans accents) → même course", () => {
    const noms = ["NECTAR DE MONE", "NUAGE DES LUCAS", "NIKKEI DE CAHOT", "NILS DE COSSIO"];
    expect(memeCourseGenybet({ hippodrome: "Beaumont-de-Lomagne", noms }, beaumont)).toBe(true);
  });

  it("chevaux connus mais différents : le même hippodrome ne suffit pas", () => {
    expect(memeCourseGenybet({ hippodrome: "Beaumont-de-Lomagne", noms: chevauxSettat }, beaumont)).toBe(false);
  });

  it("sans partants connus en base : on juge sur l'hippodrome", () => {
    expect(memeCourseGenybet({ hippodrome: "Settat", noms: [] }, beaumont)).toBe(false);
    expect(memeCourseGenybet({ hippodrome: "Vincennes", noms: [] }, { ...beaumont, hippodrome: "Paris-Vincennes" })).toBe(true);
  });

  it("ni noms ni hippodrome GenyBet : on ne prend pas le risque", () => {
    expect(memeCourseGenybet({ hippodrome: "Vincennes", noms: [] }, { ...beaumont, hippodrome: null })).toBe(false);
  });
});

describe("completerAvecGenybet — ne complète que les mêmes chevaux de la même course", () => {
  it("cas Settat : autre course → null, aucune musique écrite", () => {
    const partants: PartantACompleter[] = chevauxSettat.map((nom, i) => ({ numPmu: i + 1, nom }));
    expect(completerAvecGenybet(partants, beaumont, "Settat")).toBeNull();
    expect(partants.every((p) => p.musique == null && p.age == null)).toBe(true);
  });

  it("même course : complète ce qui manque, sans rien écraser", () => {
    const partants: PartantACompleter[] = [
      { numPmu: 1, nom: "NECTAR DE MONE" },
      { numPmu: 2, nom: "NUAGE DES LUCAS", musique: "1a2a" },
      { numPmu: 3, nom: "NIKKEI DE CAHOT", entraineur: { nom: "Entraîneur LONACI" } },
      { numPmu: 4, nom: "NILS DE COSSIO" },
    ];
    expect(completerAvecGenybet(partants, beaumont, "Beaumont-de-Lomagne")).toBe(4);
    expect(partants[0]).toMatchObject({ musique: "DaDa", age: 4, sexe: "H" });
    expect(partants[1].musique).toBe("1a2a");
    expect(partants[2].entraineur?.nom).toBe("Entraîneur LONACI");
  });

  it("même course, mais un dossard porte un autre cheval : celui-là reste vide", () => {
    const partants: PartantACompleter[] = [
      { numPmu: 1, nom: "NECTAR DE MONE" },
      { numPmu: 2, nom: "NUAGE DES LUCAS" },
      { numPmu: 3, nom: "NIKKEI DE CAHOT" },
      { numPmu: 4, nom: "UN AUTRE CHEVAL" },
    ];
    expect(completerAvecGenybet(partants, beaumont, "Beaumont-de-Lomagne")).toBe(3);
    expect(partants[3].musique).toBeUndefined();
  });
});

describe("parseGenybetCourseIds — mapping réunion|course -> ID GenyBet", () => {
  it("mappe R1C1 des Sables vers son ID de course (= même ID PMU/Geny)", () => {
    const map = parseGenybetCourseIds(HTML_REUNION);
    expect(map.size).toBeGreaterThan(20);
    expect(map.get("1|1")).toBe(1665355);
  });
});
