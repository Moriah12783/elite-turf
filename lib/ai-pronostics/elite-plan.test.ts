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
  it("désigne le banker = meilleur confidence_score", () => {
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

  it("produit un quinte_plan (base = top confidence, champ = le reste) si Quinté+ dispo", () => {
    const p = buildElitePlanDeJeu(base);
    expect(p.quinte_plan).not.toBeNull();
    expect(p.quinte_plan!.base).toEqual([7, 3]);
    expect(p.quinte_plan!.champ).toEqual([5, 12]);
  });

  it("exprime les mises en UNITÉS, jamais en euros", () => {
    const p = buildElitePlanDeJeu(base);
    expect(p.bet_strategy.mise_unites.length).toBeGreaterThan(0);
    for (const m of p.bet_strategy.mise_unites) {
      expect(typeof m.unites).toBe("number");
      expect(m.libelle).not.toMatch(/€|euro/i);
    }
  });
});
