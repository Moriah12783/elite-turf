import { describe, it, expect } from "vitest";
import {
  aplatirOrdreArrivee,
  lireOrdreArrivee,
  arriveeARetenir,
  rangsPourArriveeEnBase,
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

describe("lireOrdreArrivee — l'ex æquo n'est plus perdu", () => {
  it("Prix de Versailles (08/10/2026) : 15 et 16 sont 5es, le 10 est 7e", () => {
    expect(lireOrdreArrivee([[1], [5], [8], [4], [15, 16], [10]])).toEqual({
      arrivee: [1, 5, 8, 4, 15, 16, 10],
      rangs: [1, 2, 3, 4, 5, 5, 7],
    });
  });

  it("ordre strict ou tableau déjà plat : rangs = positions", () => {
    expect(lireOrdreArrivee([[12], [13], [7]])).toEqual({ arrivee: [12, 13, 7], rangs: [1, 2, 3] });
    expect(lireOrdreArrivee([5, 3, 1])).toEqual({ arrivee: [5, 3, 1], rangs: [1, 2, 3] });
  });

  it("ignore les valeurs aberrantes sans décaler les rangs suivants", () => {
    expect(lireOrdreArrivee([[4], ["x", 9], [2]])).toEqual({ arrivee: [4, 9, 2], rangs: [1, 2, 3] });
    expect(lireOrdreArrivee(null)).toEqual({ arrivee: [], rangs: [] });
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

  it("renvoie les rangs avec l'arrivée", () => {
    const rows = parseArriveesProgramme({
      programme: { reunions: [{ numOfficiel: 1, courses: [
        { numOrdre: 1, statut: "ARRIVEE_DEFINITIVE_COMPLETE", ordreArrivee: [[1], [5], [8], [4], [15, 16], [10]] },
      ] }] },
    });
    expect(rows[0].rangs).toEqual([1, 2, 3, 4, 5, 5, 7]);
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

describe("arriveeARetenir — cap en rangs, rangs NULL sans ex æquo", () => {
  it("Versailles (Quinté+, cap 7) : rangs gardés", () => {
    expect(arriveeARetenir(lireOrdreArrivee([[1], [5], [8], [4], [15, 16], [10], [11], [13]]), 7)).toEqual({
      arrivee: [1, 5, 8, 4, 15, 16, 10],
      rangs: [1, 2, 3, 4, 5, 5, 7],
    });
  });

  it("Prix de Beauvais (18/11/2025) : l'ex æquo au 7e rang est gardé en entier", () => {
    const off = lireOrdreArrivee([[12], [6, 8], [11], [10], [5], [4, 15], [3], [13]]);
    expect(arriveeARetenir(off, 7).arrivee).toEqual([12, 6, 8, 11, 10, 5, 4, 15]);
  });

  it("ordre strict : rangs NULL, comme tout l'historique", () => {
    expect(arriveeARetenir(lireOrdreArrivee([[12], [13], [7], [4], [1], [6], [9]]), 6)).toEqual({
      arrivee: [12, 13, 7, 4, 1, 6],
      rangs: null,
    });
  });
});

describe("rangsPourArriveeEnBase — backfill : des rangs seulement sur la même arrivée", () => {
  const VERSAILLES_PMU = lireOrdreArrivee([[1], [5], [8], [4], [15, 16], [10], [11], [13]]);

  it("arrivée en base = arrivée PMU : ses rangs", () => {
    expect(rangsPourArriveeEnBase([1, 5, 8, 4, 15, 16, 10], VERSAILLES_PMU)).toEqual([1, 2, 3, 4, 5, 5, 7]);
  });

  it("deux ex æquo dans l'autre ordre : mêmes rangs", () => {
    expect(rangsPourArriveeEnBase([1, 5, 8, 4, 16, 15, 10], VERSAILLES_PMU)).toEqual([1, 2, 3, 4, 5, 5, 7]);
  });

  it("une autre arrivée (contaminée) : rien", () => {
    expect(rangsPourArriveeEnBase([2, 8, 1, 7, 3, 5, 10], VERSAILLES_PMU)).toBeNull();
    expect(rangsPourArriveeEnBase([5, 1, 8, 4, 15, 16, 10], VERSAILLES_PMU)).toBeNull();
  });

  it("pas d'ex æquo dans la partie enregistrée : rien à écrire", () => {
    expect(rangsPourArriveeEnBase([1, 5, 8, 4], VERSAILLES_PMU)).toBeNull();
  });

  it("arrivée absente ou trop courte : rien", () => {
    expect(rangsPourArriveeEnBase(null, VERSAILLES_PMU)).toBeNull();
    expect(rangsPourArriveeEnBase([1, 5], VERSAILLES_PMU)).toBeNull();
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
