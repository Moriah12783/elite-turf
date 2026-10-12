import { describe, it, expect } from "vitest";
import { lireParticipantsPmu, lireCoursePmu, lireAllocationsPmu } from "./pmu";
import participantsJson from "./__fixtures__/pmu-participants-20261007-R1C1.json";
import courseJson from "./__fixtures__/pmu-course-20261007-R1C1.json";
import performancesJson from "./__fixtures__/pmu-performances-20261012-R1C4.json";

describe("lireParticipantsPmu — vraie réponse PMU, Quinté+ du 07/10/2026 au départ", () => {
  const p = lireParticipantsPmu(participantsJson);

  it("lit les 18 chevaux, dont un non-partant", () => {
    expect(p).toHaveLength(18);
    expect(p.filter((x) => x.nonPartant).map((x) => x.numero)).toEqual([12]);
  });

  it("lit cote, horodatage, driver, entraîneur, musique, sexe, âge et distance", () => {
    expect(p.find((x) => x.numero === 17)).toEqual({
      numero: 17,
      nom: "IMAGE D'ATALANTE",
      nonPartant: false,
      cote: 3.8,
      coteMaj: 1791374156000,
      driver: "F. NIVARD",
      entraineur: "D. CHERBONNEL",
      musique: "2a3a2a2a8a4a0a4a6a4a",
      sexe: "FEMELLES",
      age: 8,
      distance: 2900,
    });
  });

  it("n°12 JUNON DE LOU, non partant : sa dernière cote (11h34) reste lue, l'appelant l'écarte", () => {
    const x = p.find((x) => x.numero === 12)!;
    expect(x.nonPartant).toBe(true);
    expect(x.cote).toBe(6.8);
    expect(x.coteMaj).toBe(1791372870000);
  });

  it("les n°1 à 9 partent sur 2 875 m, les n°10 à 18 sur 2 900 m", () => {
    expect(p.find((x) => x.numero === 1)!.distance).toBe(2875);
    expect(p.find((x) => x.numero === 9)!.distance).toBe(2875);
    expect(p.find((x) => x.numero === 10)!.distance).toBe(2900);
  });

  it("champs absents → null", () => {
    const [x] = lireParticipantsPmu({ participants: [{ numPmu: 3, nom: "AAA", statut: "NON_PARTANT" }] });
    expect(x.nonPartant).toBe(true);
    expect(x.cote).toBeNull();
    expect(x.driver).toBeNull();
    expect(x.musique).toBeNull();
    expect(x.distance).toBeNull();
  });

  it("réponse vide ou illisible → liste vide", () => {
    expect(lireParticipantsPmu(null)).toEqual([]);
    expect(lireParticipantsPmu({})).toEqual([]);
    expect(lireParticipantsPmu({ participants: [{ numPmu: "x" }] })).toEqual([]);
  });
});

describe("lireCoursePmu", () => {
  it("lit libellé, spécialité, distance, sexe des partants, heure de départ et allocation", () => {
    expect(lireCoursePmu(courseJson)).toEqual({
      libelle: "PRIX DES GOBELINS",
      specialite: "TROT_ATTELE",
      distance: 2875,
      conditionSexe: "FEMELLES",
      heureDepart: 1791374100000,
      allocation: 59000,
    });
  });

  it("null si la réponse est vide", () => {
    expect(lireCoursePmu(null)).toBeNull();
    expect(lireCoursePmu({})).toBeNull();
  });
});

describe("lireAllocationsPmu — vraie réponse PMU, Quinté+ du 12/10/2026 (n°3, 4 et 7)", () => {
  const a = lireAllocationsPmu(performancesJson);

  it("allocations des dernières courses en euros, de la plus récente à la plus ancienne", () => {
    expect(a[4]).toEqual([19200, 19200, 16300, 15400, 16300]);
    expect(a[3]).toEqual([96000, 13700, 50900, 72000, 96000]);
  });

  it("un cheval qui n'a que 4 courses connues", () => {
    expect(a[7]).toEqual([15400, 18200, 15400, 15400]);
  });

  it("seuls les chevaux de la réponse sont présents", () => {
    expect(Object.keys(a).map(Number).sort((x, y) => x - y)).toEqual([3, 4, 7]);
  });

  it("courses dans le désordre : remises de la plus récente à la plus ancienne", () => {
    const json = { participants: [{ numPmu: 1, coursesCourues: [
      { date: 1000, allocation: 10000 }, { date: 3000, allocation: 30000 }, { date: 2000, allocation: 20000 },
    ] }] };
    expect(lireAllocationsPmu(json)[1]).toEqual([30000, 20000, 10000]);
  });

  it("allocation absente : la course reste à sa place, sans montant", () => {
    const json = { participants: [{ numPmu: 2, coursesCourues: [{ date: 2000 }, { date: 1000, allocation: 15000 }] }] };
    expect(lireAllocationsPmu(json)[2]).toEqual([null, 15000]);
  });

  it("cheval sans course connue : absent", () => {
    expect(lireAllocationsPmu({ participants: [{ numPmu: 5, coursesCourues: [] }, { numPmu: 6 }] })).toEqual({});
  });

  it("réponse vide ou illisible → aucun cheval", () => {
    expect(lireAllocationsPmu(null)).toEqual({});
    expect(lireAllocationsPmu({})).toEqual({});
    expect(lireAllocationsPmu({ participants: [{ numPmu: "x", coursesCourues: [{ allocation: 1 }] }] })).toEqual({});
  });
});
