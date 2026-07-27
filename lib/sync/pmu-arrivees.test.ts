import { describe, it, expect } from "vitest";
import {
  aplatirOrdreArrivee,
  estArriveeDefinitive,
  isoVersDdmmyyyy,
  parseArriveesProgramme,
  capPourParis,
  calculerCorrections,
  cleRC,
} from "./pmu-arrivees";

// Payload RÉEL observé le 27/07/2026 sur /programme/27072026 (R1 Clairefontaine).
const PROGRAMME_REEL = {
  programme: {
    reunions: [
      {
        numOfficiel: 1,
        hippodrome: { libelleLong: "HIPPODROME DE CLAIREFONTAINE" },
        courses: [
          {
            numOrdre: 5,
            statut: "ARRIVEE_DEFINITIVE_COMPLETE",
            isArriveeDefinitive: true,
            // Le vrai format : un tableau de RANGS, chaque rang étant un tableau.
            ordreArrivee: [[12], [13], [7], [4], [1], [6], [9], [11], [8], [14], [10], [3], [2]],
          },
          {
            numOrdre: 6,
            statut: "PROGRAMMEE",          // pas encore courue
            ordreArrivee: null,
          },
        ],
      },
    ],
  },
};

describe("aplatirOrdreArrivee", () => {
  it("aplatit le format PMU en préservant l'ordre", () => {
    expect(aplatirOrdreArrivee([[12], [13], [7], [4], [1]])).toEqual([12, 13, 7, 4, 1]);
  });

  it("gère un ex æquo (deux chevaux au même rang)", () => {
    // Dead heat : rang 2 partagé — les deux doivent apparaître, dans l'ordre.
    expect(aplatirOrdreArrivee([[5], [3, 8], [1]])).toEqual([5, 3, 8, 1]);
  });

  it("accepte aussi un tableau déjà plat", () => {
    expect(aplatirOrdreArrivee([5, 3, 1])).toEqual([5, 3, 1]);
  });

  it("ignore null, non-tableau et valeurs aberrantes", () => {
    expect(aplatirOrdreArrivee(null)).toEqual([]);
    expect(aplatirOrdreArrivee("12-13")).toEqual([]);
    expect(aplatirOrdreArrivee([[0], [-3], ["x"], [7]])).toEqual([7]);
  });
});

describe("estArriveeDefinitive", () => {
  it("accepte les statuts définitifs", () => {
    expect(estArriveeDefinitive("ARRIVEE_DEFINITIVE_COMPLETE")).toBe(true);
    expect(estArriveeDefinitive("ARRIVEE_DEFINITIVE")).toBe(true);
  });

  it("refuse une arrivée provisoire — elle peut encore changer", () => {
    expect(estArriveeDefinitive("ARRIVEE_PROVISOIRE")).toBe(false);
    expect(estArriveeDefinitive("PROGRAMMEE")).toBe(false);
    expect(estArriveeDefinitive(null)).toBe(false);
    expect(estArriveeDefinitive(undefined)).toBe(false);
  });

  it("le drapeau isArriveeDefinitive suffit", () => {
    expect(estArriveeDefinitive("PEU_IMPORTE", true)).toBe(true);
  });
});

describe("isoVersDdmmyyyy", () => {
  it("convertit au format attendu par l'API", () => {
    expect(isoVersDdmmyyyy("2026-07-27")).toBe("27072026");
    expect(isoVersDdmmyyyy("2025-01-05")).toBe("05012025");
  });

  it("lève sur une date invalide plutôt que de forger une URL fausse", () => {
    expect(() => isoVersDdmmyyyy("27/07/2026")).toThrow();
    expect(() => isoVersDdmmyyyy("")).toThrow();
  });
});

describe("parseArriveesProgramme", () => {
  it("extrait l'arrivée réelle de R1C5 du 27/07", () => {
    const rows = parseArriveesProgramme(PROGRAMME_REEL);
    expect(rows).toHaveLength(1);                      // la C6 non courue est écartée
    expect(rows[0].reunion).toBe(1);
    expect(rows[0].course).toBe(5);
    expect(rows[0].arrivee.slice(0, 5)).toEqual([12, 13, 7, 4, 1]);
  });

  it("écarte les courses non définitives", () => {
    const rows = parseArriveesProgramme(PROGRAMME_REEL);
    expect(rows.some((r) => r.course === 6)).toBe(false);
  });

  it("écarte une arrivée trop courte pour être exploitable", () => {
    const rows = parseArriveesProgramme({
      programme: { reunions: [{ numOfficiel: 3, courses: [
        { numOrdre: 1, statut: "ARRIVEE_DEFINITIVE", ordreArrivee: [[4], [2]] },
      ] }] },
    });
    expect(rows).toEqual([]);
  });

  it("tolère un payload vide ou malformé", () => {
    expect(parseArriveesProgramme(null)).toEqual([]);
    expect(parseArriveesProgramme({})).toEqual([]);
    expect(parseArriveesProgramme({ programme: {} })).toEqual([]);
  });
});

describe("capPourParis", () => {
  it("7 chevaux pour un Quinté+ (Bonus 3), 6 sinon", () => {
    expect(capPourParis(["QUINTE_PLUS", "TIERCE"])).toBe(7);
    expect(capPourParis(["TIERCE", "COUPLE"])).toBe(6);
    expect(capPourParis(null)).toBe(6);
  });
});

describe("calculerCorrections", () => {
  // Le cas RÉEL du 27/07 : la base portait une arrivée contaminée,
  // recopiée depuis une autre course par le scraping Geny.
  const pmu = new Map<string, number[]>([
    [cleRC(1, 5), [12, 13, 7, 4, 1, 6, 9, 11]],
  ]);

  it("détecte l'arrivée contaminée et propose la bonne", () => {
    const [d] = calculerCorrections([{
      id: "abc", numero_reunion: 1, numero_course: 5,
      paris_disponibles: ["QUINTE_PLUS"],
      arrivee_officielle: [2, 8, 1, 7, 3, 5, 10],     // la fausse
    }], pmu);
    expect(d.identique).toBe(false);
    expect(d.apres).toEqual([12, 13, 7, 4, 1, 6, 9]); // cap 7 = Quinté+
  });

  it("marque identique quand la base est déjà juste", () => {
    const [d] = calculerCorrections([{
      id: "ok", numero_reunion: 1, numero_course: 5,
      paris_disponibles: ["QUINTE_PLUS"],
      arrivee_officielle: [12, 13, 7, 4, 1, 6, 9],
    }], pmu);
    expect(d.identique).toBe(true);
  });

  it("IGNORE une course inconnue de PMU — jamais d'effacement", () => {
    const res = calculerCorrections([{
      id: "inconnue", numero_reunion: 9, numero_course: 9,
      paris_disponibles: null, arrivee_officielle: [1, 2, 3],
    }], pmu);
    expect(res).toEqual([]);
  });

  it("respecte le cap 6 hors Quinté+", () => {
    const [d] = calculerCorrections([{
      id: "t", numero_reunion: 1, numero_course: 5,
      paris_disponibles: ["TIERCE"], arrivee_officielle: null,
    }], pmu);
    expect(d.apres).toEqual([12, 13, 7, 4, 1, 6]);
  });
});
