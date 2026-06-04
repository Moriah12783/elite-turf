import { describe, expect, it } from "vitest";
import { canAccess } from "./access";

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
