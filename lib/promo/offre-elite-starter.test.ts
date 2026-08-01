import { describe, it, expect } from "vitest";
import {
  offreEliteStarterActive,
  OFFRE_ELITE_STARTER,
  type OffrePromotionnelle,
} from "./offre-elite-starter";

const OFFRE: OffrePromotionnelle = { actif: true, debut: "2026-08-01", fin: "2026-08-05" };

describe("offreEliteStarterActive", () => {
  it("est inactive la veille du lancement", () => {
    expect(offreEliteStarterActive(new Date("2026-07-31T23:59:59Z"), OFFRE)).toBe(false);
  });

  it("est active dès la première minute du premier jour", () => {
    expect(offreEliteStarterActive(new Date("2026-08-01T00:00:00Z"), OFFRE)).toBe(true);
  });

  it("est active en milieu de fenêtre", () => {
    expect(offreEliteStarterActive(new Date("2026-08-03T12:00:00Z"), OFFRE)).toBe(true);
  });

  // Le dernier jour est INCLUS : « du 1er au 5 août » doit couvrir tout le 5.
  // Une borne exclusive couperait l'offre 24 h trop tôt et créerait un litige
  // avec quiconque souscrit le 5.
  it("reste active jusqu'à la dernière seconde du dernier jour", () => {
    expect(offreEliteStarterActive(new Date("2026-08-05T23:59:59Z"), OFFRE)).toBe(true);
  });

  it("est inactive le lendemain de la clôture", () => {
    expect(offreEliteStarterActive(new Date("2026-08-06T00:00:00Z"), OFFRE)).toBe(false);
  });

  it("reste inactive si le drapeau est baissé, même dans la fenêtre", () => {
    expect(offreEliteStarterActive(new Date("2026-08-03T12:00:00Z"), { ...OFFRE, actif: false })).toBe(false);
  });

  it("la configuration livrée couvre bien du 1er au 5 août 2026", () => {
    expect(OFFRE_ELITE_STARTER.debut).toBe("2026-08-01");
    expect(OFFRE_ELITE_STARTER.fin).toBe("2026-08-05");
    expect(offreEliteStarterActive(new Date("2026-08-02T09:00:00Z"))).toBe(true);
    expect(offreEliteStarterActive(new Date("2026-08-09T09:00:00Z"))).toBe(false);
  });
});
