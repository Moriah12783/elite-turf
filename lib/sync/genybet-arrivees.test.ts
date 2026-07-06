import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseGenybetArrivees } from "./genybet-arrivees";

function loadFixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");
}

const HTML_TODAY = loadFixture("genybet-reunions-sample.html"); // 06-07-2026 (courses déjà courues)

describe("parseGenybetArrivees — ordre d'arrivée depuis la page programme", () => {
  const map = parseGenybetArrivees(HTML_TODAY);

  it("ramène l'ordre des courses courues, clé réunion|course", () => {
    expect(map.size).toBeGreaterThanOrEqual(10);
    // Les Sables R1C1 (id 1665355) = arrivée 4-2-7-8-3
    expect(map.get("1|1")).toEqual([4, 2, 7, 8, 3]);
  });

  it("chaque ordre a au moins 3 chevaux, numéros valides (1..99), sans doublon", () => {
    for (const order of map.values()) {
      expect(order.length).toBeGreaterThanOrEqual(3);
      expect(order.every((n) => Number.isInteger(n) && n >= 1 && n <= 99)).toBe(true);
      expect(new Set(order).size).toBe(order.length);
    }
  });

  it("HTML vide / sans arrivée -> map vide, sans throw", () => {
    expect(parseGenybetArrivees("").size).toBe(0);
    expect(parseGenybetArrivees("<html>rien</html>").size).toBe(0);
  });
});
