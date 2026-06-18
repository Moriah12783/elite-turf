import { describe, it, expect } from "vitest";
import { heureToMinutes, computeCourseStatus } from "./status";

describe("heureToMinutes", () => {
  it("parse HH:MM:SS", () => expect(heureToMinutes("14:30:00")).toBe(870));
  it("parse HH:MM", () => expect(heureToMinutes("09:05")).toBe(545));
  it("null si vide / invalide", () => {
    expect(heureToMinutes(null)).toBeNull();
    expect(heureToMinutes("")).toBeNull();
    expect(heureToMinutes("99:99")).toBeNull();
  });
});

describe("computeCourseStatus", () => {
  it("TERMINEE dès qu'il y a une arrivée (peu importe l'heure)", () => {
    expect(
      computeCourseStatus({ hasArrivee: true, startMinutes: 870, nowMinutes: 800 }),
    ).toBe("TERMINEE");
  });
  it("A_VENIR si > 10 min avant le départ", () => {
    expect(
      computeCourseStatus({ hasArrivee: false, startMinutes: 870, nowMinutes: 855 }),
    ).toBe("A_VENIR");
  });
  it("IMMINENTE autour du départ", () => {
    expect(
      computeCourseStatus({ hasArrivee: false, startMinutes: 870, nowMinutes: 865 }),
    ).toBe("IMMINENTE");
    expect(
      computeCourseStatus({ hasArrivee: false, startMinutes: 870, nowMinutes: 890 }),
    ).toBe("IMMINENTE");
  });
  it("RESULTAT_IMMINENT si départ passé depuis > 30 min sans arrivée", () => {
    expect(
      computeCourseStatus({ hasArrivee: false, startMinutes: 870, nowMinutes: 905 }),
    ).toBe("RESULTAT_IMMINENT");
  });
  it("A_VENIR si l'heure de départ est inconnue", () => {
    expect(
      computeCourseStatus({ hasArrivee: false, startMinutes: null, nowMinutes: 905 }),
    ).toBe("A_VENIR");
  });
});
