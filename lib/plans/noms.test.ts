import { describe, it, expect } from "vitest";
import { planDepuisNomTable, PLAN_NOM_TO_PLANS_NOM } from "./noms";

describe("formule d'après le nom de la table plans", () => {
  it("Performance → Pro, Découverte → Starter, Elite → Elite", () => {
    expect(planDepuisNomTable("Performance")).toMatchObject({ id: "pro", nom: "Pro", prix_eur: 152, duree_jours: 30 });
    expect(planDepuisNomTable("Découverte")).toMatchObject({ id: "starter", nom: "Starter", duree_jours: 7 });
    expect(planDepuisNomTable("Elite")).toMatchObject({ id: "elite", nom: "Elite", prix_eur: 208, duree_jours: 30 });
  });

  it("nom inconnu ou absent : null, jamais une formule par défaut", () => {
    expect(planDepuisNomTable("Test")).toBeNull();
    expect(planDepuisNomTable("")).toBeNull();
    expect(planDepuisNomTable(null)).toBeNull();
    expect(planDepuisNomTable(undefined)).toBeNull();
  });

  it("chaque formule payante a son nom en base", () => {
    expect(Object.keys(PLAN_NOM_TO_PLANS_NOM).sort()).toEqual(["Elite", "Pro", "Starter"]);
  });
});
