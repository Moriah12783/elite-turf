import { describe, it, expect } from "vitest";
import { normalizeHippo, parseReunionCourse, findBestCourseMatch, type CourseLite } from "./matcher";

describe("normalizeHippo", () => {
  it("minuscule, sans accents, compacté", () => {
    expect(normalizeHippo("VINCENNES")).toBe("vincennes");
    expect(normalizeHippo("Hippodrome de Vincennes ")).toBe("hippodrome de vincennes");
    expect(normalizeHippo("Cagnes-sur-Mer")).toBe("cagnes sur mer");
    expect(normalizeHippo("DÉAUVILLE")).toBe("deauville");
    expect(normalizeHippo(null)).toBe("");
  });
});

describe("parseReunionCourse", () => {
  it("extrait R et C", () => {
    expect(parseReunionCourse("R1C3")).toEqual({ reunion: 1, course: 3 });
    expect(parseReunionCourse("r2 c5 - Prix X")).toEqual({ reunion: 2, course: 5 });
    expect(parseReunionCourse("Prix de Paris")).toEqual({ reunion: null, course: null });
  });
});

describe("findBestCourseMatch", () => {
  const courses: CourseLite[] = [
    { id: "a", hippodrome: "Vincennes", numero_reunion: 1, numero_course: 4 },
    { id: "b", hippodrome: "Deauville", numero_reunion: 2, numero_course: 1 },
    { id: "c", hippodrome: "Vincennes", numero_reunion: 1, numero_course: 6 },
  ];

  it("match hippodrome exact unique", () => {
    const r = findBestCourseMatch({ hippodrome: "Deauville" }, courses);
    expect(r?.courseId).toBe("b");
  });

  it("départage par R/C quand l'hippodrome est ambigu", () => {
    const r = findBestCourseMatch({ hippodrome: "VINCENNES", reunion: 1, course: 6 }, courses);
    expect(r?.courseId).toBe("c");
    expect(r!.confidence).toBeGreaterThanOrEqual(50);
  });

  it("match partiel (sous-chaîne)", () => {
    const r = findBestCourseMatch({ hippodrome: "Hippodrome de Deauville" }, courses);
    expect(r?.courseId).toBe("b");
  });

  it("renvoie null si aucun hippodrome ne correspond", () => {
    expect(findBestCourseMatch({ hippodrome: "Longchamp" }, courses)).toBeNull();
  });

  it("renvoie null si égalité au sommet (même hippodrome, pas de R/C) → choix manuel", () => {
    // a et c sont à Vincennes : sans R/C pour départager, c'est ambigu
    expect(findBestCourseMatch({ hippodrome: "Vincennes" }, courses)).toBeNull();
  });

  it("ne matche pas sur une sous-chaîne courte (anti faux-positif)", () => {
    // "nce" est inclus dans "vincennes" mais n'est pas un token → pas de match
    expect(findBestCourseMatch({ hippodrome: "nce" }, courses)).toBeNull();
  });

  it("renvoie null sur liste vide", () => {
    expect(findBestCourseMatch({ hippodrome: "Vincennes" }, [])).toBeNull();
  });
});
