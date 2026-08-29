import { describe, it, expect } from "vitest";
import { libelleDateCourse, estDuJour, estPassee } from "./date-affichage";

describe("libelleDateCourse", () => {
  // Le 21/08/2026 est un VENDREDI — vérifié contre Intl sur 5 dates.
  it("rend « ven. 21 août » pour le 21/08/2026", () => {
    expect(libelleDateCourse("2026-08-21")).toBe("ven. 21 août");
  });

  it("gère les autres jours de la semaine", () => {
    expect(libelleDateCourse("2026-08-25")).toBe("mar. 25 août");   // aujourd'hui
    expect(libelleDateCourse("2026-08-23")).toBe("dim. 23 août");
    expect(libelleDateCourse("2026-01-01")).toBe("jeu. 1 janvier");
    expect(libelleDateCourse("2026-12-31")).toBe("jeu. 31 décembre");
  });

  // Le fuseau du serveur ne doit JAMAIS décaler la date : Cloudflare tourne en
  // UTC, les lecteurs sont à Abidjan (UTC+0) et à Paris (UTC+2).
  it("ignore l'heure éventuellement collée à la date", () => {
    expect(libelleDateCourse("2026-08-21T23:30:00Z")).toBe("ven. 21 août");
    expect(libelleDateCourse("2026-08-21T00:15:00+02:00")).toBe("ven. 21 août");
  });

  it("rend l'entrée telle quelle si elle est illisible — jamais une date fausse", () => {
    expect(libelleDateCourse("pas-une-date")).toBe("pas-une-date");
    expect(libelleDateCourse("2026-99-01")).toBe("2026-99-01");
    expect(libelleDateCourse("")).toBe("");
  });
});

describe("estDuJour / estPassee", () => {
  const AUJ = "2026-08-25";

  it("distingue aujourd'hui, hier et demain", () => {
    expect(estDuJour("2026-08-25", AUJ)).toBe(true);
    expect(estDuJour("2026-08-24", AUJ)).toBe(false);
    expect(estDuJour("2026-08-26", AUJ)).toBe(false);

    expect(estPassee("2026-08-24", AUJ)).toBe(true);
    expect(estPassee("2026-08-25", AUJ)).toBe(false); // aujourd'hui n'est PAS passé
    expect(estPassee("2026-08-26", AUJ)).toBe(false);
  });

  it("tolère une date horodatée", () => {
    expect(estDuJour("2026-08-25T15:00:00Z", AUJ)).toBe(true);
    expect(estPassee("2026-08-24T15:00:00Z", AUJ)).toBe(true);
  });

  it("ne prétend rien sans donnée", () => {
    expect(estDuJour("", AUJ)).toBe(false);
    expect(estPassee("", AUJ)).toBe(false);
    expect(estDuJour("2026-08-25", "")).toBe(false);
  });

  // Bascule d'année : la comparaison lexicographique doit rester chronologique.
  it("gère le passage d'année", () => {
    expect(estPassee("2026-12-31", "2027-01-01")).toBe(true);
    expect(estPassee("2027-01-02", "2027-01-01")).toBe(false);
  });
});
