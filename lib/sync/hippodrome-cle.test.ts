import { describe, it, expect } from "vitest";
import { cleHippodrome, ALIAS_HIPPODROME } from "./hippodrome-cle";

describe("cleHippodrome — variations mécaniques", () => {
  it("ignore casse, accents et séparateurs", () => {
    expect(cleHippodrome("SAINT-CLOUD")).toBe(cleHippodrome("Saint-Cloud"));
    expect(cleHippodrome("Compiègne")).toBe(cleHippodrome("Compiegne"));
    expect(cleHippodrome("La Teste De Buch")).toBe(cleHippodrome("La Teste-de-Buch"));
  });

  it("décode les entités HTML", () => {
    expect(cleHippodrome("Le Lion-d&#039;Angers")).toBe(cleHippodrome("Le Lion-d'Angers"));
  });

  // Cas réel du 04/08/2026 : la source suffixe les réunions du matin, ce qui
  // créait un hippodrome fantôme « Aix-les-Bains [Matinée] » de 18 courses.
  it("ignore un suffixe entre crochets", () => {
    expect(cleHippodrome("Aix-les-Bains [Matinée]")).toBe(cleHippodrome("Aix-les-Bains"));
    expect(cleHippodrome("Enghien [Matinée]")).toBe(cleHippodrome("Enghien"));
    expect(cleHippodrome("Châtelaillon-La Rochelle [Matinée]"))
      .toBe(cleHippodrome("Châtelaillon-La Rochelle"));
  });

  // Cas réel du 03/08/2026 : deux sources nommaient le même hippodrome dans
  // l'ordre inverse, d'où 12 courses en double.
  it("ignore l'ordre des mots", () => {
    expect(cleHippodrome("Deauville-Clairefontaine")).toBe(cleHippodrome("Clairefontaine-Deauville"));
  });

  it("ne confond pas deux hippodromes réellement distincts", () => {
    expect(cleHippodrome("Deauville")).not.toBe(cleHippodrome("Clairefontaine-Deauville"));
    expect(cleHippodrome("Vichy")).not.toBe(cleHippodrome("Vincennes"));
    // Piège d'inclusion : un fragment court ne doit jamais absorber un nom long.
    expect(cleHippodrome("Aix")).not.toBe(cleHippodrome("Aix-les-Bains"));
  });

  it("tolère les entrées vides", () => {
    expect(cleHippodrome("")).toBe("");
    expect(cleHippodrome(null as unknown as string)).toBe("");
  });
});

describe("cleHippodrome — alias déclarés", () => {
  // Ce que la syntaxe ne peut PAS trancher : « Deauville-La Touques » est le
  // même hippodrome que « Deauville », mais « Deauville-Clairefontaine » est
  // un AUTRE champ de courses, à deux kilomètres. Aucune règle mécanique ne
  // distingue les deux — d'où une table d'alias explicite, relue par un humain.
  it("rapproche les noms que seule la connaissance métier peut unir", () => {
    expect(cleHippodrome("Deauville-La Touques")).toBe(cleHippodrome("Deauville"));
    expect(cleHippodrome("Deauville-La-Touques")).toBe(cleHippodrome("Deauville"));
    expect(cleHippodrome("Chatelaillon")).toBe(cleHippodrome("Châtelaillon-La Rochelle"));
  });

  it("n'applique un alias qu'après normalisation, donc quelle que soit la graphie", () => {
    expect(cleHippodrome("DEAUVILLE-LA-TOUQUES [Matinée]")).toBe(cleHippodrome("Deauville"));
  });

  it("expose la table pour qu'elle reste relisible", () => {
    expect(Object.keys(ALIAS_HIPPODROME).length).toBeGreaterThan(0);
    // Un alias ne doit jamais pointer vers lui-même (boucle silencieuse).
    for (const [de, vers] of Object.entries(ALIAS_HIPPODROME)) expect(de).not.toBe(vers);
  });
});
