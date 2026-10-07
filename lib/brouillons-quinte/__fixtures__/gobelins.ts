/**
 * Quinté+ du 07/10/2026 — Prix des Gobelins, Enghien R1C1 : réponses PMU
 * RÉELLES, relevées après le départ (cotes figées à 11h55 GMT). Le n°12 JUNON
 * DE LOU a été déclaré non partant vers 11h34 : un vrai cas de non-partant
 * tardif. Partagé par les tests.
 */
import participantsJson from "./pmu-participants-20261007-R1C1.json";
import courseJson from "./pmu-course-20261007-R1C1.json";
import { lireParticipantsPmu, lireCoursePmu } from "../pmu";

export const PARTICIPANTS = lireParticipantsPmu(participantsJson);
export const COURSE_PMU = lireCoursePmu(courseJson);
