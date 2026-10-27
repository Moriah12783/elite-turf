import { describe, it, expect } from "vitest";
import { templateRappelExpiration, prixRappel, nomPackRappel, pertesRappel } from "./rappel-expiration";
import { PLAN_CONFIG, type Plan } from "@/types";
import { PLAN_DE_JEU_ELITE, PRO_OFFRE_LABEL } from "@/lib/pricing";

const plan = (id: string) => PLAN_CONFIG.find((p) => p.id === id) as Plan;
const espaces = (t: string) => t.replace(/[  ]/g, " ");
const rappel = (p: Plan | null, joursRestants = 3) =>
  templateRappelExpiration({ nomComplet: "Salif Ouedraogo", email: "abonne@exemple.com", plan: p, dateFin: "2026-10-23", joursRestants });

describe("rappel d'expiration : la formule et le prix de l'abonné, jamais « Plan Pro à 9,90 € »", () => {
  it("Elite : Pack Elite, 208 € / 30 jours, en FCFA, et le plan de jeu Elite", () => {
    const { subject, html } = rappel(plan("elite"), 2);
    const h = espaces(html);
    expect(h).toContain("Pack Elite");
    expect(h).toContain("208 € / 30 jours (136 500 FCFA)");
    expect(h).toContain(PLAN_DE_JEU_ELITE);
    expect(subject).toBe("⏰ Plus que 2 jours — Renouvelez votre Pack Elite");
    expect(h).not.toMatch(/9,90|Plan Pro|€\/mois|Pronostics Pro &amp; Elite|Pronostics Pro & Elite/);
  });

  it("Pro : Pack Pro, 152 € / 30 jours, sans le plan de jeu Elite", () => {
    const h = espaces(rappel(plan("pro")).html);
    expect(h).toContain("Pack Pro");
    expect(h).toContain("152 € / 30 jours (99 500 FCFA)");
    expect(h).toContain(PRO_OFFRE_LABEL);
    expect(h).not.toContain("plan de jeu Elite");
  });

  it("Starter : 65 € / 7 jours", () => {
    expect(prixRappel(plan("starter"))).toMatch(/^65 € \/ 7 jours \(42[\s  ]500 FCFA\)$/);
  });

  it("formule inconnue : ni nom de formule ni prix", () => {
    const { subject, html } = rappel(null, 2);
    expect(nomPackRappel(null)).toBeNull();
    expect(prixRappel(null)).toBeNull();
    expect(html).toContain("Renouvelez votre abonnement en quelques clics");
    expect(html).not.toMatch(/Pack |€|FCFA|9,90/);
    expect(subject).toBe("⏰ Plus que 2 jours — Renouvelez votre accès Elite Turf");
    expect(pertesRappel(null)[0]).toBe("Vos pronostics experts du jour");
  });
});
