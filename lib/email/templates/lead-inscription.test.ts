import { describe, it, expect } from "vitest";
import { templateLeadUpgradeJ2 } from "./lead-upgrade-j2";
import { templateLeadProofJ5 } from "./lead-proof-j5";

/**
 * Verrouille la correction du 25/08/2026 : 107 prospects sur 163 (66 %)
 * n'avaient jamais créé de compte, et AUCUNE relance ne le leur proposait —
 * elles pointaient uniquement vers /abonnements et /performances.
 */
const BASE = { prenom: "Ahmadou", unsubscribeUrl: "https://www.elite-turf.fr/stop?t=x" };

describe("relances lead — invitation à créer un compte", () => {
  it("J2 propose l'inscription, avec l'e-mail pré-rempli", () => {
    const { html } = templateLeadUpgradeJ2({ ...BASE, email: "ahmadou@example.com" });
    expect(html).toContain("/inscription?email=ahmadou%40example.com");
    expect(html).toContain("Créer mon compte gratuit");
  });

  it("J5 propose l'inscription, avec l'e-mail pré-rempli", () => {
    const { html } = templateLeadProofJ5({ ...BASE, email: "ahmadou@example.com" });
    expect(html).toContain("/inscription?email=ahmadou%40example.com");
    expect(html).toMatch(/Cr[ée]ez-le gratuitement/);
  });

  // L'e-mail est optionnel : un lead sans adresse exploitable ne doit pas
  // produire un lien cassé du type « /inscription?email=undefined ».
  it("sans e-mail, le lien reste propre", () => {
    for (const html of [
      templateLeadUpgradeJ2(BASE).html,
      templateLeadProofJ5(BASE).html,
    ]) {
      expect(html).toContain("/inscription");
      expect(html).not.toContain("email=undefined");
      expect(html).not.toContain("?email=\"");
    }
  });

  it("encode les adresses à caractères spéciaux", () => {
    const { html } = templateLeadUpgradeJ2({ ...BASE, email: "a+b@ex.fr" });
    expect(html).toContain("email=a%2Bb%40ex.fr");
  });

  // La relance J2 garde son chemin d'origine vers les formules : on AJOUTE une
  // porte, on n'en ferme aucune.
  it("J2 conserve le lien vers les formules", () => {
    const { html } = templateLeadUpgradeJ2({ ...BASE, email: "x@y.fr" });
    expect(html).toContain("/abonnements");
  });
});
