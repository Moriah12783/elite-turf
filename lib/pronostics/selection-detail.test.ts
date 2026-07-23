import { describe, it, expect } from "vitest";
import { buildSelectionDetail, parseSelectionRoles } from "./selection-detail";

const NOMS = { 7: "Hodrigo Ever", 2: "Jalezio", 11: "Isis de Pouline", 5: "Jackson d'Arc" };

describe("buildSelectionDetail", () => {
  it("écrit une ligne pour CHAQUE cheval — les non qualifiés deviennent du champ", () => {
    const rows = buildSelectionDetail({
      selection: [7, 2, 11, 5],
      roles:     { 7: "BASE", 11: "OUTSIDER" },
    })!;
    expect(rows.map((r) => r.number)).toEqual([7, 2, 11, 5]); // ordre de mérite
    expect(rows.map((r) => r.role)).toEqual(["BASE", "CHAMP", "OUTSIDER", "CHAMP"]);
  });

  it("renvoie null si l'expert n'a rien qualifié (affichage existant préservé)", () => {
    expect(buildSelectionDetail({ selection: [7, 2], roles: {} })).toBeNull();
    expect(buildSelectionDetail({ selection: [7, 2], roles: { 99: "BASE" } })).toBeNull();
  });

  it("sélection vide → null", () => {
    expect(buildSelectionDetail({ selection: [], roles: { 7: "BASE" } })).toBeNull();
  });

  it("porte le nom du cheval quand il est connu, et OMET le champ sinon", () => {
    const rows = buildSelectionDetail({
      selection: [7, 2],
      roles:     { 7: "BASE" },
      noms:      { 7: "Hodrigo Ever", 2: "   " },
    })!;
    expect(rows[0].name).toBe("Hodrigo Ever");
    expect("name" in rows[1]).toBe(false); // jamais "" : ProSelectionBlock afficherait du vide
  });

  it("nettoie les espaces parasites des noms", () => {
    const rows = buildSelectionDetail({
      selection: [7],
      roles:     { 7: "BASE" },
      noms:      { 7: "  Hodrigo Ever " },
    })!;
    expect(rows[0].name).toBe("Hodrigo Ever");
  });

  it("marque le pivot, et lui seul", () => {
    const rows = buildSelectionDetail({
      selection: [7, 2, 11],
      roles:     { 7: "BASE", 2: "BASE" },
      pivot:     7,
      noms:      NOMS,
    })!;
    expect(rows.filter((r) => r.pivot === true).map((r) => r.number)).toEqual([7]);
    expect("pivot" in rows[1]).toBe(false);
  });

  it("ignore un pivot qui n'est plus dans la sélection", () => {
    const rows = buildSelectionDetail({
      selection: [2, 11],
      roles:     { 2: "BASE" },
      pivot:     7,
    })!;
    expect(rows.some((r) => r.pivot)).toBe(false);
  });

  it("ignore les rôles portant sur des chevaux retirés de la sélection", () => {
    const rows = buildSelectionDetail({
      selection: [2],
      roles:     { 2: "BASE", 7: "COUP" }, // le 7 a été retiré
    })!;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ number: 2, role: "BASE" });
  });

  it("dédoublonne la sélection", () => {
    const rows = buildSelectionDetail({ selection: [7, 7, 2], roles: { 7: "BASE" } })!;
    expect(rows.map((r) => r.number)).toEqual([7, 2]);
  });
});

describe("parseSelectionRoles", () => {
  it("relit les rôles et le pivot posés par l'expert", () => {
    const r = parseSelectionRoles([
      { number: 7, role: "BASE", pivot: true },
      { number: 11, role: "OUTSIDER" },
      { number: 5, role: "COUP" },
    ]);
    expect(r.roles).toEqual({ 7: "BASE", 11: "OUTSIDER", 5: "COUP" });
    expect(r.pivot).toBe(7);
  });

  it("préserve les noms stockés — un réenregistrement ne doit pas les effacer", () => {
    const relu = parseSelectionRoles([{ number: 14, name: "Idéal de Castelle ", role: "COMPLEMENT" }]);
    expect(relu.noms).toEqual({ 14: "Idéal de Castelle" });
    const rows = buildSelectionDetail({
      selection: [14],
      roles: relu.roles,
      noms: relu.noms,
    })!;
    expect(rows[0]).toEqual({ number: 14, role: "COMPLEMENT", name: "Idéal de Castelle" });
  });

  it("conserve VERBATIM les rôles du pipeline — pas de rétrogradation silencieuse", () => {
    // Forme réelle lue en production (pronostic PRO, source AI-MULTI-AGENT).
    const r = parseSelectionRoles([
      { name: "Idéal de Castelle", role: "COMPLEMENT", number: 14 },
      { name: "Italiano Di Pao", role: "OUTSIDER", number: 3 },
    ]);
    expect(r.roles).toEqual({ 14: "COMPLEMENT", 3: "OUTSIDER" });
  });

  it("le champ n'est pas un rôle à recharger (il est le défaut)", () => {
    expect(parseSelectionRoles([{ number: 9, role: "CHAMP" }]).roles).toEqual({});
  });

  it("tolère null, une valeur non-tableau et des entrées cassées", () => {
    expect(parseSelectionRoles(null)).toEqual({ roles: {}, pivot: null, noms: {} });
    expect(parseSelectionRoles("nope")).toEqual({ roles: {}, pivot: null, noms: {} });
    expect(parseSelectionRoles([{ role: "BASE" }, { number: "x", role: "BASE" }]).roles).toEqual({});
  });

  it("fait l'aller-retour sans perte", () => {
    const rows = buildSelectionDetail({
      selection: [7, 2, 11, 5],
      roles: { 7: "BASE", 11: "OUTSIDER", 5: "COUP" },
      pivot: 7,
    })!;
    const relu = parseSelectionRoles(rows);
    expect(relu.roles).toEqual({ 7: "BASE", 11: "OUTSIDER", 5: "COUP" });
    expect(relu.pivot).toBe(7);
  });
});
