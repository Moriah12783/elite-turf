import { describe, it, expect } from "vitest";
import { fenetrePhoto, cotesMarche } from "./photo";

describe("fenetrePhoto — une photo par course, ~10 min avant le départ", () => {
  const depart = new Date("2026-10-02T18:15:00Z");
  const a = (iso: string) => Date.parse(iso);
  it("départ dans 5 à 15 minutes", () => {
    expect(fenetrePhoto(depart, a("2026-10-02T18:00:00Z"))).toBe(true);  // 15 min
    expect(fenetrePhoto(depart, a("2026-10-02T18:05:00Z"))).toBe(true);  // 10 min
    expect(fenetrePhoto(depart, a("2026-10-02T18:10:00Z"))).toBe(true);  // 5 min
  });
  it("trop tôt, trop tard ou sans heure", () => {
    expect(fenetrePhoto(depart, a("2026-10-02T17:59:00Z"))).toBe(false); // 16 min
    expect(fenetrePhoto(depart, a("2026-10-02T18:11:00Z"))).toBe(false); // 4 min
    expect(fenetrePhoto(null)).toBe(false);
  });
});

describe("cotesMarche — le marché complet au moment de la photo", () => {
  it("garde les partants cotés, sans les non-partants", () => {
    expect(cotesMarche([
      { numero: 1, cote: 4.3 },
      { numero: 2, cote: null },
      { numero: 3, cote: 12, non_partant: true },
      { numero: 4, cote: 6.1 },
    ])).toEqual({ "1": 4.3, "4": 6.1 });
  });
});
