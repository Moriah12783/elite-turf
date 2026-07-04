import { describe, it, expect } from "vitest";
import { normalizeLonaciPartant } from "./lonaci-partants";

describe("normalizeLonaciPartant — partant LONACI → forme GenyParticipant", () => {
  it("mappe nom, driver (jocker), entraîneur (coach), cote LIVE, corde", () => {
    const p = normalizeLonaciPartant({
      numero: "1", nom_partant: "INSTALL D'ALOUETTE", jocker: "g. gelormini",
      coach: "A. CHAVATTE", currentCotes: "12.5", corde: "1", sexe: "H", status: "Partant",
    });
    expect(p).not.toBeNull();
    expect(p!.numPmu).toBe(1);
    expect(p!.nom).toBe("INSTALL D'ALOUETTE");
    expect(p!.jockey?.nom).toBe("g. gelormini");
    expect(p!.entraineur?.nom).toBe("A. CHAVATTE");
    expect(p!.coteProbable).toBe(12.5);
    expect(p!.placeCorde).toBe(1);
    expect(p!.nonPartant).toBe(false);
  });

  it("status ≠ 'Partant' → nonPartant = true (cheval rayé)", () => {
    const p = normalizeLonaciPartant({ numero: "8", nom_partant: "IRENO DES PLAINES", status: "Non partant", currentCotes: "1.2" });
    expect(p!.nonPartant).toBe(true);
  });

  it("cote absente ou 0 → coteProbable undefined (aucune fabrication)", () => {
    expect(normalizeLonaciPartant({ numero: "5", nom_partant: "X", currentCotes: "" })!.coteProbable).toBeUndefined();
    expect(normalizeLonaciPartant({ numero: "5", nom_partant: "X", currentCotes: "0" })!.coteProbable).toBeUndefined();
  });

  it("cote avec virgule décimale → parsée", () => {
    expect(normalizeLonaciPartant({ numero: "3", nom_partant: "Y", currentCotes: "8,2" })!.coteProbable).toBe(8.2);
  });

  it("numéro non entier ou nom vide ou objet nul → null", () => {
    expect(normalizeLonaciPartant({ numero: "abc", nom_partant: "X" })).toBeNull();
    expect(normalizeLonaciPartant({ numero: "1", nom_partant: "" })).toBeNull();
    expect(normalizeLonaciPartant(null)).toBeNull();
  });
});
