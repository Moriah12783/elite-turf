/**
 * Quinté+ du 07/10/2026 — Prix des Gobelins, Enghien R1C1 : réponses PMU
 * RÉELLES, relevées après le départ (cotes figées à 11h55 GMT). Le n°12 JUNON
 * DE LOU a été déclaré non partant vers 11h34 : un vrai cas de non-partant
 * tardif. Partagé par les tests.
 */
import participantsJson from "./pmu-participants-20261007-R1C1.json";
import courseJson from "./pmu-course-20261007-R1C1.json";
import { lireParticipantsPmu, lireCoursePmu, type ParticipantPmu } from "../pmu";
import { buildNotreSelection } from "@/lib/courses/notre-selection";
import type { PartantEnrichi } from "@/lib/courses/stats-types";

export const PARTICIPANTS = lireParticipantsPmu(participantsJson);
export const COURSE_PMU = lireCoursePmu(courseJson);

/** Partant enrichi « neutre » : sans la base, ni statistique ni note composite. */
function enrichiNeutre(p: ParticipantPmu): PartantEnrichi {
  return {
    id: String(p.numero),
    numero: p.numero,
    nom_cheval: p.nom,
    jockey: p.driver,
    entraineur: p.entraineur,
    cote: p.cote,
    musique: p.musique,
    poids_kg: null,
    stats_cheval: null,
    stats_jockey: null,
    stats_entraineur: null,
    forme_musique: null,
    score_composite: 0,
    score_breakdown: { cote: 0, vict_cheval: 0, forme_musique: 0, vict_jockey: 0 },
    badges: { vedette: false, value_bet: false, favori: false },
  };
}

/**
 * Les 8 favoris comme la route les obtient : non-partants exclus, puis
 * buildNotreSelection. Ce jour-là : 17, 16, 5, 13, 10, 15, 18, 11. Les n°11 et
 * n°14 sont à égalité à 15 : la route les départage par la note composite ;
 * ici, sans la base, le numéro départage.
 */
export const TOP8 = buildNotreSelection(PARTICIPANTS.filter((p) => !p.nonPartant).map(enrichiNeutre));
