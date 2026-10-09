import { describe, it, expect } from "vitest";
import { cleCheval, clePersonne, cleActeur, nettoyerNomActeur, choisirGraphie } from "./cles-acteurs";

// Graphies réelles relevées dans `partants` le 09/10/2026 (Geny, format PMU
// via LONACI, saisie admin) : une même clé = un même acteur.

describe("cleCheval", () => {
  it("ignore la casse, les accents et la ponctuation (= slug de la fiche)", () => {
    expect(cleCheval("Stan Le Grand")).toBe("stan-le-grand");
    expect(cleCheval("STAN LE GRAND")).toBe("stan-le-grand");
    expect(cleCheval("Hidalgo des Noés")).toBe(cleCheval("HIDALGO DES NOES"));
    expect(cleCheval("Jeek d'Acadie")).toBe("jeek-d-acadie");
  });
  it("ignore le glyphe privé Geny en fin de nom", () => {
    expect(cleCheval("Isla ")).toBe("isla");
  });
  it("garde le pays d'origine : « BELGIQUE (SWE) » n'est pas « Belgique »", () => {
    expect(cleCheval("BELGIQUE (SWE)")).not.toBe(cleCheval("Belgique"));
  });
  it("vide → chaîne vide", () => {
    expect(cleCheval("")).toBe("");
    expect(cleCheval(null)).toBe("");
  });
});

describe("clePersonne", () => {
  it("même personne quelle que soit la source", () => {
    expect(clePersonne("M. Barzalona")).toBe(clePersonne("M.BARZALONA"));
    expect(clePersonne("A. Lemaître")).toBe(clePersonne("A.LEMAITRE"));
    expect(clePersonne("Mme M. Scandella-Lacaille")).toBe(clePersonne("MME M.SCANDELLA-LACAILLE"));
  });
  it("initiales compactées par le PMU : « Pc.Boudot » = « P.-C. Boudot »", () => {
    expect(clePersonne("Pc.Boudot")).toBe(clePersonne("P.-C. Boudot"));
    expect(clePersonne("FH.GRAFFARD (S)")).toBe(clePersonne("F.-H. Graffard"));
    expect(clePersonne("D&P.PROD'HOMME (S)")).toBe(clePersonne("D. & P. Prod'homme"));
  });
  it("retire le poids collé au jockey par Geny", () => {
    expect(clePersonne("C. Demuro 57,5")).toBe(clePersonne("C. Demuro"));
    expect(clePersonne("A. Crastus 52")).toBe(clePersonne("A. Crastus"));
  });
  it("retire le statut PMU « (S) » (même entraîneur avec ou sans)", () => {
    expect(clePersonne("M.SEROR (S)")).toBe(clePersonne("M. Seror"));
  });
  it("garde « (T) » / « (G) » : ce sont des homonymes distincts", () => {
    const t = clePersonne("A. Leduc (T)");
    const g = clePersonne("A. Leduc (G)");
    expect(t).not.toBe(g);
    expect(t).not.toBe(clePersonne("A. Leduc"));
    // le suffixe ne se confond pas avec un nom qui finirait par la même lettre
    expect(t).not.toBe(clePersonne("A. Leduct"));
  });
  it("« Mme » fait partie du nom", () => {
    expect(clePersonne("Mme A. Clemenceau")).not.toBe(clePersonne("A. Clemenceau"));
  });
  it("vide → chaîne vide", () => {
    expect(clePersonne("")).toBe("");
    expect(clePersonne(null)).toBe("");
    expect(clePersonne("(G)")).toBe("");
  });
});

describe("cleActeur", () => {
  it("aiguille selon le type", () => {
    expect(cleActeur("chevaux", "Stan Le Grand")).toBe("stan-le-grand");
    expect(cleActeur("jockeys", "Pc.Boudot")).toBe(clePersonne("P.-C. Boudot"));
    expect(cleActeur("entraineurs", "M.SEROR (S)")).toBe(clePersonne("M. Seror"));
  });
});

describe("nettoyerNomActeur", () => {
  it("cheval : retire le glyphe privé et les espaces en trop", () => {
    expect(nettoyerNomActeur("chevaux", "Ad Debel ")).toBe("Ad Debel");
    expect(nettoyerNomActeur("chevaux", "Gran Habano ")).toBe("Gran Habano");
  });
  it("cheval : garde le pays d'origine", () => {
    expect(nettoyerNomActeur("chevaux", "BELGIQUE (SWE)")).toBe("BELGIQUE (SWE)");
  });
  it("personne : retire le poids et le statut PMU, garde (T)/(G)", () => {
    expect(nettoyerNomActeur("jockeys", "C. Demuro 57,5")).toBe("C. Demuro");
    expect(nettoyerNomActeur("entraineurs", "M.SEROR (S)")).toBe("M.SEROR");
    expect(nettoyerNomActeur("entraineurs", "A. Leduc (T)")).toBe("A. Leduc (T)");
  });
  it("ne change jamais la casse", () => {
    expect(nettoyerNomActeur("chevaux", "IZIO D'ECHAL")).toBe("IZIO D'ECHAL");
  });
});

describe("choisirGraphie (décision D1 de Steph, 09/10/2026)", () => {
  it("la casse mixte passe avant les majuscules, même moins fréquente", () => {
    expect(choisirGraphie("chevaux", [["STAN LE GRAND", 10], ["Stan Le Grand", 1]])).toBe("Stan Le Grand");
  });
  it("à défaut de casse mixte, la graphie telle quelle (pas de casse inventée)", () => {
    expect(choisirGraphie("chevaux", [["IZIO D'ECHAL", 3]])).toBe("IZIO D'ECHAL");
  });
  it("entre graphies mixtes, la plus fréquente", () => {
    expect(choisirGraphie("chevaux", [["Izio d'echal", 1], ["Izio d'Echal", 4], ["IZIO D'ECHAL", 9]])).toBe("Izio d'Echal");
  });
  it("compte ensemble les graphies identiques une fois nettoyées", () => {
    // 5 + 4 « Isla » (glyphes) dépassent les 6 « Isla »… mais c'est la même graphie
    expect(choisirGraphie("chevaux", [["Isla ", 5], ["Isla ", 4], ["Isla", 6], ["ISLA", 20]])).toBe("Isla");
    expect(choisirGraphie("jockeys", [["C. Demuro 57,5", 50], ["C. Demuro 56", 40], ["C. Demuro", 30], ["C.DEMURO", 60]]))
      .toBe("C. Demuro");
  });
  it("à égalité de fréquence, la graphie la plus riche (accents, ponctuation)", () => {
    expect(choisirGraphie("jockeys", [["B O'Neill", 1], ["B. O'Neill", 1]])).toBe("B. O'Neill");
    expect(choisirGraphie("jockeys", [["A. Lemaitre", 2], ["A. Lemaître", 2]])).toBe("A. Lemaître");
  });
  it("égalité parfaite : résultat stable quel que soit l'ordre d'entrée", () => {
    const a = choisirGraphie("chevaux", [["Izio d'echal", 2], ["Izio d'Echal", 2]]);
    const b = choisirGraphie("chevaux", [["Izio d'Echal", 2], ["Izio d'echal", 2]]);
    expect(a).toBe(b);
  });
  it("aucune graphie exploitable → chaîne vide", () => {
    expect(choisirGraphie("chevaux", [])).toBe("");
    expect(choisirGraphie("chevaux", [["  ", 3]])).toBe("");
  });
});
