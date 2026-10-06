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

  it("offre alignée sur les pronostics publiés (06/10/2026) : 8 chevaux pour tous, plan de jeu Elite en 6", () => {
    // Publié chaque jour depuis le 26/09 : PRO = 8 chevaux (Starter, Pro et
    // Elite le lisent), ELITE = 6 chevaux (base de 3 + values), toujours pris
    // parmi les 8 du PRO.
    const expert = lignes().find((l) => l.id === "pronostic-expert")!;
    expect(expert.detail).toContain("8 chevaux");
    const plan = lignes().find((l) => l.id === "plan-de-jeu-elite")!;
    expect(plan.libelle).toBe("Le plan de jeu Elite");
    for (const element of ["6 chevaux", "base de 3", "champ réduit ou total", "values"]) {
      expect(plan.detail).toContain(element);
    }
    // Le plan de jeu n'est annoncé nulle part ailleurs que sur sa propre ligne.
    const autres = lignes().filter((l) => l.id !== "plan-de-jeu-elite").map((l) => `${l.libelle} ${l.detail}`).join(" ").toLowerCase();
    expect(autres).not.toContain("plan de jeu");
  });

  it("garde-fou : rien d'annoncé qui ne soit publié (ni couplé, ni associés)", () => {
    // Décision de Steph du 06/10/2026 : jamais cochés dans un pronostic publié,
    // donc retirés de l'offre. À remettre seulement quand ils seront publiés.
    const tout = lignes().map((l) => `${l.libelle} ${l.detail}`).join(" ").toLowerCase();
    expect(tout).not.toContain("couplé");
    expect(tout).not.toContain("associé");
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
