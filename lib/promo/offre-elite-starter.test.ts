import { describe, it, expect } from "vitest";
import {
  offreEliteStarterActive,
  libelleFinOffre,
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

  // Reconduction : 3 jours, du 25 au 27 août 2026 inclus.
  it("la configuration livrée couvre bien du 25 au 27 août 2026", () => {
    expect(OFFRE_ELITE_STARTER.debut).toBe("2026-08-25");
    expect(OFFRE_ELITE_STARTER.fin).toBe("2026-08-27");
    expect(offreEliteStarterActive(new Date("2026-08-24T23:59:59Z"))).toBe(false); // veille
    expect(offreEliteStarterActive(new Date("2026-08-25T00:00:00Z"))).toBe(true);  // 1er jour
    expect(offreEliteStarterActive(new Date("2026-08-27T23:59:59Z"))).toBe(true);  // dernier jour, inclus
    expect(offreEliteStarterActive(new Date("2026-08-28T00:00:00Z"))).toBe(false); // lendemain
  });

  // La page /abonnements annonçait « Jusqu'au 5 août » en dur alors que la
  // fenêtre avait bougé au 27. Le libellé se dérive désormais de la config.
  it("libelleFinOffre rend la date de clôture en toutes lettres", () => {
    expect(libelleFinOffre()).toBe("27 août");
    expect(libelleFinOffre({ actif: true, debut: "2026-08-01", fin: "2026-08-05" })).toBe("5 août");
    expect(libelleFinOffre({ actif: true, debut: "2026-11-28", fin: "2026-12-01" })).toBe("1er décembre");
  });

  it("libelleFinOffre ne casse pas sur une date malformée", () => {
    expect(libelleFinOffre({ actif: true, debut: "x", fin: "pas-une-date" })).toBe("pas-une-date");
    expect(libelleFinOffre({ actif: true, debut: "x", fin: "2026-99-01" })).toBe("2026-99-01");
  });

  it("la fenêtre annoncée fait bien 3 jours", () => {
    const jour = 86400000;
    const debut = new Date(OFFRE_ELITE_STARTER.debut + "T00:00:00Z").getTime();
    const fin   = new Date(OFFRE_ELITE_STARTER.fin   + "T00:00:00Z").getTime();
    expect((fin - debut) / jour + 1).toBe(3);
  });
});
