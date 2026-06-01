import { describe, it, expect } from "vitest";
import { isEliteDriver, isRecognizedTrainer } from "./reputation";

describe("reputation", () => {
  it("reconnaît un grand driver (sous-chaîne, insensible casse)", () => {
    expect(isEliteDriver("J.M. BAZIRE")).toBe(true);
    expect(isEliteDriver("M. Abrivard")).toBe(true);
    expect(isEliteDriver("Inconnu Dupont")).toBe(false);
    expect(isEliteDriver(null)).toBe(false);
    expect(isEliteDriver(undefined)).toBe(false);
    expect(isEliteDriver("")).toBe(false);
  });

  it("reconnaît un entraîneur reconnu", () => {
    expect(isRecognizedTrainer("A. Fabre")).toBe(true);
    expect(isRecognizedTrainer("Mme C. Head")).toBe(true);
    expect(isRecognizedTrainer("Personne Lambda")).toBe(false);
    expect(isRecognizedTrainer(null)).toBe(false);
  });
});
