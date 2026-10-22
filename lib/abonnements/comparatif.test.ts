import { describe, it, expect } from "vitest";
import { fichesFormules, prixParJour, type IdFormule } from "./comparatif";
import { PLAN_DE_JEU_ELITE } from "../pricing";

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

  it("Elite inclut tout ce qu'inclut Pro, et le plan de jeu en plus", () => {
    for (const l of lignes()) if (l.cases.pro !== false) expect(l.cases.elite).not.toBe(false);
    const elite = lignes().find((l) => l.id === "plan-de-jeu-elite")!;
    expect(elite.cases).toEqual({ free: false, starter: false, pro: false, elite: true });
  });

  it("Free : Sélection stats, mais pas de pronostic expert", () => {
    const parId = (id: string) => lignes().find((l) => l.id === id)!;
    expect(parId("selection-stats").cases.free).toBe(true);
    expect(parId("pronostic-expert").cases.free).toBe(false);
  });

  it("offre « Starter = accès Elite » : précisée dans la case Starter", () => {
    const elite = lignes("27 août").find((l) => l.id === "plan-de-jeu-elite")!;
    expect(elite.cases.starter).toBe("Offert jusqu'au 27 août");
  });

  it("offre du 16/10/2026 : pronostic expert en 6 chevaux, plan de jeu Elite en 8 (base de 4, values, associés)", () => {
    // Décisions de Steph : Starter et Pro restent annoncés en 6 chevaux (son
    // public africain préfère 6 à 8) ; le plan de jeu Elite = ce que préparent
    // les brouillons Argon au niveau ELITE : 8 chevaux, la base de 4, les
    // values et les associés.
    const expert = lignes().find((l) => l.id === "pronostic-expert")!;
    expect(expert.detail).toContain("6 chevaux");
    expect(expert.detail).not.toContain("8 chevaux");
    const plan = lignes().find((l) => l.id === "plan-de-jeu-elite")!;
    expect(plan.libelle).toBe("Le plan de jeu Elite");
    expect(plan.detail).toBe(PLAN_DE_JEU_ELITE);
    for (const element of ["8 chevaux", "base de 4", "champ réduit ou total", "values", "associés"]) {
      expect(plan.detail).toContain(element);
    }
    expect(plan.detail).not.toContain("base de 3");
    expect(plan.detail).not.toContain("resserr");
    // Le plan de jeu n'est annoncé nulle part ailleurs que sur sa propre ligne.
    const autres = lignes().filter((l) => l.id !== "plan-de-jeu-elite").map((l) => `${l.libelle} ${l.detail}`).join(" ").toLowerCase();
    expect(autres).not.toContain("plan de jeu");
    expect(autres).not.toContain("associé");
  });

  it("garde-fou : le couplé n'est jamais promis", () => {
    // Décision de Steph du 16/10/2026 : il l'indique course par course, les
    // brouillons Argon ne le posent jamais.
    const tout = lignes().map((l) => `${l.libelle} ${l.detail}`).join(" ").toLowerCase();
    expect(tout).not.toContain("couplé");
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
