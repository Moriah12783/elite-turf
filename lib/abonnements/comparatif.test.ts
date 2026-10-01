import { describe, it, expect } from "vitest";
import { fichesFormules, prixParJour, type IdFormule } from "./comparatif";

const FORMULES: IdFormule[] = ["free", "starter", "pro", "elite"];
const lignes = (offre: string | null = null) =>
  fichesFormules(offre).reduce((acc, g) => acc.concat(g.lignes), [] as ReturnType<typeof fichesFormules>[number]["lignes"]);

describe("fiches à cases des formules", () => {
  it("chaque ligne a une case pour chaque formule, et un identifiant unique", () => {
    const ids: Record<string, boolean> = {};
    for (const l of lignes()) {
      for (const f of FORMULES) expect(l.cases).toHaveProperty(f);
      expect(ids[l.id]).toBeUndefined();
      ids[l.id] = true;
    }
  });

  it("Starter = Pro (sur 7 jours) hors offre promotionnelle", () => {
    for (const l of lignes()) expect(l.cases.starter).toEqual(l.cases.pro);
  });

  it("Elite inclut tout ce qu'inclut Pro, et le pronostic Elite en plus", () => {
    for (const l of lignes()) if (l.cases.pro !== false) expect(l.cases.elite).not.toBe(false);
    const elite = lignes().find((l) => l.id === "pronostic-elite")!;
    expect(elite.cases).toEqual({ free: false, starter: false, pro: false, elite: true });
  });

  it("Free : Sélection stats, mais pas de pronostic expert", () => {
    const parId = (id: string) => lignes().find((l) => l.id === id)!;
    expect(parId("selection-stats").cases.free).toBe(true);
    expect(parId("pronostic-expert").cases.free).toBe(false);
  });

  it("offre « Starter = accès Elite » : précisée dans la case Starter", () => {
    const elite = lignes("27 août").find((l) => l.id === "pronostic-elite")!;
    expect(elite.cases.starter).toBe("Offert jusqu'au 27 août");
  });

  it("rien d'annoncé avant livraison : ni plan de jeu Elite, ni 6 chevaux pour Starter / Pro", () => {
    const texte = lignes().map((l) => `${l.libelle} ${l.detail}`).join(" ").toLowerCase();
    for (const mot of ["plan de jeu", "couplé", "champ réduit", "value", "associé"]) {
      expect(texte).not.toContain(mot);
    }
    const expert = lignes().find((l) => l.id === "pronostic-expert")!;
    expect(expert.detail).toContain("8 chevaux");
  });
});

describe("prixParJour", () => {
  it("arrondi au centime, virgule française", () => {
    expect(prixParJour(65, 7)).toBe("9,29 € par jour");
    expect(prixParJour(152, 30)).toBe("5,07 € par jour");
    expect(prixParJour(208, 30)).toBe("6,93 € par jour");
  });
  it("durée invalide → chaîne vide", () => {
    expect(prixParJour(65, 0)).toBe("");
  });
});
