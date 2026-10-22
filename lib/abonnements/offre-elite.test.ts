import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { PLAN_DE_JEU_ELITE } from "../pricing";
import { PLAN_CONFIG } from "../../types";

/**
 * Garde-fou de l'offre Elite (décision de Steph du 16/10/2026) : le plan de jeu
 * Elite = 8 chevaux, la base de 4, les values et les associés. L'ancienne offre
 * (« 6 chevaux, avec la base de 3 chevaux et les values ») ne doit plus être
 * annoncée nulle part : un abonné recevrait autre chose que ce qu'on lui vend.
 */
const TEXTES_OFFRE = [
  "app/(public)/abonnements/page.tsx",
  "app/(public)/pronostics/page.tsx",
  "app/(public)/espace-membre/mon-roi/page.tsx",
  "components/home/FAQSection.tsx",
  "components/pronostics/PaywallBanner.tsx",
  "lib/abonnements/comparatif.ts",
  "lib/email/templates/welcome-series-j1.ts",
  "lib/pricing.ts",
  "types/index.ts",
];

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

/** Le texte hors commentaires : l'historique de l'offre y reste cité. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("offre Elite : plan de jeu en 8 chevaux, base de 4", () => {
  it("la phrase officielle", () => {
    expect(PLAN_DE_JEU_ELITE).toBe("8 chevaux, avec la base de 4 chevaux pour le champ réduit ou total, les values et les associés");
    expect(PLAN_DE_JEU_ELITE.toLowerCase()).not.toContain("couplé");
  });

  it("aucun texte d'offre n'annonce la base de 3 ni un plan de jeu en 6 chevaux", () => {
    for (const chemin of TEXTES_OFFRE) {
      const texte = sansCommentaires(lire(chemin)).toLowerCase();
      expect(texte, chemin).not.toContain("base de 3");
      expect(texte, chemin).not.toMatch(/plan de jeu[^.\n"`]{0,40}6 chevaux/);
    }
  });

  it("les cartes de l'offre Elite (PLAN_CONFIG) : 8 chevaux, base de 4, values et associés ; description Stripe inchangée", () => {
    const elite = PLAN_CONFIG.find((p) => p.id === "elite")!;
    const features = elite.features.join(" | ");
    expect(features).toContain("Le plan de jeu Elite chaque jour : 8 chevaux");
    expect(features).toContain("La base de 4 chevaux pour le champ réduit ou total");
    expect(features).toContain("Les values et les associés");
    expect(features.toLowerCase()).not.toContain("couplé");
    expect(elite.description).toBe("La sélection dans la sélection");
  });

  it("les surfaces d'offre lisent la phrase officielle (aucune copie en dur)", () => {
    for (const chemin of TEXTES_OFFRE.filter((c) => c !== "lib/pricing.ts" && c !== "types/index.ts")) {
      expect(lire(chemin), chemin).toContain("PLAN_DE_JEU_ELITE");
    }
  });
});
