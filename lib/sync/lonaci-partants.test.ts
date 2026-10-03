import { describe, it, expect } from "vitest";
import {
  normalizeLonaciPartant, retirerCotesFactices, memeReunionLonaci,
  type LonaciPartant, type CourseLonaci,
} from "./lonaci-partants";

// Le 03/10/2026, la R9 LONACI (Settat, Maroc) remplissait notre R9
// (Beaumont-de-Lomagne, trot) de chevaux marocains.
describe("memeReunionLonaci — mêmes numéros, même réunion ?", () => {
  const settat: CourseLonaci = { hippodrome: "SETTAT", partants: [] };

  it("la R9 LONACI (Settat) n'est pas notre R9 Beaumont-de-Lomagne", () => {
    expect(memeReunionLonaci("Beaumont-de-Lomagne", settat)).toBe(false);
  });

  it("même hippodrome, écrit autrement (majuscules, tirets, préfixe)", () => {
    expect(memeReunionLonaci("Settat", settat)).toBe(true);
    expect(memeReunionLonaci("Saint-Cloud", { hippodrome: "SAINT CLOUD", partants: [] })).toBe(true);
    expect(memeReunionLonaci("Paris-Vincennes", { hippodrome: "VINCENNES", partants: [] })).toBe(true);
  });

  it("hippodrome inconnu d'un côté ou de l'autre : on ne prend pas le risque", () => {
    expect(memeReunionLonaci("Settat", { hippodrome: null, partants: [] })).toBe(false);
    expect(memeReunionLonaci(null, settat)).toBe(false);
  });
});

describe("retirerCotesFactices — le « 1,2 » LONACI n'est pas une cote", () => {
  const partant = (numPmu: number, coteProbable?: number, nonPartant = false): LonaciPartant =>
    ({ numPmu, nom: `CHEVAL ${numPmu}`, coteProbable, nonPartant });

  it("1,2 pour chaque cheval → plus aucune cote", () => {
    const course = Array.from({ length: 12 }, (_, i) => partant(i + 1, 1.2));
    expect(retirerCotesFactices(course).every((p) => p.coteProbable === undefined)).toBe(true);
  });

  it("vraies cotes → inchangées (même objet)", () => {
    const course = [partant(1, 2.5), partant(2, 4), partant(3, 7.5), partant(4, 12), partant(5, 1.2, true)];
    expect(retirerCotesFactices(course)).toBe(course);
  });

  it("le jugement ignore les non-partants", () => {
    const course = [partant(1, 1.2), partant(2, 1.2), partant(3, 1.2), partant(4, 1.2), partant(5, 9, true)];
    expect(retirerCotesFactices(course).every((p) => p.coteProbable === undefined)).toBe(true);
  });
});

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
