import { describe, it, expect } from "vitest";
import { templatePaiementEchoue } from "./paiement-echoue";

describe("templatePaiementEchoue", () => {
  it("sujet + html avec prénom, CTA /abonnements et 'aucun montant'", () => {
    const { subject, html } = templatePaiementEchoue({
      nomComplet: "Hamza Hara",
      email: "hamza@example.com",
      planNom: "Elite",
      montantEur: 65,
    });
    expect(subject).toContain("n'a pas abouti");
    expect(html).toContain("Hamza");
    expect(html).toContain("/abonnements");
    expect(html).toContain("aucun montant");
    expect(html).toContain("Plan Elite");
  });

  it("masque le récap sans plan ni montant", () => {
    const { html } = templatePaiementEchoue({ nomComplet: "Test User", email: "t@e.fr" });
    expect(html).not.toContain("Abonnement choisi");
  });
});
