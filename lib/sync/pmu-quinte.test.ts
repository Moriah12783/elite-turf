import { describe, it, expect } from "vitest";
import { parsePmuProgrammeParis, computeQuinteUpdates, alignerParisNationaux, type CourseBaseParis } from "./pmu-quinte";
import { canonicalHippodrome } from "./hippodrome-canonical";

// Extrait du vrai programme PMU du 02/10/2026 (R1 Vincennes) + une autre réunion.
const programme = {
  programme: {
    reunions: [
      {
        numExterne: 1,
        hippodrome: { libelleCourt: "VINCENNES" },
        courses: [
          { numOrdre: 3, paris: [{ typePari: "E_SIMPLE_GAGNANT" }, { typePari: "E_COUPLE_GAGNANT" }, { typePari: "E_TRIO" }] },
          { numOrdre: 4, paris: [{ typePari: "E_SIMPLE_GAGNANT" }, { typePari: "E_TIERCE" }, { typePari: "E_QUARTE_PLUS" }, { typePari: "E_QUINTE_PLUS" }] },
        ],
      },
      {
        numExterne: 2,
        hippodrome: { libelleCourt: "LYON PARILLY" },
        courses: [{ numOrdre: 1, paris: [{ typePari: "E_SIMPLE_GAGNANT" }, { typePari: "E_MULTI" }] }],
      },
    ],
  },
};

// État de la base le 01/10/2026 au soir : estimation GenyBet sur le Prix Atalante.
const base = (): CourseBaseParis[] => [
  { id: "atalante", hippodrome_id: "h-vin", numero_reunion: 1, numero_course: 3, nationale: null,
    paris_disponibles: ["QUINTE_PLUS", "QUARTE_PLUS", "TIERCE", "COUPLE_GAGNANT", "COUPLE_PLACE", "TRIO"] },
  { id: "ludovica", hippodrome_id: "h-vin", numero_reunion: 1, numero_course: 4, nationale: null,
    paris_disponibles: ["SIMPLE_GAGNANT", "SIMPLE_PLACE"] },
  { id: "lyon", hippodrome_id: "h-lyon", numero_reunion: 2, numero_course: 1, nationale: null,
    paris_disponibles: ["SIMPLE_GAGNANT", "SIMPLE_PLACE"] },
];
const hippoCanonMap = new Map([[canonicalHippodrome("Vincennes"), "h-vin"], [canonicalHippodrome("Lyon-Parilly"), "h-lyon"]]);

describe("parsePmuProgrammeParis", () => {
  it("ne retient que les paris nationaux, par course", () => {
    expect(parsePmuProgrammeParis(programme)).toEqual([
      { hippodrome: "VINCENNES", nReunion: 1, numeroCourse: 3, parisNationaux: [] },
      { hippodrome: "VINCENNES", nReunion: 1, numeroCourse: 4, parisNationaux: ["TIERCE", "QUARTE_PLUS", "QUINTE_PLUS"] },
      { hippodrome: "LYON PARILLY", nReunion: 2, numeroCourse: 1, parisNationaux: [] },
    ]);
    expect(parsePmuProgrammeParis(null)).toEqual([]);
  });
});

describe("computeQuinteUpdates — cas réel du 02/10/2026", () => {
  it("déplace le Quinté+ de l'estimation GenyBet vers la course désignée par le PMU", () => {
    const { updates, report } = computeQuinteUpdates({ parsedCourses: parsePmuProgrammeParis(programme), dbCourses: base(), hippoCanonMap });
    expect(updates).toEqual([
      { id: "atalante", paris_disponibles: ["COUPLE_GAGNANT", "COUPLE_PLACE", "TRIO"] },
      { id: "ludovica", paris_disponibles: ["SIMPLE_GAGNANT", "SIMPLE_PLACE", "QUINTE_PLUS", "QUARTE_PLUS", "TIERCE"] },
    ]);
    expect(report).toMatchObject({ quintes_pmu: 1, quinte_apparie: true, matched: 3, updated: 2, raison: null });
  });

  it("idempotent : une base déjà alignée ne produit aucune écriture", () => {
    const alignee = base();
    alignee[0].paris_disponibles = ["COUPLE_GAGNANT", "COUPLE_PLACE", "TRIO"];
    alignee[1].paris_disponibles = ["SIMPLE_GAGNANT", "SIMPLE_PLACE", "QUINTE_PLUS", "QUARTE_PLUS", "TIERCE"];
    expect(computeQuinteUpdates({ parsedCourses: parsePmuProgrammeParis(programme), dbCourses: alignee, hippoCanonMap }).updates).toEqual([]);
  });

  it("course étiquetée par la LONACI : jamais touchée", () => {
    const lonaci = base();
    lonaci[0].nationale = 2; // la LONACI y pose son Quarté+ / Tiercé
    const { updates, report } = computeQuinteUpdates({ parsedCourses: parsePmuProgrammeParis(programme), dbCourses: lonaci, hippoCanonMap });
    expect(updates.map((u) => u.id)).toEqual(["ludovica"]);
    expect(report.ignorees_lonaci).toBe(1);
  });
});

describe("computeQuinteUpdates — garde-fous", () => {
  it("aucun ou plusieurs Quinté+ au PMU : rien n'est écrit", () => {
    const sans = parsePmuProgrammeParis(programme).map((c) => ({ ...c, parisNationaux: [] }));
    expect(computeQuinteUpdates({ parsedCourses: sans, dbCourses: base(), hippoCanonMap }).updates).toEqual([]);
    const deux = parsePmuProgrammeParis(programme).map((c) => ({ ...c, parisNationaux: ["QUINTE_PLUS"] }));
    const r = computeQuinteUpdates({ parsedCourses: deux, dbCourses: base(), hippoCanonMap });
    expect(r.updates).toEqual([]);
    expect(r.report.raison).toContain("3 Quinté+");
  });

  it("Quinté+ du PMU absent de la base : rien n'est écrit (pas de journée sans Quinté+)", () => {
    const sansLudovica = base().filter((c) => c.id !== "ludovica");
    const r = computeQuinteUpdates({ parsedCourses: parsePmuProgrammeParis(programme), dbCourses: sansLudovica, hippoCanonMap });
    expect(r.updates).toEqual([]);
    expect(r.report.quinte_apparie).toBe(false);
  });
});

describe("alignerParisNationaux", () => {
  it("garde les autres paris dans leur ordre, ajoute les nationaux dans un ordre fixe", () => {
    expect(alignerParisNationaux(["TRIO", "QUINTE_PLUS", "SIMPLE_GAGNANT"], [])).toEqual(["TRIO", "SIMPLE_GAGNANT"]);
    expect(alignerParisNationaux(["SIMPLE_GAGNANT"], ["TIERCE", "QUINTE_PLUS"])).toEqual(["SIMPLE_GAGNANT", "QUINTE_PLUS", "TIERCE"]);
  });
});
