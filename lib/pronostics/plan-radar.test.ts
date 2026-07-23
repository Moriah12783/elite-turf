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

// Repli : rôles tels que posés par le pipeline dans `selection_detail`
// (mêmes libellés que ProSelectionBlock).
const DETAIL_ROLES = [
  { number: 9,  role: "BASE" },
  { number: 14, role: "APPUI" },
  { number: 13, role: "COMPLEMENT" },
  { number: 10, role: "OUTSIDER" },
  { number: 4,  role: "OUTSIDER" },
];

describe("buildPlanRadar — voie plan de jeu (ELITE)", () => {
  it("restitue fidèlement la structure d'un vrai pronostic Elite", () => {
    const r = buildPlanRadar(PRONO_ELITE_REEL)!;
    expect(r.source).toBe("plan");
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
});

describe("buildPlanRadar — repli sur les rôles (selection_detail)", () => {
  it("groupe BASE/APPUI/COMPLEMENT en socle, le reste en value", () => {
    const r = buildPlanRadar({
      selection: [9, 14, 13, 10, 4],
      selectionDetail: DETAIL_ROLES,
    })!;
    expect(r.source).toBe("roles");
    expect(r.base).toEqual([9, 14, 13]);   // « chances régulières » = même socle
    expect(r.value).toEqual([10, 4]);
    expect(r.pivot).toBeNull();            // pas de banker sans plan de jeu
  });

  it("sort le coup (plus haute cote) de la value pour ne l'afficher qu'une fois", () => {
    const r = buildPlanRadar({
      selection: [9, 14, 13, 10, 4],
      selectionDetail: DETAIL_ROLES,
      cotes: { 9: 3, 14: 6, 13: 8, 10: 15, 4: 33 },
    })!;
    expect(r.coup).toBe(4);
    expect(r.value).toEqual([10]);         // le 4 n'apparaît plus en value
  });

  it("le plan de jeu prime sur les rôles quand les deux existent", () => {
    const r = buildPlanRadar({
      ...PRONO_ELITE_REEL,
      selectionDetail: DETAIL_ROLES,
    })!;
    expect(r.source).toBe("plan");
    expect(r.base).toEqual([13, 1]);
  });

  it("bascule sur les rôles si le plan de jeu est vide", () => {
    const r = buildPlanRadar({
      selection: [9, 14, 13, 10, 4],
      planDeJeu: { banker: { number: 9 }, quinte_plan: { base: [] }, value_picks: [] },
      selectionDetail: DETAIL_ROLES,
    })!;
    expect(r.source).toBe("roles");
    expect(r.base).toEqual([9, 14, 13]);
  });

  it("ignore les rôles portant sur des numéros hors sélection", () => {
    const r = buildPlanRadar({
      selection: [9, 10],
      selectionDetail: [...DETAIL_ROLES, { number: 99, role: "BASE" }],
    })!;
    expect(r.base).toEqual([9]);
    expect(r.value).toEqual([10]);
  });
});

describe("buildPlanRadar — rien à afficher", () => {
  it("renvoie null sans plan de jeu NI rôles (cas saisie manuelle)", () => {
    expect(buildPlanRadar({ selection: [14, 3, 12, 8] })).toBeNull();
    expect(buildPlanRadar({ selection: [14, 3, 12, 8], planDeJeu: null, selectionDetail: [] })).toBeNull();
  });

  it("sélection vide → null", () => {
    expect(buildPlanRadar({ selection: [], planDeJeu: PRONO_ELITE_REEL.planDeJeu })).toBeNull();
  });
});
