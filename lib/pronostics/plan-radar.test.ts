import { describe, it, expect } from "vitest";
import { buildPlanRadar } from "./plan-radar";

// Cas RÉEL lu en base (pronostic ELITE Quinté+) :
//   selection    = [13,1,14,11,6,7]
//   banker       = 13
//   quinte_plan  = { base: [13,1], champ: [14,11,6,7] }
//   value_picks  = [1, 6]
const PRONO_ELITE_REEL = {
  selection: [13, 1, 14, 11, 6, 7],
  planDeJeu: {
    banker:      { number: 13 },
    quinte_plan: { base: [13, 1] },
    value_picks: [{ number: 1 }, { number: 6 }],
  },
};

describe("buildPlanRadar", () => {
  it("restitue fidèlement la structure d'un vrai pronostic Elite", () => {
    const r = buildPlanRadar(PRONO_ELITE_REEL)!;
    expect(r.pivot).toBe(13);              // le banker
    expect(r.base).toEqual([13, 1]);       // effectif REEL (2), pas un quota de 4
    expect(r.value).toEqual([6]);          // le 1 est déjà en base → pas de doublon
  });

  it("désigne le coup = plus haute cote réelle hors base/value", () => {
    const r = buildPlanRadar({
      ...PRONO_ELITE_REEL,
      cotes: { 13: 3.2, 1: 8.5, 14: 12, 11: 41, 6: 9, 7: 25 },
    })!;
    expect(r.coup).toBe(11); // 41 = la plus haute parmi 14/11/7
  });

  it("masque le coup (null) si aucune cote fiable", () => {
    expect(buildPlanRadar(PRONO_ELITE_REEL)!.coup).toBeNull();
    expect(buildPlanRadar({ ...PRONO_ELITE_REEL, cotes: { 14: 0, 11: -1 } })!.coup).toBeNull();
  });

  it("renvoie null sans plan_de_jeu (cas PRO) — aucune structure inventée", () => {
    expect(buildPlanRadar({ selection: [14, 3, 12, 8], planDeJeu: null })).toBeNull();
  });

  it("renvoie null si le plan ne porte ni base ni value", () => {
    expect(buildPlanRadar({
      selection: [1, 2, 3],
      planDeJeu: { banker: { number: 1 }, quinte_plan: { base: [] }, value_picks: [] },
    })).toBeNull();
  });

  it("ignore les numéros hors sélection et les doublons", () => {
    const r = buildPlanRadar({
      selection: [5, 9],
      planDeJeu: {
        banker:      { number: 42 },                   // hors sélection → pivot null
        quinte_plan: { base: [5, 5, 99] },             // doublon + hors sélection
        value_picks: [{ number: 9 }, { number: 77 }],
      },
    })!;
    expect(r.base).toEqual([5]);
    expect(r.value).toEqual([9]);
    expect(r.pivot).toBeNull();
  });

  it("sélection vide → null", () => {
    expect(buildPlanRadar({ selection: [], planDeJeu: PRONO_ELITE_REEL.planDeJeu })).toBeNull();
  });
});
