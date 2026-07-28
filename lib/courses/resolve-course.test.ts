import { describe, it, expect } from "vitest";
import {
  resoudreCourseUnique,
  memeHippodrome,
  signatureHippodrome,
} from "./resolve-course";

describe("signatureHippodrome", () => {
  it("neutralise accents, casse et séparateurs", () => {
    expect(signatureHippodrome("Châtelaillon-La Rochelle"))
      .toBe(signatureHippodrome("chatelaillon la rochelle"));
    expect(signatureHippodrome("Compiègne")).toBe(signatureHippodrome("Compiegne"));
    expect(signatureHippodrome("Le Mont-Saint-Michel")).toBe(signatureHippodrome("Le Mont Saint Michel"));
  });

  it("tolère null et vide", () => {
    expect(signatureHippodrome(null)).toBe("");
    expect(signatureHippodrome(undefined)).toBe("");
  });
});

describe("memeHippodrome", () => {
  it("reconnaît les variantes de graphie", () => {
    expect(memeHippodrome("Compiegne", "Compiègne")).toBe(true);
    expect(memeHippodrome("Saint Malo", "Saint-Malo")).toBe(true);
  });

  it("reconnaît l'inclusion", () => {
    expect(memeHippodrome("Deauville", "Deauville-La Touques")).toBe(true);
    expect(memeHippodrome("Pornichet", "Pornichet-La Baule")).toBe(true);
  });

  it("distingue deux hippodromes réellement différents", () => {
    // Cas réel du 26/07 : deux réunions distinctes, toutes deux « R8 ».
    expect(memeHippodrome("Karukéra", "Avignon")).toBe(false);
    expect(memeHippodrome("Graignes", "Reims")).toBe(false);
  });

  it("refuse de conclure sur un fragment trop court", () => {
    expect(memeHippodrome("Aix", "Aix-les-Bains")).toBe(false);
    expect(memeHippodrome("", "Deauville")).toBe(false);
  });
});

describe("resoudreCourseUnique", () => {
  const karukera = { id: "k", hippodrome_nom: "Karukéra" };
  const avignon  = { id: "a", hippodrome_nom: "Avignon" };

  it("renvoie la course quand elle est unique", () => {
    const r = resoudreCourseUnique([karukera]);
    expect(r.statut).toBe("TROUVEE");
    if (r.statut === "TROUVEE") expect(r.course.id).toBe("k");
  });

  it("renvoie ABSENTE sur liste vide, null ou undefined", () => {
    expect(resoudreCourseUnique([]).statut).toBe("ABSENTE");
    expect(resoudreCourseUnique(null).statut).toBe("ABSENTE");
    expect(resoudreCourseUnique(undefined).statut).toBe("ABSENTE");
  });

  it("NE DEVINE PAS quand plusieurs courses partagent la clé", () => {
    // Le cas dangereux : `.limit(1)` aurait pris Karukéra au hasard.
    const r = resoudreCourseUnique([karukera, avignon]);
    expect(r.statut).toBe("AMBIGUE");
    if (r.statut === "AMBIGUE") expect(r.candidats).toHaveLength(2);
  });

  it("départage grâce à l'hippodrome fourni par l'appelant", () => {
    const r = resoudreCourseUnique([karukera, avignon], "Avignon");
    expect(r.statut).toBe("TROUVEE");
    if (r.statut === "TROUVEE") expect(r.course.id).toBe("a");
  });

  it("départage malgré une graphie différente", () => {
    const r = resoudreCourseUnique(
      [{ id: "1", hippodrome_nom: "Châtelaillon-La Rochelle" }, { id: "2", hippodrome_nom: "Reims" }],
      "chatelaillon la rochelle",
    );
    expect(r.statut).toBe("TROUVEE");
    if (r.statut === "TROUVEE") expect(r.course.id).toBe("1");
  });

  it("reste AMBIGUE si l'indice ne désigne aucune candidate", () => {
    expect(resoudreCourseUnique([karukera, avignon], "Vincennes").statut).toBe("AMBIGUE");
  });

  it("reste AMBIGUE si l'indice en désigne plusieurs", () => {
    const r = resoudreCourseUnique(
      [{ id: "1", hippodrome_nom: "Deauville" }, { id: "2", hippodrome_nom: "Deauville-La Touques" }],
      "Deauville",
    );
    expect(r.statut).toBe("AMBIGUE");
  });

  it("ignore les entrées sans id", () => {
    const r = resoudreCourseUnique([{ id: "", hippodrome_nom: "X" } as any, karukera]);
    expect(r.statut).toBe("TROUVEE");
  });
});
