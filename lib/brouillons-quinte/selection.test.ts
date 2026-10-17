import { describe, it, expect } from "vitest";
import { appliquerCotesPmu } from "./selection";
import { PARTICIPANTS } from "./__fixtures__/gobelins";
import type { ParticipantPmu } from "./pmu";

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
    { id: "e", numero: 5, nom_cheval: "N5", cote: 3, non_partant: true },
  ];
  const r = appliquerCotesPmu(base, [pmu(1, false, 3.5), pmu(2, true, null), pmu(3, false, 6)]);

  it("la cote du PMU remplace celle de la base", () => {
    expect(r[0].cote).toBe(3.5);
  });

  it("non-partant déclaré au PMU seulement → exclu", () => {
    expect(r[1].non_partant).toBe(true);
    expect(r.filter((p) => !p.non_partant).map((p) => p.numero)).toEqual([1, 3, 4]);
  });

  it("le PMU fait foi : non partant en base mais partant au PMU → partant, avec sa cote", () => {
    expect(r[2].non_partant).toBe(false);
    expect(r[2].cote).toBe(6);
  });

  it("absent du PMU : le statut de la base est gardé, sans cote", () => {
    expect(r[4].non_partant).toBe(true);
    expect(r[4].cote).toBeNull();
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
