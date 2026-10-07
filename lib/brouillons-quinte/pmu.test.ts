import { describe, it, expect } from "vitest";
import { lireParticipantsPmu, lireCoursePmu } from "./pmu";
import participantsJson from "./__fixtures__/pmu-participants-20261007-R1C1.json";
import courseJson from "./__fixtures__/pmu-course-20261007-R1C1.json";

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
  it("lit libellé, spécialité, distance, sexe des partants et heure de départ", () => {
    expect(lireCoursePmu(courseJson)).toEqual({
      libelle: "PRIX DES GOBELINS",
      specialite: "TROT_ATTELE",
      distance: 2875,
      conditionSexe: "FEMELLES",
      heureDepart: 1791374100000,
    });
  });

  it("null si la réponse est vide", () => {
    expect(lireCoursePmu(null)).toBeNull();
    expect(lireCoursePmu({})).toBeNull();
  });
});
