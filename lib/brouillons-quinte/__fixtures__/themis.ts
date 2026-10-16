/**
 * Quinté+ du 16/10/2026 — Prix Thémis, Vincennes R1C4 : réponses Argon et PMU
 * RÉELLES, relevées après la course (vers 20h GMT). L'édition T-90 d'Argon,
 * scellée à 16:45 GMT, retient 3-6-12-13-7-4-11-14 ; aucun non-partant.
 * La réponse d'Argon est réduite à 2 courses (R1C4 et R1C1 du jour).
 * Partagé par les tests.
 */
import argonJson from "./argon-races-20261016.json";
import participantsJson from "./pmu-participants-20261016-R1C4.json";
import courseJson from "./pmu-course-20261016-R1C4.json";
import { lireParticipantsPmu, lireCoursePmu } from "../pmu";
import type { ContexteCourse } from "../commentaires";

export const ARGON_JSON: unknown = argonJson;
export const PARTICIPANTS_THEMIS = lireParticipantsPmu(participantsJson);
export const COURSE_PMU_THEMIS = lireCoursePmu(courseJson);

/** Ce que la route cherche chez Argon pour le Quinté+ du jour. */
export const CIBLE_THEMIS = { dateISO: "2026-10-16", reunion: 1, course: 4, hippodrome: "Vincennes" };

/** Contexte tel que la route le passe à l'assembleur (l'heure du relevé est calculée par lui). */
export const CTX_THEMIS: Omit<ContexteCourse, "releveCotes"> = {
  dateISO: "2026-10-16",
  prix: "Prix Thémis",
  hippodrome: "Vincennes",
  reunion: 1,
  course: 4,
  heureParis: "20:15:00",
  departUtc: new Date("2026-10-16T18:15:00Z"),
  coursePmu: COURSE_PMU_THEMIS,
  distanceBase: 2850,
  participants: PARTICIPANTS_THEMIS,
};
