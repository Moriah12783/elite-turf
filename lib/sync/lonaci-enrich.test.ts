import { describe, it, expect } from "vitest";
import { computeLonaciEnrichment } from "./lonaci-enrich";

const GENY = [
  { id: "c1", hippodrome_id: "h1", numero_reunion: 1, numero_course: 1, pays: "France" },
  { id: "c2", hippodrome_id: "h1", numero_reunion: 1, numero_course: 2, pays: "France" },
  { id: "c3", hippodrome_id: "h2", numero_reunion: 2, numero_course: 1, pays: "France" },
];
const CANON = new Map<string, string>([
  ["vincennes", "h1"],
  ["saintcloud", "h2"],
]);

describe("computeLonaciEnrichment", () => {
  it("marque jouable + nationale les courses rapprochees", () => {
    const r = computeLonaciEnrichment(
      {
        date: "2026-05-31",
        lonaciCourses: [
          { hippodrome: "VINCENNES", nReunion: 1, numeroCourse: 1, nationale: 1 },
          { hippodrome: "Saint-Cloud", nReunion: 2, numeroCourse: 1, nationale: 0 },
        ],
        genyCourses: GENY,
        hippoCanonMap: CANON,
      },
      { guardMinReunions: 99, guardMinCoverage: 1 }, // garde-fou desactive (jamais complet)
    );
    expect(r.updates).toContainEqual({ id: "c1", jouable_afrique: true, nationale: 1 });
    expect(r.updates).toContainEqual({ id: "c3", jouable_afrique: true, nationale: null });
    // c2 non rapprochee et garde-fou non atteint -> pas de verdict false
    expect(r.updates.find((u) => u.id === "c2")).toBeUndefined();
    expect(r.report.matched).toBe(2);
  });

  it("corrige (false) les courses non rapprochees si programme complet", () => {
    const r = computeLonaciEnrichment(
      {
        date: "2026-05-31",
        lonaciCourses: [
          { hippodrome: "VINCENNES", nReunion: 1, numeroCourse: 1, nationale: 1 },
          { hippodrome: "VINCENNES", nReunion: 1, numeroCourse: 2, nationale: 0 },
          { hippodrome: "SAINT-CLOUD", nReunion: 2, numeroCourse: 1, nationale: 0 },
        ],
        genyCourses: GENY,
        hippoCanonMap: CANON,
      },
      { guardMinReunions: 2, guardMinCoverage: 0.5 }, // atteint -> complet
    );
    expect(r.updates.every((u) => u.jouable_afrique === true)).toBe(true);
    expect(r.report.corrected_false).toBe(0);
  });

  it("marque false les courses Geny non rapprochees quand programme complet", () => {
    const r = computeLonaciEnrichment(
      {
        date: "2026-05-31",
        lonaciCourses: [
          // 2 reunions couvertes (R1 et R2) mais R1C2 non relayee par LONACI
          { hippodrome: "VINCENNES", nReunion: 1, numeroCourse: 1, nationale: 1 },
          { hippodrome: "SAINT-CLOUD", nReunion: 2, numeroCourse: 1, nationale: 0 },
        ],
        genyCourses: GENY,
        hippoCanonMap: CANON,
      },
      { guardMinReunions: 2, guardMinCoverage: 0.5 }, // 2 reunions matchees / 2 Geny = 1.0 -> complet
    );
    expect(r.updates).toContainEqual({ id: "c2", jouable_afrique: false, nationale: null });
    expect(r.report.corrected_false).toBe(1);
  });

  it("compte les hippodromes non rapproches sans rien creer", () => {
    const r = computeLonaciEnrichment(
      {
        date: "2026-05-31",
        lonaciCourses: [{ hippodrome: "Dakar", nReunion: 1, numeroCourse: 1, nationale: 0 }],
        genyCourses: GENY,
        hippoCanonMap: CANON,
      },
      { guardMinReunions: 99, guardMinCoverage: 1 },
    );
    expect(r.report.unmatched_hippodrome).toBe(1);
    expect(r.updates).toHaveLength(0);
  });

  it("ne corrige PAS (false) une course etrangere meme si programme complet", () => {
    const geny = [
      { id: "c1",  hippodrome_id: "h1",  numero_reunion: 1, numero_course: 1, pays: "France" },
      { id: "cUK", hippodrome_id: "hUK", numero_reunion: 9, numero_course: 1, pays: "Grande-Bretagne" },
    ];
    const r = computeLonaciEnrichment(
      {
        date: "2026-05-31",
        lonaciCourses: [
          { hippodrome: "VINCENNES", nReunion: 1, numeroCourse: 1, nationale: 1 },
        ],
        genyCourses: geny,
        hippoCanonMap: CANON,
      },
      { guardMinReunions: 1, guardMinCoverage: 0.5 }, // complet
    );
    // c1 (France) rapprochee -> true ; cUK (etrangere) non rapprochee -> JAMAIS corrigee
    expect(r.updates).toContainEqual({ id: "c1", jouable_afrique: true, nationale: 1 });
    expect(r.updates.find((u) => u.id === "cUK")).toBeUndefined();
    expect(r.report.corrected_false).toBe(0);
  });
});
