import { describe, it, expect } from "vitest";
import { computeDistanceUpdates } from "./pmu-distance";
import { canonicalHippodrome } from "./hippodrome-canonical";

/**
 * Overlay distance PMU : rapproche les courses du programme PMU (qui expose la
 * vraie distance en mètres) des courses EXISTANTES en base et calcule les
 * UPDATE de `courses.distance_metres` — matching par (hippodrome canonique,
 * réunion, course). PUR (aucun accès BDD) → testable en isolation.
 *
 * Anti-fabrication : on n'écrit JAMAIS une distance qu'on n'a pas. Une course
 * absente de PMU, ou présente mais sans distance exploitable (0), est laissée
 * strictement telle quelle.
 */
describe("computeDistanceUpdates", () => {
  const hippoCanonMap = new Map<string, string>([
    [canonicalHippodrome("Enghien"), "hip-enghien"],
    [canonicalHippodrome("Cagnes-sur-Mer"), "hip-cagnes"],
  ]);

  it("corrige une distance à 0 avec la vraie valeur PMU", () => {
    const res = computeDistanceUpdates({
      parsedCourses: [
        { hippodrome: "ENGHIEN", nReunion: 1, numeroCourse: 1, distanceMetres: 2875 },
      ],
      dbCourses: [
        { id: "c1", hippodrome_id: "hip-enghien", numero_reunion: 1, numero_course: 1, distance_metres: 0 },
      ],
      hippoCanonMap,
    });
    expect(res.updates).toEqual([{ id: "c1", distance_metres: 2875 }]);
    expect(res.report.matched).toBe(1);
    expect(res.report.updated).toBe(1);
  });

  it("ne touche pas une distance déjà correcte", () => {
    const res = computeDistanceUpdates({
      parsedCourses: [
        { hippodrome: "ENGHIEN", nReunion: 1, numeroCourse: 1, distanceMetres: 2875 },
      ],
      dbCourses: [
        { id: "c1", hippodrome_id: "hip-enghien", numero_reunion: 1, numero_course: 1, distance_metres: 2875 },
      ],
      hippoCanonMap,
    });
    expect(res.updates).toEqual([]);
    expect(res.report.unchanged).toBe(1);
    expect(res.report.updated).toBe(0);
  });

  it("n'écrase JAMAIS avec un 0 quand PMU ne fournit pas la distance", () => {
    const res = computeDistanceUpdates({
      parsedCourses: [
        // PMU matche la course mais n'a pas de distance exploitable.
        { hippodrome: "ENGHIEN", nReunion: 1, numeroCourse: 1, distanceMetres: 0 },
        { hippodrome: "Cagnes-sur-Mer", nReunion: 2, numeroCourse: 1, distanceMetres: 0 },
      ],
      dbCourses: [
        { id: "c1", hippodrome_id: "hip-enghien", numero_reunion: 1, numero_course: 1, distance_metres: 2400 },
        { id: "c2", hippodrome_id: "hip-cagnes", numero_reunion: 2, numero_course: 1, distance_metres: 0 },
      ],
      hippoCanonMap,
    });
    // c1 garde sa vraie valeur, c2 reste à 0 : aucune écriture.
    expect(res.updates).toEqual([]);
    expect(res.report.source_sans_distance).toBe(2);
    expect(res.report.updated).toBe(0);
  });

  it("ignore une course dont l'hippodrome est inconnu en base (pas de fabrication)", () => {
    const res = computeDistanceUpdates({
      parsedCourses: [
        { hippodrome: "SAN SEBASTIAN", nReunion: 2, numeroCourse: 1, distanceMetres: 2200 },
      ],
      dbCourses: [
        { id: "c1", hippodrome_id: "hip-enghien", numero_reunion: 1, numero_course: 1, distance_metres: 0 },
      ],
      hippoCanonMap,
    });
    expect(res.updates).toEqual([]);
    expect(res.report.unmatched_hippodrome).toBe(1);
  });

  it("ignore une course sans correspondance réunion/course en base", () => {
    const res = computeDistanceUpdates({
      parsedCourses: [
        { hippodrome: "ENGHIEN", nReunion: 9, numeroCourse: 9, distanceMetres: 2100 },
      ],
      dbCourses: [
        { id: "c1", hippodrome_id: "hip-enghien", numero_reunion: 1, numero_course: 1, distance_metres: 0 },
      ],
      hippoCanonMap,
    });
    expect(res.updates).toEqual([]);
    expect(res.report.unmatched_course).toBe(1);
  });

  it("rejette une distance aberrante plutôt que d'écrire une valeur douteuse", () => {
    const res = computeDistanceUpdates({
      parsedCourses: [
        { hippodrome: "ENGHIEN", nReunion: 1, numeroCourse: 1, distanceMetres: 99999 },
        { hippodrome: "Cagnes-sur-Mer", nReunion: 2, numeroCourse: 1, distanceMetres: 50 },
      ],
      dbCourses: [
        { id: "c1", hippodrome_id: "hip-enghien", numero_reunion: 1, numero_course: 1, distance_metres: 0 },
        { id: "c2", hippodrome_id: "hip-cagnes", numero_reunion: 2, numero_course: 1, distance_metres: 0 },
      ],
      hippoCanonMap,
    });
    expect(res.updates).toEqual([]);
    expect(res.report.rejected_aberrant).toBe(2);
  });
});
