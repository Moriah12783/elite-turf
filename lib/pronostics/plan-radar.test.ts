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

// Rôles saisis à la main par l'expert dans l'admin (vocabulaire Radar).
const DETAIL_ADMIN = [
  { number: 7,  role: "BASE",     pivot: true },
  { number: 2,  role: "BASE" },
  { number: 11, role: "OUTSIDER" },
  { number: 5,  role: "COUP" },
];

describe("buildPlanRadar — rôles saisis par l'expert (admin)", () => {
  it("restitue base / value / coup / pivot tels que désignés", () => {
    const r = buildPlanRadar({
      selection: [7, 2, 11, 5],
      selectionDetail: DETAIL_ADMIN,
    })!;
    expect(r.source).toBe("roles");
    expect(r.base).toEqual([7, 2]);
    expect(r.value).toEqual([11]);
    expect(r.coup).toBe(5);      // désigné, sans avoir besoin des cotes
    expect(r.pivot).toBe(7);
  });

  it("le coup DÉSIGNÉ prime sur la plus haute cote", () => {
    const r = buildPlanRadar({
      selection: [7, 2, 11, 5],
      selectionDetail: DETAIL_ADMIN,
      cotes: { 7: 2.5, 2: 4, 11: 60, 5: 9 }, // le 11 cote bien plus haut
    })!;
    expect(r.coup).toBe(5);       // on respecte le choix de l'expert
    expect(r.value).toEqual([11]); // et le 11 reste en value
  });

  it("le coup désigné n'est jamais compté deux fois", () => {
    const r = buildPlanRadar({ selection: [7, 5], selectionDetail: DETAIL_ADMIN })!;
    expect(r.value).not.toContain(5);
    expect(r.base).not.toContain(5);
  });

  it("ignore un pivot posé sur un cheval hors sélection", () => {
    const r = buildPlanRadar({
      selection: [2, 11],
      selectionDetail: DETAIL_ADMIN, // le pivot 7 n'est plus dans la sélection
    })!;
    expect(r.pivot).toBeNull();
  });

  it("affiche le bloc même si SEUL un coup a été désigné", () => {
    const r = buildPlanRadar({
      selection: [5],
      selectionDetail: [{ number: 5, role: "COUP" }],
    })!;
    expect(r.coup).toBe(5);
    expect(r.base).toEqual([]);
    expect(r.value).toEqual([]);
  });

  it("le champ n'est ni base ni value — il ne pollue pas le bloc", () => {
    const r = buildPlanRadar({
      selection: [7, 2, 11, 9, 3],
      selectionDetail: [
        { number: 7,  role: "BASE" },
        { number: 2,  role: "BASE" },
        { number: 11, role: "OUTSIDER" },
        { number: 9,  role: "CHAMP" },
        { number: 3,  role: "CHAMP" },
      ],
    })!;
    expect(r.base).toEqual([7, 2]);
    expect(r.value).toEqual([11]);
    expect(r.base).not.toContain(9);
    expect(r.value).not.toContain(3);
  });

  it("déduit le coup dans le champ en priorité, sans amputer la value", () => {
    const r = buildPlanRadar({
      selection: [7, 11, 9, 3],
      selectionDetail: [
        { number: 7,  role: "BASE" },
        { number: 11, role: "OUTSIDER" },
        { number: 9,  role: "CHAMP" },
        { number: 3,  role: "CHAMP" },
      ],
      cotes: { 7: 3, 11: 12, 9: 28, 3: 40 },
    })!;
    expect(r.coup).toBe(3);          // plus haute cote DU CHAMP
    expect(r.value).toEqual([11]);   // la value reste intacte
  });

  it("ne retient qu'un seul coup et qu'un seul pivot (le premier au mérite)", () => {
    const r = buildPlanRadar({
      selection: [3, 8, 1, 4],
      selectionDetail: [
        { number: 3, role: "BASE", pivot: true },
        { number: 8, role: "BASE", pivot: true },
        { number: 1, role: "COUP" },
        { number: 4, role: "COUP" },
      ],
    })!;
    expect(r.pivot).toBe(3);
    expect(r.coup).toBe(1);
    expect(r.value).toEqual([4]); // le 2e COUP retombe en value — aucun cheval perdu
  });
});

describe("buildPlanRadar — aucun cheval publié ne peut disparaître", () => {
  // Le bloc REMPLACE la liste des dossards sur la carte : base+value+coup+champ
  // doit TOUJOURS recouvrir l'intégralité de la sélection publiée.
  const couvre = (r: NonNullable<ReturnType<typeof buildPlanRadar>>, selection: number[]) => {
    const vus = r.base.concat(r.value, r.champ, r.coup != null ? [r.coup] : []);
    expect(vus.slice().sort((a, b) => a - b)).toEqual(selection.slice().sort((a, b) => a - b));
  };

  it("couvre toute la sélection — voie plan de jeu (cas réel de production)", () => {
    const sel = PRONO_ELITE_REEL.selection;
    couvre(buildPlanRadar(PRONO_ELITE_REEL)!, sel);
    couvre(buildPlanRadar({ ...PRONO_ELITE_REEL, cotes: { 14: 12, 11: 41, 7: 25 } })!, sel);
  });

  it("couvre toute la sélection — voie rôles, avec du champ", () => {
    const sel = [7, 2, 11, 9, 3];
    couvre(
      buildPlanRadar({
        selection: sel,
        selectionDetail: [
          { number: 7, role: "BASE" },
          { number: 2, role: "BASE" },
          { number: 11, role: "OUTSIDER" },
          { number: 9, role: "CHAMP" },
          { number: 3, role: "CHAMP" },
        ],
      })!,
      sel,
    );
  });

  it("couvre toute la sélection — même les chevaux absents de selection_detail", () => {
    const sel = [7, 2, 11, 9];
    const r = buildPlanRadar({
      selection: sel,
      selectionDetail: [{ number: 7, role: "BASE" }], // 2, 11 et 9 non décrits
    })!;
    couvre(r, sel);
    expect(r.champ).toEqual([2, 11, 9]);
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
