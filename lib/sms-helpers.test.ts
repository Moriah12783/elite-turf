import { describe, it, expect } from "vitest";
import { normalizeE164 } from "./sms-helpers";

describe("normalizeE164 — normalisation pays-aware (bug SMS 14/06)", () => {
  it("entrée vide → chaîne vide", () => {
    expect(normalizeE164("")).toBe("");
    expect(normalizeE164(null)).toBe("");
    expect(normalizeE164(undefined)).toBe("");
  });

  it("numéro déjà E.164 → conservé (nettoyé)", () => {
    expect(normalizeE164("+22670233151")).toBe("+22670233151");
    expect(normalizeE164("+226 70 23 31 51", "Burkina Faso")).toBe("+22670233151");
  });

  it("Maroc : numéro LOCAL → +212 (cas qui échouait : 0 SMS reçu)", () => {
    expect(normalizeE164("0766044140", "Maroc")).toBe("+212766044140");
    expect(normalizeE164("766044140", "Maroc")).toBe("+212766044140");
    expect(normalizeE164("06 26 04 41 40", "Maroc")).toBe("+212626044140");
  });

  it("Maroc : 0 d'appel national parasite après l'indicatif → retiré", () => {
    expect(normalizeE164("+212 0766044140", "Maroc")).toBe("+212766044140");
    expect(normalizeE164("2120766044140", "Maroc")).toBe("+212766044140");
  });

  it("France : numéro local → +33", () => {
    expect(normalizeE164("0780650949", "France")).toBe("+33780650949");
    expect(normalizeE164("780650949", "France")).toBe("+33780650949");
  });

  it("Burkina : numéro local → +226 (marchait déjà via +226, ici sans préfixe)", () => {
    expect(normalizeE164("70233151", "Burkina Faso")).toBe("+22670233151");
    expect(normalizeE164("070233151", "Burkina Faso")).toBe("+22670233151");
  });

  it("Côte d'Ivoire : numéro local → +225", () => {
    expect(normalizeE164("0700000000", "Côte d'Ivoire")).toBe("+225700000000");
  });

  it("préfixe d'appel international 00 → +", () => {
    expect(normalizeE164("0022670233151")).toBe("+22670233151");
  });

  it("pays inconnu / Autre : best-effort (préfixe + sur les chiffres)", () => {
    expect(normalizeE164("+33780650949", "Autre")).toBe("+33780650949");
    expect(normalizeE164("780650949")).toBe("+780650949"); // legacy, sans pays
  });
});
