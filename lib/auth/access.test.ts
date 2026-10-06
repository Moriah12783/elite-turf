import { describe, expect, it } from "vitest";
import { canAccess, plusHautAccessible } from "./access";

const TOUS_ABONNEMENTS = ["GRATUIT", "STARTER", "PRO", "ELITE", "EXPIRE"];

describe("canAccess() — modèle freemium en escalier", () => {
  it("GRATUIT : visible par tous (y compris non connecté / expiré)", () => {
    for (const sub of TOUS_ABONNEMENTS) {
      expect(canAccess("GRATUIT", sub)).toBe(true);
    }
  });

  it("PRO : accessible aux abonnés STARTER, PRO et ELITE", () => {
    expect(canAccess("PRO", "STARTER")).toBe(true);
    expect(canAccess("PRO", "PRO")).toBe(true);
    expect(canAccess("PRO", "ELITE")).toBe(true);
  });

  it("PRO : refusé aux non-abonnés (gratuit / expiré)", () => {
    expect(canAccess("PRO", "GRATUIT")).toBe(false);
    expect(canAccess("PRO", "EXPIRE")).toBe(false);
  });

  it("ELITE : réservé aux abonnés ELITE — un PRO ne voit PAS l'ELITE", () => {
    expect(canAccess("ELITE", "ELITE")).toBe(true);
    expect(canAccess("ELITE", "PRO")).toBe(false);
    expect(canAccess("ELITE", "STARTER")).toBe(false);
    expect(canAccess("ELITE", "GRATUIT")).toBe(false);
    expect(canAccess("ELITE", "EXPIRE")).toBe(false);
  });

  it("STARTER (niveau) : accessible STARTER/PRO/ELITE, refusé gratuit/expiré", () => {
    expect(canAccess("STARTER", "STARTER")).toBe(true);
    expect(canAccess("STARTER", "PRO")).toBe(true);
    expect(canAccess("STARTER", "ELITE")).toBe(true);
    expect(canAccess("STARTER", "GRATUIT")).toBe(false);
    expect(canAccess("STARTER", "EXPIRE")).toBe(false);
  });

  it("ELITE voit tout (matrice complète d'un abonné ELITE)", () => {
    for (const niveau of ["GRATUIT", "STARTER", "PRO", "ELITE"]) {
      expect(canAccess(niveau, "ELITE")).toBe(true);
    }
  });

  it("niveau inconnu / vide → refus par défaut (fail-closed)", () => {
    expect(canAccess("MYSTERE", "ELITE")).toBe(false);
    expect(canAccess("", "ELITE")).toBe(false);
  });
});

describe("plusHautAccessible() — le pronostic à montrer quand une course en a plusieurs", () => {
  // Depuis le 02/10/2026, chaque Quinté+ porte un pronostic ELITE et un PRO.
  const ELITE = { id: "elite", niveau_acces: "ELITE" };
  const PRO = { id: "pro", niveau_acces: "PRO" };
  const GRATUIT = { id: "gratuit", niveau_acces: "GRATUIT" };

  it("abonné PRO : passe l'ELITE verrouillé pour montrer le PRO", () => {
    expect(plusHautAccessible([ELITE, PRO], "PRO")).toBe(PRO);
    expect(plusHautAccessible([ELITE, PRO], "STARTER")).toBe(PRO);
  });

  it("abonné ELITE : son pronostic ELITE, quel que soit l'ordre de publication", () => {
    // En production, le PRO est publié quelques secondes APRÈS l'ELITE : trié
    // du plus récent au plus ancien, il arrive en tête. L'abonné Elite doit
    // pourtant voir SON pronostic, pas le PRO avec d'autres rôles.
    expect(plusHautAccessible([PRO, ELITE], "ELITE")).toBe(ELITE);
    expect(plusHautAccessible([ELITE, PRO], "ELITE")).toBe(ELITE);
  });

  it("à niveau égal, l'ordre reçu départage", () => {
    const PRO_BIS = { id: "pro-bis", niveau_acces: "PRO" };
    expect(plusHautAccessible([PRO, PRO_BIS], "PRO")).toBe(PRO);
    expect(plusHautAccessible([GRATUIT, PRO_BIS, PRO], "ELITE")).toBe(PRO_BIS);
  });

  it("visiteur : le premier de la liste, qui s'affiche verrouillé — comme avant", () => {
    expect(plusHautAccessible([ELITE, PRO], "GRATUIT")).toBe(ELITE);
    expect(plusHautAccessible([PRO, ELITE], "EXPIRE")).toBe(PRO);
  });

  it("visiteur face à un pronostic gratuit : le gratuit, qu'il peut lire", () => {
    expect(plusHautAccessible([PRO, GRATUIT], "GRATUIT")).toBe(GRATUIT);
  });

  it("liste vide ou absente → null", () => {
    expect(plusHautAccessible([], "PRO")).toBeNull();
    expect(plusHautAccessible(null, "PRO")).toBeNull();
    expect(plusHautAccessible(undefined, "PRO")).toBeNull();
  });
});
