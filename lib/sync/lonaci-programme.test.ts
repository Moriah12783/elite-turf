import { describe, it, expect } from "vitest";
import { augmentParisFromNationale } from "./lonaci-programme";

describe("augmentParisFromNationale — Nationale LONACI → paris Elite", () => {
  it("Nationale 1 → force QUINTE_PLUS (sinon la course vedette ne se détecte pas)", () => {
    // LONACI liste souvent QNC3=QUINTE (pas QNPC3=QUINTE_PLUS) sur une Nat.1.
    const r = augmentParisFromNationale(["QUINTE", "TIERCE"], 1);
    expect(r).toContain("QUINTE_PLUS");
    expect(r).toContain("TIERCE");
  });

  it("Nationale 2 → QUARTE_PLUS ; Nationale 3 → TIERCE", () => {
    expect(augmentParisFromNationale([], 2)).toContain("QUARTE_PLUS");
    expect(augmentParisFromNationale([], 3)).toContain("TIERCE");
  });

  it("course normale (nationale 0) → paris inchangés, aucun QUINTE_PLUS forcé", () => {
    const r = augmentParisFromNationale(["SIMPLE_GAGNANT"], 0);
    expect(r).not.toContain("QUINTE_PLUS");
    expect(r).toContain("SIMPLE_GAGNANT");
  });

  it("dédoublonne (QUINTE_PLUS déjà présent → une seule occurrence)", () => {
    const r = augmentParisFromNationale(["QUINTE_PLUS", "QUINTE_PLUS"], 1);
    expect(r.filter((p) => p === "QUINTE_PLUS").length).toBe(1);
  });
});
