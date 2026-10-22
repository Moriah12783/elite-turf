/**
 * Quinté+ du 21/10/2026 — Grand Prix de la Ville Rose, Toulouse R1C1 (trot
 * attelé, 2 950 m, deux échelons : les n°8 à 13 rendent 25 m). Réponses PMU
 * RÉELLES (participants, course, performances réduites aux champs lus),
 * relevées après la course. Exemple « trot » du modèle éditorial de Steph
 * (22/10/2026). Argon, T-90 scellée : 12-10-13-1-4-5-7-6, couplé maître 12-10,
 * sniper n°13 à 6,9. Partagé par les tests.
 */
import participantsJson from "./pmu-participants-20261021-R1C1.json";
import courseJson from "./pmu-course-20261021-R1C1.json";
import performancesJson from "./pmu-performances-20261021-R1C1.json";
import { lireParticipantsPmu, lireCoursePmu, lireAllocationsPmu } from "../pmu";
import type { ContexteCourse } from "../commentaires";

export const PARTICIPANTS_TOULOUSE = lireParticipantsPmu(participantsJson);

/** Cotes relevées à 10h15 GMT, comme dans le modèle. */
export const CTX_TOULOUSE: ContexteCourse = {
  dateISO: "2026-10-21",
  prix: "Grand Prix de la Ville Rose",
  hippodrome: "Toulouse",
  reunion: 1,
  course: 1,
  heureParis: "13:55:00",
  departUtc: new Date("2026-10-21T11:55:00Z"),
  coursePmu: lireCoursePmu(courseJson),
  distanceBase: null,
  participants: PARTICIPANTS_TOULOUSE,
  releveCotes: Date.parse("2026-10-21T10:15:00Z"),
  allocations: lireAllocationsPmu(performancesJson),
};
