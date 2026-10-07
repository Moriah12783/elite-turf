import { describe, it, expect } from "vitest";
import { minutesAvantDepart, dansFenetre, dernierPassage, gardeFous, situer, type EtatDuJour } from "./fenetre";
import { parisVersUtc } from "@/lib/paris-date";

const DEPART = parisVersUtc("2026-10-07", "13:55:00")!;
const a = (iso: string) => Date.parse(iso);

describe("fenêtre des brouillons : de 95 à 60 minutes avant le départ", () => {
  it("Quinté+ du 07/10 : 13h55 à Paris = 11h55 UTC", () => {
    expect(DEPART.toISOString()).toBe("2026-10-07T11:55:00.000Z");
  });

  it("bornes 95 et 60 incluses", () => {
    expect(dansFenetre(minutesAvantDepart(DEPART, a("2026-10-07T10:20:00Z")))).toBe(true);  // 95
    expect(dansFenetre(minutesAvantDepart(DEPART, a("2026-10-07T10:19:59Z")))).toBe(false); // 95,02
    expect(dansFenetre(minutesAvantDepart(DEPART, a("2026-10-07T10:55:00Z")))).toBe(true);  // 60
    expect(dansFenetre(minutesAvantDepart(DEPART, a("2026-10-07T10:55:01Z")))).toBe(false); // 59,98
  });

  it("dernier passage sous 65 minutes", () => {
    expect(dernierPassage(64.9)).toBe(true);
    expect(dernierPassage(65)).toBe(false);
    expect(dernierPassage(null)).toBe(false);
  });

  it("départ inconnu → hors fenêtre", () => {
    expect(minutesAvantDepart(null)).toBeNull();
    expect(dansFenetre(null)).toBe(false);
  });

  it("heure d'hiver (25/10/2026) : 13h55 à Paris = 12h55 UTC", () => {
    const hiver = parisVersUtc("2026-10-25", "13:55:00")!;
    expect(hiver.toISOString()).toBe("2026-10-25T12:55:00.000Z");
    expect(dansFenetre(minutesAvantDepart(hiver, a("2026-10-25T11:25:00Z")))).toBe(true); // 90
  });
});

describe("situer : où en est-on par rapport au départ ?", () => {
  it("heure de départ illisible → heure inconnue, pas une erreur (sinon une alerte toutes les 5 min)", () => {
    expect(situer(parisVersUtc("2026-10-07", ""))).toEqual({ etat: "heure_inconnue" });
    expect(situer(null)).toEqual({ etat: "heure_inconnue" });
  });

  it("dans la fenêtre, avant, après", () => {
    expect(situer(DEPART, a("2026-10-07T10:25:00Z"))).toEqual({ etat: "dans_fenetre", minutes: 90 });
    expect(situer(DEPART, a("2026-10-07T09:00:00Z"))).toEqual({ etat: "hors_fenetre", minutes: 175 });
    expect(situer(DEPART, a("2026-10-07T12:00:00Z"))).toEqual({ etat: "hors_fenetre", minutes: -5 });
  });
});

describe("gardeFous (spec §4 et §10)", () => {
  const vide: EtatDuJour = { existants: [], pretsEnvoye: false, echecEnvoye: false };
  const ligne = (id: string, niveau_acces: string, publie: boolean, source: string | null) => ({ id, niveau_acces, publie, source });

  it("rien en base, rien envoyé → préparer", () => {
    expect(gardeFous(vide)).toEqual({ action: "preparer" });
  });

  it("un PRO ou un ELITE déjà publié à la main → arrêt", () => {
    expect(gardeFous({ ...vide, existants: [ligne("x", "PRO", true, null)] })).toEqual({ action: "arreter", raison: "deja_publie" });
    expect(gardeFous({ ...vide, existants: [ligne("x", "ELITE", true, "ADMIN")] })).toEqual({ action: "arreter", raison: "deja_publie" });
  });

  it("un brouillon manuel ou un GRATUIT publié ne bloquent pas", () => {
    expect(gardeFous({ ...vide, existants: [ligne("x", "PRO", false, null), ligne("y", "GRATUIT", true, null)] })).toEqual({ action: "preparer" });
  });

  it("brouillons AUTO-MARCHE déjà là → déjà préparé, avec leurs identifiants", () => {
    expect(gardeFous({ ...vide, existants: [ligne("a", "PRO", false, "AUTO-MARCHE"), ligne("b", "ELITE", false, "AUTO-MARCHE")] }))
      .toEqual({ action: "deja_prepare", idPro: "a", idElite: "b" });
  });

  it("un brouillon AUTO-MARCHE publié par Steph → arrêt « déjà publié »", () => {
    expect(gardeFous({ ...vide, existants: [ligne("a", "PRO", true, "AUTO-MARCHE"), ligne("b", "ELITE", false, "AUTO-MARCHE")] }))
      .toEqual({ action: "arreter", raison: "deja_publie" });
  });

  it("e-mail « prêts » parti mais brouillons supprimés par Steph → on ne les recrée pas", () => {
    expect(gardeFous({ ...vide, pretsEnvoye: true })).toEqual({ action: "arreter", raison: "brouillons_retires" });
  });

  it("e-mail d'échec déjà parti → plus d'essai ce jour-là", () => {
    expect(gardeFous({ ...vide, echecEnvoye: true })).toEqual({ action: "arreter", raison: "echec_deja_signale" });
  });
});
