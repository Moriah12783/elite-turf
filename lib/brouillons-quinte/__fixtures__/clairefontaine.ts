/**
 * Quinté+ du 20/10/2026 — Prix des Equidays, Clairefontaine R1C1 (plat,
 * handicap divisé pour 3 ans, 2 400 m, corde à droite, terrain très souple).
 * Réponses PMU RÉELLES (participants, course, performances réduites aux champs
 * lus), relevées après la course ; le n°7 MOONEY VISION est non partant.
 * Exemple « plat » du modèle éditorial de Steph (22/10/2026). Argon, T-90 :
 * 2-9-4-3-15-14-11-5. Partagé par les tests.
 */
import participantsJson from "./pmu-participants-20261020-R1C1.json";
import courseJson from "./pmu-course-20261020-R1C1.json";
import performancesJson from "./pmu-performances-20261020-R1C1.json";
import { lireParticipantsPmu, lireCoursePmu, lireAllocationsPmu } from "../pmu";
import type { ContexteCourse } from "../commentaires";

export const PARTICIPANTS_CLAIREFONTAINE = lireParticipantsPmu(participantsJson);

/** Cotes relevées à 10h15 GMT, comme dans le modèle. */
export const CTX_CLAIREFONTAINE: ContexteCourse = {
  dateISO: "2026-10-20",
  prix: "Prix des Equidays",
  hippodrome: "Clairefontaine",
  reunion: 1,
  course: 1,
  heureParis: "13:55:00",
  departUtc: new Date("2026-10-20T11:55:00Z"),
  coursePmu: lireCoursePmu(courseJson),
  distanceBase: null,
  participants: PARTICIPANTS_CLAIREFONTAINE,
  releveCotes: Date.parse("2026-10-20T10:15:00Z"),
  allocations: lireAllocationsPmu(performancesJson),
};
