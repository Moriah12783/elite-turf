import { describe, it, expect } from "vitest";
import { bordsCaches, pasDeDefilement } from "./onglets-defilement";

// Mesures réelles du 12/10/2026 : 6 onglets = 703 px ; barre de 726 px sur ordinateur, 342 px sur un téléphone de 375 px.
describe("bordsCaches — onglets hors de vue dans la barre", () => {
  it("ordinateur, tout tient : aucun indice", () => {
    expect(bordsCaches({ scrollLeft: 0, clientWidth: 726, scrollWidth: 726 })).toEqual({ gauche: false, droite: false });
  });

  it("téléphone, au début : des onglets cachés à droite seulement", () => {
    expect(bordsCaches({ scrollLeft: 0, clientWidth: 342, scrollWidth: 703 })).toEqual({ gauche: false, droite: true });
  });

  it("téléphone, au milieu : des onglets cachés des deux côtés", () => {
    expect(bordsCaches({ scrollLeft: 150, clientWidth: 342, scrollWidth: 703 })).toEqual({ gauche: true, droite: true });
  });

  it("téléphone, au bout : des onglets cachés à gauche seulement", () => {
    expect(bordsCaches({ scrollLeft: 361, clientWidth: 342, scrollWidth: 703 })).toEqual({ gauche: true, droite: false });
  });

  it("à 2 px près (arrondis du navigateur) : pas d'indice pour un écart invisible", () => {
    expect(bordsCaches({ scrollLeft: 359.4, clientWidth: 342, scrollWidth: 703 })).toEqual({ gauche: true, droite: false });
    expect(bordsCaches({ scrollLeft: 1.5, clientWidth: 342, scrollWidth: 703 })).toEqual({ gauche: false, droite: true });
    expect(bordsCaches({ scrollLeft: 0, clientWidth: 702, scrollWidth: 703 })).toEqual({ gauche: false, droite: false });
  });

  it("barre pas encore mesurée : aucun indice", () => {
    expect(bordsCaches({ scrollLeft: 0, clientWidth: 0, scrollWidth: 0 })).toEqual({ gauche: false, droite: false });
  });
});

describe("pasDeDefilement — avancée d'un appui sur la flèche", () => {
  it("deux tiers de la largeur visible", () => {
    expect(pasDeDefilement(342)).toBe(228);
  });

  it("jamais moins de 120 px, pour toujours faire apparaître un onglet", () => {
    expect(pasDeDefilement(90)).toBe(120);
  });
});
