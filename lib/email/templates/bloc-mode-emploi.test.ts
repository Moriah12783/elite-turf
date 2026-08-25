import { describe, it, expect } from "vitest";
import { blocModeEmploi } from "./bloc-mode-emploi";
import { templateConfirmationPack } from "./confirmation-pack";
import { templateConfirmationPaiement } from "./confirmation-paiement";

/**
 * Ces tests verrouillent DEUX ENGAGEMENTS pris envers l'abonné dans l'e-mail
 * d'activation. Ce ne sont pas des détails de style : les retirer changerait ce
 * qu'Elite Turf promet et conseille.
 */
describe("blocModeEmploi", () => {
  it("renvoie vers le mode d'emploi de l'espace abonné", () => {
    expect(blocModeEmploi).toContain("/espace-membre");
    expect(blocModeEmploi).toContain("Exploiter vos pronostics");
  });

  it("recommande le champ réduit ou complet", () => {
    expect(blocModeEmploi).toContain("champ réduit");
    expect(blocModeEmploi).toContain("champ complet");
    expect(blocModeEmploi).toContain("recommande");
  });

  // Le point le plus important : c'est une RECOMMANDATION, pas une consigne.
  // Un conseil de mise présenté comme une obligation engage bien davantage.
  it("laisse explicitement la décision à l'abonné", () => {
    expect(blocModeEmploi).toContain("le choix vous appartient");
    expect(blocModeEmploi).toMatch(/décision finale reste la vôtre/);
  });

  it("n'impose jamais une façon de miser", () => {
    expect(blocModeEmploi).not.toMatch(/vous devez jouer|il faut jouer|obligatoire/i);
  });
});

describe("le bloc est présent dans TOUS les e-mails d'activation", () => {
  const paliers = ["Starter", "Pro", "Elite"] as const;

  paliers.forEach((planNom) => {
    it(`confirmation-pack — palier ${planNom}`, () => {
      const { html } = templateConfirmationPack({
        nomComplet: "Ahmadou",
        email: "test@example.com",
        planNom,
        dateExpiration: "2026-09-01",
        nbAlertes: planNom === "Elite" ? -1 : planNom === "Pro" ? 20 : 5,
      });
      expect(html).toContain("Exploiter vos pronostics");
      expect(html).toContain("champ réduit");
      expect(html).toContain("le choix vous appartient");
    });
  });

  it("confirmation-paiement (activation par carte)", () => {
    const { html } = templateConfirmationPaiement({
      nomComplet: "Ahmadou",
      email: "test@example.com",
      planNom: "Elite",
      montantEur: 208,
      dateExpiration: "2026-09-01",
    });
    expect(html).toContain("Exploiter vos pronostics");
    expect(html).toContain("champ réduit");
    expect(html).toContain("le choix vous appartient");
  });
});
