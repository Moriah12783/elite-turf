/**
 * Quinté+ du 22/10/2026 — Prix André Adèle, Auteuil R1C1 (steeple-chase,
 * handicap de catégorie, 3 600 m, terrain très souple, 16 partants). Réponses
 * PMU RÉELLES relevées le matin (vers 9h45 GMT, cotes du matin ; performances
 * réduites aux champs lus). Le PMU y donne la spécialité « OBSTACLE » et la
 * discipline « STEEPLECHASE ». Partagé par les tests.
 */
import participantsJson from "./pmu-participants-20261022-R1C1.json";
import courseJson from "./pmu-course-20261022-R1C1.json";
import performancesJson from "./pmu-performances-20261022-R1C1.json";
import { lireParticipantsPmu, lireCoursePmu, lireAllocationsPmu } from "../pmu";
import type { ContexteCourse } from "../commentaires";

export const COURSE_AUTEUIL = courseJson;
export const PARTICIPANTS_AUTEUIL = lireParticipantsPmu(participantsJson);

export const CTX_AUTEUIL: ContexteCourse = {
  dateISO: "2026-10-22",
  prix: "Prix André Adèle",
  hippodrome: "Auteuil",
  reunion: 1,
  course: 1,
  heureParis: "13:55:00",
  departUtc: new Date("2026-10-22T11:55:00Z"),
  coursePmu: lireCoursePmu(courseJson),
  distanceBase: null,
  participants: PARTICIPANTS_AUTEUIL,
  releveCotes: Date.parse("2026-10-22T09:45:00Z"),
  allocations: lireAllocationsPmu(performancesJson),
};
