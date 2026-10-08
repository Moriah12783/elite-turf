import { describe, it, expect } from "vitest";
import { planifierBackfillRangs, type CourseBackfill } from "./arrivee-rangs-backfill";
import { lireOrdreArrivee, type ArriveePmu } from "./pmu-arrivees";

// Prix de Versailles (R1C1 du 08/10/2026), tel que le PMU le donne.
const pmu = (reunion: number, course: number, ordre: unknown): ArriveePmu =>
  ({ reunion, course, definitive: true, ...lireOrdreArrivee(ordre) });
const VERSAILLES = pmu(1, 1, [[1], [5], [8], [4], [15, 16], [10], [11], [13]]);

const course = (sur: Partial<CourseBackfill>): CourseBackfill => ({
  id: "c-1",
  numero_reunion: 1,
  numero_course: 1,
  arrivee_officielle: [1, 5, 8, 4, 15, 16, 10],
  arrivee_rangs: null,
  ordre_arrivee_ligne: [1, 5, 8, 4, 15, 16, 10],
  a_ligne_arrivee: true,
  nb_pronostics: 2,
  ...sur,
});

describe("planifierBackfillRangs", () => {
  it("pose les rangs via la ligne `arrivees` (le déclencheur recopie dans `courses`)", () => {
    const plan = planifierBackfillRangs([VERSAILLES], [course({})]);
    expect(plan.ecritures).toEqual([{ course_id: "c-1", cible: "arrivees", rangs: [1, 2, 3, 4, 5, 5, 7] }]);
  });

  it("sans ligne `arrivees` : directement sur `courses`", () => {
    const plan = planifierBackfillRangs([VERSAILLES], [course({ a_ligne_arrivee: false, ordre_arrivee_ligne: null })]);
    expect(plan.ecritures).toEqual([{ course_id: "c-1", cible: "courses", rangs: [1, 2, 3, 4, 5, 5, 7] }]);
  });

  it("ne réécrit pas des rangs déjà posés", () => {
    const plan = planifierBackfillRangs([VERSAILLES], [course({ arrivee_rangs: [1, 2, 3, 4, 5, 5, 7] })]);
    expect(plan.ecritures).toEqual([]);
    expect(plan.deja).toEqual(["c-1"]);
  });

  it("n'écrit rien sur une arrivée qui n'est pas celle du PMU", () => {
    const plan = planifierBackfillRangs([VERSAILLES], [course({ arrivee_officielle: [2, 8, 1, 7, 3, 5, 10], ordre_arrivee_ligne: [2, 8, 1, 7, 3, 5, 10] })]);
    expect(plan.ecritures).toEqual([]);
    expect(plan.nonConcordantes).toEqual(["c-1"]);
  });

  it("ne touche pas une course dont `courses` et `arrivees` divergent", () => {
    const plan = planifierBackfillRangs([VERSAILLES], [course({ ordre_arrivee_ligne: [1, 5, 8, 4, 16, 15, 10] })]);
    expect(plan.ecritures).toEqual([]);
    expect(plan.desynchronisees).toEqual(["c-1"]);
  });

  it("aucun ex æquo dans la partie enregistrée : rien à écrire", () => {
    const plan = planifierBackfillRangs([VERSAILLES], [course({ arrivee_officielle: [1, 5, 8, 4], ordre_arrivee_ligne: [1, 5, 8, 4] })]);
    expect(plan.ecritures).toEqual([]);
    expect(plan.sansExAequo).toBe(1);
  });

  it("ignore une course sans arrivée et une course absente du PMU", () => {
    const plan = planifierBackfillRangs([VERSAILLES], [
      course({ id: "sans", arrivee_officielle: null, ordre_arrivee_ligne: null, a_ligne_arrivee: false }),
      course({ id: "autre", numero_course: 7 }),
    ]);
    expect(plan.ecritures).toEqual([]);
  });
});
