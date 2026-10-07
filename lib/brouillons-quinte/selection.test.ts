import { describe, it, expect } from "vitest";
import {
  appliquerCotesPmu, versChevauxClasses, decouperPro, choisirValuesElite, confianceDuMarche,
  type ChevalClasse,
} from "./selection";
import { PARTICIPANTS, TOP8 } from "./__fixtures__/gobelins";
import type { ParticipantPmu } from "./pmu";

const CLASSES = versChevauxClasses(TOP8, PARTICIPANTS);

describe("versChevauxClasses — les 8 favoris du 07/10/2026 au départ", () => {
  it("ordre du marché : 17, 16, 5, 13, 10, 15, 18, 11 (le n°12, non partant, n'y est pas)", () => {
    expect(CLASSES.map((c) => c.numero)).toEqual([17, 16, 5, 13, 10, 15, 18, 11]);
    expect(CLASSES.map((c) => c.rang)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("fautes lues dans la musique PMU, noms PMU", () => {
    expect(CLASSES.map((c) => c.fautes)).toEqual([0, 0, 2, 0, 3, 1, 0, 0]);
    expect(CLASSES[0]).toEqual({ rang: 1, numero: 17, nom: "IMAGE D'ATALANTE", cote: 3.8, fautes: 0 });
  });

  it("musique absente → 0 faute : on n'invente pas d'écart", () => {
    const sansMusique = PARTICIPANTS.map((p) => (p.numero === 10 ? { ...p, musique: null } : p));
    expect(versChevauxClasses(TOP8, sansMusique).find((c) => c.numero === 10)!.fautes).toBe(0);
  });
});

describe("decouperPro", () => {
  it("base = rangs 1 à 3 (pivot = le favori), values = rangs 4 à 6", () => {
    expect(decouperPro(CLASSES)).toEqual({ pivot: 17, base: [17, 16, 5], values: [13, 10, 15] });
  });

  it("moins de 6 chevaux → null", () => {
    expect(decouperPro(CLASSES.slice(0, 5))).toBeNull();
  });
});

describe("choisirValuesElite", () => {
  it("07/10 au départ : 15, 18, 11 ; aucun écarté (le 10 n'avait pas une des 3 plus grosses cotes)", () => {
    expect(choisirValuesElite(CLASSES)).toEqual({
      pivot: 17, base: [17, 16, 5], values: [15, 18, 11], ecartes: [], completeAvecFautifs: false,
    });
  });

  it("exemple de la spec (cotes de 11h30, n°12 encore partant) : values 18, 15, 14 ; le 10 écarté", () => {
    const c: ChevalClasse[] = [
      { rang: 1, numero: 17, nom: "A", cote: 4.2, fautes: 0 },
      { rang: 2, numero: 12, nom: "B", cote: 6.9, fautes: 2 },
      { rang: 3, numero: 16, nom: "C", cote: 9.1, fautes: 0 },
      { rang: 4, numero: 13, nom: "D", cote: 10, fautes: 0 },
      { rang: 5, numero: 18, nom: "E", cote: 11, fautes: 0 },
      { rang: 6, numero: 15, nom: "F", cote: 12, fautes: 1 },
      { rang: 7, numero: 10, nom: "G", cote: 13, fautes: 3 },
      { rang: 8, numero: 14, nom: "H", cote: 13, fautes: 0 },
    ];
    expect(choisirValuesElite(c)).toMatchObject({ values: [18, 15, 14], ecartes: [10], completeAvecFautifs: false });
  });

  it("à cote égale : le moins de fautes, puis le meilleur rang", () => {
    const base: ChevalClasse[] = [1, 2, 3].map((r) => ({ rang: r, numero: r, nom: "X", cote: r, fautes: 0 }));
    const c = base.concat([
      { rang: 4, numero: 21, nom: "X", cote: 13, fautes: 0 },
      { rang: 5, numero: 22, nom: "X", cote: 12, fautes: 1 },
      { rang: 6, numero: 23, nom: "X", cote: 12, fautes: 1 },
      { rang: 7, numero: 24, nom: "X", cote: 12, fautes: 0 },
      { rang: 8, numero: 25, nom: "X", cote: 5, fautes: 0 },
    ]);
    expect(choisirValuesElite(c)!.values).toEqual([21, 22, 24]);
  });

  it("moins de 3 sans fautes : complété avec les moins fautifs, signalé", () => {
    const base: ChevalClasse[] = [1, 2, 3].map((r) => ({ rang: r, numero: r, nom: "X", cote: r, fautes: 0 }));
    const c = base.concat([
      { rang: 4, numero: 4, nom: "X", cote: 10, fautes: 0 },
      { rang: 5, numero: 5, nom: "X", cote: 12, fautes: 2 },
      { rang: 6, numero: 6, nom: "X", cote: 15, fautes: 3 },
      { rang: 7, numero: 7, nom: "X", cote: 20, fautes: 2 },
      { rang: 8, numero: 8, nom: "X", cote: 8, fautes: 4 },
    ]);
    expect(choisirValuesElite(c)).toEqual({
      pivot: 1, base: [1, 2, 3], values: [4, 5, 7], ecartes: [6], completeAvecFautifs: true,
    });
  });

  it("moins de 8 chevaux → null", () => {
    expect(choisirValuesElite(CLASSES.slice(0, 7))).toBeNull();
  });
});

describe("confianceDuMarche (cote du favori)", () => {
  it("sous 3 → Élevé ; de 3 à 6 → Moyen ; au-dessus → Faible", () => {
    expect(confianceDuMarche(2.9)).toBe("ELEVE");
    expect(confianceDuMarche(3)).toBe("MOYEN");
    expect(confianceDuMarche(6)).toBe("MOYEN");
    expect(confianceDuMarche(6.1)).toBe("FAIBLE");
    expect(confianceDuMarche(3.8)).toBe("MOYEN"); // 07/10 au départ
  });
});

describe("appliquerCotesPmu", () => {
  const pmu = (numero: number, nonPartant: boolean, cote: number | null): ParticipantPmu => ({
    numero, nom: `N${numero}`, nonPartant, cote, coteMaj: cote === null ? null : 1,
    driver: null, entraineur: null, musique: null, sexe: null, age: null, distance: null,
  });
  const base = [
    { id: "a", numero: 1, nom_cheval: "N1", cote: 99, non_partant: false },
    { id: "b", numero: 2, nom_cheval: "N2", cote: 7, non_partant: false },
    { id: "c", numero: 3, nom_cheval: "N3", cote: 5, non_partant: true },
    { id: "d", numero: 4, nom_cheval: "N4", cote: 4, non_partant: false },
  ];
  const r = appliquerCotesPmu(base, [pmu(1, false, 3.5), pmu(2, true, null), pmu(3, false, 6)]);

  it("la cote du PMU remplace celle de la base", () => {
    expect(r[0].cote).toBe(3.5);
  });

  it("non-partant déclaré au PMU seulement → exclu", () => {
    expect(r[1].non_partant).toBe(true);
    expect(r.filter((p) => !p.non_partant).map((p) => p.numero)).toEqual([1, 4]);
  });

  it("un non-partant de la base le reste", () => {
    expect(r[2].non_partant).toBe(true);
  });

  it("cheval absent du PMU → pas de cote (il ne sera pas classé)", () => {
    expect(r[3].cote).toBeNull();
  });

  it("07/10 réel : le n°12 JUNON DE LOU, encore partant en base, sort au PMU", () => {
    const enBase = PARTICIPANTS.map((p) => ({ id: String(p.numero), numero: p.numero, nom_cheval: p.nom, cote: 99, non_partant: false }));
    const apres = appliquerCotesPmu(enBase, PARTICIPANTS);
    expect(apres.find((p) => p.numero === 12)!.non_partant).toBe(true);
    expect(apres.filter((p) => !p.non_partant)).toHaveLength(17);
  });
});
