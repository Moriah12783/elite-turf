import { describe, it, expect } from "vitest";
import { parisVersUtc } from "./paris-date";

describe("parisVersUtc", () => {
  it("convertit une heure d'été de Paris (UTC+2)", () => {
    expect(parisVersUtc("2026-10-02", "16:20:00")?.toISOString()).toBe("2026-10-02T14:20:00.000Z");
  });

  it("convertit une heure d'hiver de Paris (UTC+1)", () => {
    expect(parisVersUtc("2026-12-15", "13:50")?.toISOString()).toBe("2026-12-15T12:50:00.000Z");
  });

  it("tient compte du changement d'heure du jour même", () => {
    // 25/10/2026 : retour à l'heure d'hiver à 3 h ; une course de l'après-midi est en UTC+1.
    expect(parisVersUtc("2026-10-25", "15:15:00")?.toISOString()).toBe("2026-10-25T14:15:00.000Z");
    // 29/03/2026 : passage à l'heure d'été ; l'après-midi est en UTC+2.
    expect(parisVersUtc("2026-03-29", "14:00:00")?.toISOString()).toBe("2026-03-29T12:00:00.000Z");
  });

  it("refuse une entrée illisible", () => {
    expect(parisVersUtc("02/10/2026", "16:20")).toBeNull();
    expect(parisVersUtc("2026-10-02", "")).toBeNull();
  });
});
