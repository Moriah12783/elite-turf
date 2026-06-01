import { describe, it, expect } from "vitest";
import { canonicalHippodrome } from "./hippodrome-canonical";

describe("canonicalHippodrome", () => {
  it("rapproche les variantes casse/tirets/espaces", () => {
    expect(canonicalHippodrome("SAINT-CLOUD")).toBe("saintcloud");
    expect(canonicalHippodrome("Saint-Cloud")).toBe("saintcloud");
    expect(canonicalHippodrome("La Teste De Buch")).toBe("latestedebuch");
    expect(canonicalHippodrome("La Teste-de-Buch")).toBe("latestedebuch");
  });
  it("retire les accents (LONACI sans accents = Geny avec accents)", () => {
    expect(canonicalHippodrome("Châteaubriant")).toBe("chateaubriant");
    expect(canonicalHippodrome("CHATEAUBRIANT")).toBe("chateaubriant");
    expect(canonicalHippodrome("Compiègne")).toBe("compiegne");
  });
  it("décode les entités HTML (apostrophe)", () => {
    expect(canonicalHippodrome("Le Lion D'angers")).toBe("leliondangers");
    expect(canonicalHippodrome("Le Lion-d&#039;Angers")).toBe("leliondangers");
  });
  it("renvoie vide pour entrée vide", () => {
    expect(canonicalHippodrome("")).toBe("");
  });
});
