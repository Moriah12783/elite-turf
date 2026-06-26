import { describe, it, expect } from "vitest";
import { buildElitePlanDeJeu, type EliteSelectionInput } from "./elite-plan";

const base: EliteSelectionInput = {
  runners: [
    { number: 7,  name: "Alpha",   role: "BASE",     confidence_score: 80, value_score: 30 },
    { number: 3,  name: "Bravo",   role: "APPUI",    confidence_score: 70, value_score: 40 },
    { number: 12, name: "Charlie", role: "OUTSIDER", confidence_score: 50, value_score: 75 },
    { number: 5,  name: "Delta",   role: "APPUI",    confidence_score: 65, value_score: 35 },
  ],
  paris_disponibles: ["QUINTE_PLUS", "QUARTE_PLUS", "TIERCE"],
};

describe("buildElitePlanDeJeu", () => {
  it("désigne le banker = tête de sélection (1er au mérite)", () => {
    const p = buildElitePlanDeJeu(base);
    expect(p.banker.number).toBe(7);
    expect(p.banker.name).toBe("Alpha");
    expect(p.banker.justification.length).toBeGreaterThan(0);
  });

  it("cible les value_picks (value_score >= 50)", () => {
    const p = buildElitePlanDeJeu(base);
    expect(p.value_picks.map((v) => v.number)).toEqual([12]);
  });

  it("choisit le meilleur type de pari dispo (Quinté+ prioritaire)", () => {
    const p = buildElitePlanDeJeu(base);
    expect(p.bet_strategy.type_pari).toMatch(/Quinté\+/);
    expect(p.bet_strategy.champ_reduit).toEqual([7, 3, 12, 5]);
  });

  it("retombe sur Quarté+ si pas de Quinté+", () => {
    const p = buildElitePlanDeJeu({ ...base, paris_disponibles: ["QUARTE_PLUS", "TIERCE"] });
    expect(p.bet_strategy.type_pari).toMatch(/Quarté\+/);
    expect(p.quinte_plan).toBeNull();
  });

  it("produit un quinte_plan (base = têtes de sélection au mérite, champ = le reste) si Quinté+ dispo", () => {
    const p = buildElitePlanDeJeu(base);
    expect(p.quinte_plan).not.toBeNull();
    expect(p.quinte_plan!.base).toEqual([7, 3]);
    expect(p.quinte_plan!.champ).toEqual([12, 5]);
  });

  it("exprime les mises en UNITÉS, jamais en euros", () => {
    const p = buildElitePlanDeJeu(base);
    expect(p.bet_strategy.mise_unites.length).toBeGreaterThan(0);
    for (const m of p.bet_strategy.mise_unites) {
      expect(typeof m.unites).toBe("number");
      expect(m.libelle).not.toMatch(/€|euro/i);
    }
  });

  it("ne présente jamais le banker en value pick (même value_score élevé)", () => {
    const p = buildElitePlanDeJeu({
      runners: [
        { number: 7, name: "Alpha", role: "BASE",     confidence_score: 90, value_score: 80, risk_score: 20 },
        { number: 9, name: "Echo",  role: "OUTSIDER", confidence_score: 40, value_score: 60, risk_score: 20 },
      ],
      paris_disponibles: ["QUINTE_PLUS"],
    });
    expect(p.banker.number).toBe(7);
    expect(p.value_picks.map((v) => v.number)).not.toContain(7);
    expect(p.value_picks.map((v) => v.number)).toContain(9);
  });

  it("exclut un value pick à risque élevé (risk_score >= 65)", () => {
    const p = buildElitePlanDeJeu({
      runners: [
        { number: 7, name: "Alpha", role: "BASE",     confidence_score: 80, value_score: 30, risk_score: 20 },
        { number: 9, name: "Echo",  role: "OUTSIDER", confidence_score: 40, value_score: 80, risk_score: 70 },
      ],
      paris_disponibles: ["QUINTE_PLUS"],
    });
    expect(p.value_picks).toEqual([]);
  });

  it("value_picks vide si aucun cheval n'atteint le seuil", () => {
    const p = buildElitePlanDeJeu({
      runners: base.runners.map((r) => ({ ...r, value_score: 10 })),
      paris_disponibles: ["QUINTE_PLUS"],
    });
    expect(p.value_picks).toEqual([]);
  });

  it("lève une erreur sur une sélection vide (défense en profondeur)", () => {
    expect(() => buildElitePlanDeJeu({ runners: [], paris_disponibles: ["TIERCE"] })).toThrow();
  });

  it("ne revendique plus une « probabilité estimée » fabriquée dans les value picks", () => {
    const p = buildElitePlanDeJeu(base);
    for (const v of p.value_picks) {
      expect(v.raison).not.toMatch(/probabilit/i);
    }
  });
});
