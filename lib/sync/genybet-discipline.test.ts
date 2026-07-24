import { describe, it, expect } from "vitest";
import { computeDisciplineUpdates } from "./genybet-discipline";
import { canonicalHippodrome } from "./hippodrome-canonical";

/**
 * Overlay discipline GenyBet : rapproche les courses parsées chez GenyBet
 * (qui expose la vraie discipline via `icon-race`) des courses EXISTANTES en
 * base et calcule les UPDATE de `courses.categorie` — matching par
 * (hippodrome canonique, réunion, course), même clé que lonaci-enrich.
 * PUR (aucun accès BDD) → testable en isolation. Anti-fabrication : une course
 * non retrouvée en base n'est jamais inventée (compteur unmatched).
 */
describe("computeDisciplineUpdates", () => {
  const hippoCanonMap = new Map<string, string>([
    [canonicalHippodrome("Cabourg"), "hip-cabourg"],
    [canonicalHippodrome("Cagnes-sur-Mer"), "hip-cagnes"],
    [canonicalHippodrome("Le Lion-d'Angers"), "hip-lion"],
  ]);

  it("corrige une course de trot stockée en PLAT", () => {
    const res = computeDisciplineUpdates({
      parsedCourses: [
        { hippodrome: "Cabourg", nReunion: 1, numeroCourse: 3, categorie: "TROT" },
      ],
      dbCourses: [
        { id: "c1", hippodrome_id: "hip-cabourg", numero_reunion: 1, numero_course: 3, categorie: "PLAT" },
      ],
      hippoCanonMap,
    });
    expect(res.updates).toEqual([{ id: "c1", categorie: "TROT" }]);
    expect(res.report.matched).toBe(1);
    expect(res.report.updated).toBe(1);
    expect(res.report.unchanged).toBe(0);
  });

  it("ne touche pas une course déjà correcte", () => {
    const res = computeDisciplineUpdates({
      parsedCourses: [
        { hippodrome: "Cabourg", nReunion: 1, numeroCourse: 3, categorie: "PLAT" },
      ],
      dbCourses: [
        { id: "c1", hippodrome_id: "hip-cabourg", numero_reunion: 1, numero_course: 3, categorie: "PLAT" },
      ],
      hippoCanonMap,
    });
    expect(res.updates).toEqual([]);
    expect(res.report.matched).toBe(1);
    expect(res.report.updated).toBe(0);
    expect(res.report.unchanged).toBe(1);
  });

  it("ignore une course dont l'hippodrome est inconnu en base (pas de fabrication)", () => {
    const res = computeDisciplineUpdates({
      parsedCourses: [
        { hippodrome: "Deauville-Clairefontaine", nReunion: 2, numeroCourse: 1, categorie: "OBSTACLE" },
      ],
      dbCourses: [
        { id: "c1", hippodrome_id: "hip-cabourg", numero_reunion: 1, numero_course: 3, categorie: "PLAT" },
      ],
      hippoCanonMap,
    });
    expect(res.updates).toEqual([]);
    expect(res.report.unmatched_hippodrome).toBe(1);
    expect(res.report.matched).toBe(0);
  });

  it("ignore une course sans correspondance réunion/course en base", () => {
    const res = computeDisciplineUpdates({
      parsedCourses: [
        { hippodrome: "Cabourg", nReunion: 9, numeroCourse: 9, categorie: "TROT" },
      ],
      dbCourses: [
        { id: "c1", hippodrome_id: "hip-cabourg", numero_reunion: 1, numero_course: 3, categorie: "PLAT" },
      ],
      hippoCanonMap,
    });
    expect(res.updates).toEqual([]);
    expect(res.report.unmatched_course).toBe(1);
    expect(res.report.matched).toBe(0);
  });

  it("matche malgré accents et entités HTML (canonicalHippodrome)", () => {
    // Base = nom entité HTML (« Le Lion-d&#039;Angers »), GenyBet = apostrophe décodée.
    const res = computeDisciplineUpdates({
      parsedCourses: [
        { hippodrome: "Le Lion-d'Angers", nReunion: 3, numeroCourse: 4, categorie: "OBSTACLE" },
        { hippodrome: "Cagnes-sur-mer", nReunion: 1, numeroCourse: 1, categorie: "TROT" },
      ],
      dbCourses: [
        { id: "lion4", hippodrome_id: "hip-lion", numero_reunion: 3, numero_course: 4, categorie: "PLAT" },
        { id: "cag1", hippodrome_id: "hip-cagnes", numero_reunion: 1, numero_course: 1, categorie: "PLAT" },
      ],
      hippoCanonMap,
    });
    expect(res.updates).toEqual([
      { id: "lion4", categorie: "OBSTACLE" },
      { id: "cag1", categorie: "TROT" },
    ]);
    expect(res.report.updated).toBe(2);
  });
});
