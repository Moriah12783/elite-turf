import { describe, it, expect } from "vitest";
import { resolveFormule, filterByFormule, summarizeTier } from "./tier-stats";

const P = (resultat: string, niveau: string | null) =>
  ({ resultat, niveau_acces: niveau } as { resultat: string; niveau_acces: any });

describe("resolveFormule", () => {
  it("clé valide", () => expect(resolveFormule("elite").key).toBe("elite"));
  it("clé inconnue → tous", () => expect(resolveFormule("xxx").key).toBe("tous"));
  it("undefined → tous", () => expect(resolveFormule(undefined).key).toBe("tous"));
});

describe("filterByFormule", () => {
  const list = [P("GAGNANT", "ELITE"), P("PERDANT", "PRO"), P("GAGNANT", "STARTER"), P("GAGNANT", "GRATUIT")];
  it("tous → toute la liste", () => expect(filterByFormule(list, resolveFormule("tous"))).toHaveLength(4));
  it("pro → PRO + STARTER", () => {
    const r = filterByFormule(list, resolveFormule("pro"));
    expect(r.map((p) => p.niveau_acces).sort()).toEqual(["PRO", "STARTER"]);
  });
  it("elite → ELITE seul", () => expect(filterByFormule(list, resolveFormule("elite"))).toHaveLength(1));
  it("ignore niveau_acces null pour un tier nommé", () =>
    expect(filterByFormule([P("GAGNANT", null)], resolveFormule("elite"))).toHaveLength(0));
});

describe("summarizeTier", () => {
  it("taux = gagnants / terminés (exclut EN_ATTENTE)", () => {
    const list = [P("GAGNANT", "ELITE"), P("PERDANT", "ELITE"), P("EN_ATTENTE", "ELITE")];
    expect(summarizeTier(list, resolveFormule("elite"))).toEqual({ total: 3, termines: 2, gagnants: 1, taux: 50 });
  });
  it("pro agrège PRO + STARTER", () => {
    const list = [P("GAGNANT", "PRO"), P("GAGNANT", "STARTER"), P("PERDANT", "PRO")];
    expect(summarizeTier(list, resolveFormule("pro"))).toEqual({ total: 3, termines: 3, gagnants: 2, taux: 67 });
  });
  it("liste vide → tout 0", () =>
    expect(summarizeTier([], resolveFormule("pro"))).toEqual({ total: 0, termines: 0, gagnants: 0, taux: 0 }));
});
