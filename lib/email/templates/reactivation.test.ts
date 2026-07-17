import { describe, it, expect } from "vitest";
import { templateReactivation } from "./reactivation";

describe("templateReactivation", () => {
  it("insère le prénom et les liens connexion + réinitialisation", () => {
    const { subject, html } = templateReactivation({ prenom: "Modou" });
    expect(subject).toContain("activé");
    expect(html).toContain("Bonne nouvelle, Modou");
    expect(html).toContain("/connexion");
    expect(html).toContain("/mot-de-passe-oublie");
    expect(html).toContain("ELITE TURF");
  });

  it("retombe sur « Turfiste » si le prénom est vide", () => {
    const { html } = templateReactivation({ prenom: "" });
    expect(html).toContain("Bonne nouvelle, Turfiste");
  });
});
