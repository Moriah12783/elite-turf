import { describe, it, expect } from "vitest";
import { heureGmtDepuisParis } from "./dates";

// Les heures de course en base sont à l'heure de Paris ; les abonnés africains
// (et le flux LONACI) raisonnent en GMT. Vérifié le 25/09/2026 sur l'API PMU :
// Prix Austria = 20:15 Paris = 18:15 GMT.
describe("heureGmtDepuisParis", () => {
  it("heure d'été : -2 h", () => {
    expect(heureGmtDepuisParis("2026-09-25", "20:15:00")).toBe("18:15");
    expect(heureGmtDepuisParis("2026-09-25", "20:15")).toBe("18:15");
  });

  it("heure d'hiver : -1 h", () => {
    expect(heureGmtDepuisParis("2026-01-15", "14:50:00")).toBe("13:50");
  });

  it("jours de changement d'heure (après le changement, à l'heure des courses)", () => {
    expect(heureGmtDepuisParis("2026-03-29", "14:00:00")).toBe("12:00");
    expect(heureGmtDepuisParis("2026-10-25", "13:00:00")).toBe("12:00");
  });

  it("n'invente rien : heure absente ou illisible → null", () => {
    expect(heureGmtDepuisParis("2026-09-25", "")).toBeNull();
    expect(heureGmtDepuisParis("2026-09-25", null)).toBeNull();
    expect(heureGmtDepuisParis("pas-une-date", "20:15:00")).toBeNull();
    expect(heureGmtDepuisParis("2026-09-25", "vingt heures")).toBeNull();
  });
});
