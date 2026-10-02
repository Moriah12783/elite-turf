import { describe, it, expect } from "vitest";
import { niveauConfiance } from "./confiance";

describe("niveauConfiance — niveau stocké en texte → libellé et étoiles", () => {
  it("lit les 4 niveaux (étoiles sur 4)", () => {
    expect(niveauConfiance("FAIBLE")).toEqual({ label: "Faible", etoiles: 1, max: 4 });
    expect(niveauConfiance("MOYEN")).toEqual({ label: "Moyen", etoiles: 2, max: 4 });
    expect(niveauConfiance("ELEVE")).toEqual({ label: "Élevé", etoiles: 3, max: 4 });
    expect(niveauConfiance("TRES_ELEVE")).toEqual({ label: "Très élevé", etoiles: 4, max: 4 });
  });

  it("valeur inconnue ou absente → null (jamais « ELEVE/5 »)", () => {
    expect(niveauConfiance(null)).toBeNull();
    expect(niveauConfiance(undefined)).toBeNull();
    expect(niveauConfiance("5")).toBeNull();
    expect(niveauConfiance("")).toBeNull();
  });
});
