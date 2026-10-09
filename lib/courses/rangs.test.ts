import { describe, it, expect } from "vitest";
import {
  couperParRang,
  estExAequo,
  arriveeEnTexte,
  groupesArrivee,
  libelleRang,
  rangDe,
  rangsPour,
  rangsAStocker,
  rangsEffectifs,
  rangsValides,
} from "./rangs";

// Prix de Versailles, Quinté+ du 08/10/2026 : PMU [[1],[5],[8],[4],[15,16],[10]]
// → 15 et 16 ex æquo 5es, le suivant est 7e.
const VERSAILLES = [1, 5, 8, 4, 15, 16, 10];
const RANGS_VERSAILLES = [1, 2, 3, 4, 5, 5, 7];

describe("rangsValides — classement « 5, 5, 7 » du PMU", () => {
  it("accepte un ordre strict et un ex æquo", () => {
    expect(rangsValides(VERSAILLES, RANGS_VERSAILLES)).toBe(true);
    expect(rangsValides([3, 7, 2], [1, 2, 3])).toBe(true);
    expect(rangsValides([3, 7, 2, 9], [1, 1, 3, 3])).toBe(true);
  });

  it("refuse des rangs qui ne collent pas à l'arrivée", () => {
    expect(rangsValides(VERSAILLES, [1, 2, 3])).toBe(false);          // longueur
    expect(rangsValides([3, 7, 2], [2, 3, 4])).toBe(false);           // ne commence pas à 1
    expect(rangsValides([3, 7, 2], [1, 3, 3])).toBe(false);           // saute le 2
    expect(rangsValides([3, 7, 2, 9], [1, 1, 2, 4])).toBe(false);     // après 1=1, le suivant est 3e
    expect(rangsValides([3, 7, 2], null)).toBe(false);
  });
});

describe("rangsEffectifs", () => {
  it("rangs en base valides → ils font foi", () => {
    expect(rangsEffectifs(VERSAILLES, RANGS_VERSAILLES)).toEqual(RANGS_VERSAILLES);
  });

  it("rangs absents ou incohérents → position dans la liste (comportement historique)", () => {
    expect(rangsEffectifs([3, 7, 2], null)).toEqual([1, 2, 3]);
    expect(rangsEffectifs([3, 7, 2], undefined)).toEqual([1, 2, 3]);
    expect(rangsEffectifs([3, 7, 2], [1, 3, 3])).toEqual([1, 2, 3]);
  });
});

describe("rangsAStocker", () => {
  it("rien à stocker sans ex æquo : NULL = ordre strict", () => {
    expect(rangsAStocker([1, 2, 3, 4])).toBeNull();
  });

  it("garde les rangs dès qu'il y a un ex æquo", () => {
    expect(rangsAStocker(RANGS_VERSAILLES)).toEqual(RANGS_VERSAILLES);
  });
});

describe("groupesArrivee", () => {
  it("regroupe les ex æquo sous un même rang", () => {
    expect(groupesArrivee(VERSAILLES, RANGS_VERSAILLES)).toEqual([
      { rang: 1, numeros: [1] },
      { rang: 2, numeros: [5] },
      { rang: 3, numeros: [8] },
      { rang: 4, numeros: [4] },
      { rang: 5, numeros: [15, 16] },
      { rang: 7, numeros: [10] },
    ]);
  });

  it("sans rangs : un cheval par rang", () => {
    expect(groupesArrivee([3, 7], null)).toEqual([
      { rang: 1, numeros: [3] },
      { rang: 2, numeros: [7] },
    ]);
  });
});

describe("rangDe / estExAequo", () => {
  it("le n°16 est 5e ex æquo, pas 6e", () => {
    expect(rangDe(16, VERSAILLES, RANGS_VERSAILLES)).toBe(5);
    expect(estExAequo(16, VERSAILLES, RANGS_VERSAILLES)).toBe(true);
    expect(rangDe(10, VERSAILLES, RANGS_VERSAILLES)).toBe(7);
    expect(estExAequo(10, VERSAILLES, RANGS_VERSAILLES)).toBe(false);
  });

  it("sans rangs : la position, jamais d'ex æquo", () => {
    expect(rangDe(16, VERSAILLES, null)).toBe(6);
    expect(estExAequo(16, VERSAILLES, null)).toBe(false);
  });

  it("cheval absent → null", () => {
    expect(rangDe(99, VERSAILLES, RANGS_VERSAILLES)).toBeNull();
  });
});

describe("couperParRang — le cap (6 ou 7) se compte en rangs, pas en chevaux", () => {
  it("un ex æquo au rang du cap est gardé en entier", () => {
    // Prix de Beauvais (Quinté+ du 18/11/2025), PMU :
    // [[12],[6,8],[11],[10],[5],[4,15],[3]…] → 6=8 2es, 4=15 7es.
    const arrivee = [12, 6, 8, 11, 10, 5, 4, 15, 3];
    const rangs = [1, 2, 2, 4, 5, 6, 7, 7, 9];
    expect(couperParRang(arrivee, rangs, 7)).toEqual({
      arrivee: [12, 6, 8, 11, 10, 5, 4, 15],
      rangs: [1, 2, 2, 4, 5, 6, 7, 7],
    });
  });

  it("sans ex æquo : les N premiers", () => {
    expect(couperParRang([5, 3, 1, 2, 4], [1, 2, 3, 4, 5], 3)).toEqual({ arrivee: [5, 3, 1], rangs: [1, 2, 3] });
  });
});

describe("libelleRang", () => {
  it("1er, 2e… et « ex æquo » quand le rang est partagé", () => {
    expect(libelleRang(1, false)).toBe("1er");
    expect(libelleRang(2, false)).toBe("2e");
    expect(libelleRang(5, true)).toBe("5e ex æquo");
    expect(libelleRang(1, true)).toBe("1er ex æquo");
  });
});

describe("arriveeEnTexte — « 1 - 5 - 8 - 4 - 15 / 16 (ex æquo) »", () => {
  it("les N premiers rangs, ex æquo groupés et signalés", () => {
    expect(arriveeEnTexte(VERSAILLES, RANGS_VERSAILLES, 5)).toBe("1 - 5 - 8 - 4 - 15 / 16 (ex æquo)");
  });

  it("sans ex æquo : la liste habituelle", () => {
    expect(arriveeEnTexte([8, 2, 7, 3, 15, 12, 9], null, 5)).toBe("8 - 2 - 7 - 3 - 15");
  });

  it("un ex æquo au-delà des N premiers n'apparaît pas", () => {
    expect(arriveeEnTexte(VERSAILLES, RANGS_VERSAILLES, 4)).toBe("1 - 5 - 8 - 4");
  });
});

describe("rangsPour — les rangs de la course ne valent que pour la même arrivée", () => {
  it("copie identique (arrivee_reelle d'un pronostic) : les rangs de la course", () => {
    expect(rangsPour(VERSAILLES, VERSAILLES, RANGS_VERSAILLES)).toEqual(RANGS_VERSAILLES);
  });

  it("arrivée différente (corrigée depuis) : aucun rang, ordre strict", () => {
    expect(rangsPour([1, 5, 8, 4, 16, 15, 10], VERSAILLES, RANGS_VERSAILLES)).toBeNull();
    expect(rangsPour(VERSAILLES, null, RANGS_VERSAILLES)).toBeNull();
    expect(rangsPour(VERSAILLES, VERSAILLES, null)).toBeNull();
  });
});
