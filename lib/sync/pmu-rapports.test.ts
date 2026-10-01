import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseRapportsDefinitifs } from "./pmu-rapports";
import { computeRapportGagnant } from "@/lib/pmu-rapports-gagnant";

// Vrais rapports définitifs PMU du Quinté+ du 01/10/2026 (Prix Céréaliste, Auteuil R1C1).
const brut = JSON.parse(
  readFileSync(fileURLToPath(new URL("./__fixtures__/pmu-rapports-definitifs-20261001-R1C1.json", import.meta.url)), "utf8"),
);
const ARRIVEE = [15, 3, 14, 1, 9, 4, 11];

describe("parseRapportsDefinitifs — Quinté+ réel du 01/10/2026", () => {
  const r = parseRapportsDefinitifs(brut, ARRIVEE)!;

  it("Quinté+ « pour 2 € », comme le parser Geny", () => {
    expect(r.quinte_plus).toEqual({ ordre: 26003.8, desordre: 248, bonus4: 7.4, bonus3: 6.2 });
  });

  it("Quarté+ et Tiercé « pour 1 € » (et non pour la mise de base PMU de 1,50 €)", () => {
    expect(r.quarte_plus).toEqual({ ordre: 4127.4, desordre: 81.9, bonus: 16.3 });
    expect(r.tierce).toEqual({ ordre: 646.4, desordre: 98.5 });
  });

  it("simples et couplés, placés dans l'ordre de l'arrivée", () => {
    expect(r.simple_gagnant).toBe(10.4);
    expect(r.simple_place).toEqual([3.7, 1.9, 3.6]);
    expect(r.couple_gagnant).toBe(25.4);
    expect(r.couple_place).toEqual([12.1, 24, 12.3]);
  });

  it("branché sur le calcul des gains existant : GAGNANT = désordre, PARTIEL = bonus 4", () => {
    expect(computeRapportGagnant("QUINTE_PLUS", "GAGNANT", r)).toBe(248);
    expect(computeRapportGagnant("QUINTE_PLUS", "PARTIEL", r)).toBe(7.4);
  });
});

describe("parseRapportsDefinitifs — rien d'inventé", () => {
  it("réponse vide ou illisible → null", () => {
    expect(parseRapportsDefinitifs([], ARRIVEE)).toBeNull();
    expect(parseRapportsDefinitifs({ erreur: true }, ARRIVEE)).toBeNull();
  });

  it("arrivée trop courte : pas de placés ni de couplés placés", () => {
    const r = parseRapportsDefinitifs(brut, [15, 3])!;
    expect(r.simple_place).toBeUndefined();
    expect(r.couple_place).toBeUndefined();
    expect(r.quinte_plus?.desordre).toBe(248);
  });
});
