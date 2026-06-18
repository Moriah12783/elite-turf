/**
 * lib/live/status.ts
 *
 * État « live » d'une course du jour, calculé PUREMENT (sans I/O) à partir de
 * l'heure de départ et de l'heure courante (en minutes depuis minuit, fuseau
 * Paris) + présence d'une arrivée. Le pipeline ne fournit pas de statut
 * « EN_COURS » temps réel : on le déduit de l'horloge.
 *
 * Réservé aux courses du JOUR (comparaison en minutes-de-journée → pas de
 * passage minuit à gérer pour des courses d'après-midi).
 */

export type CourseLiveStatus =
  | "A_VENIR" // > 10 min avant le départ
  | "IMMINENTE" // autour du départ (-10 min … +30 min)
  | "RESULTAT_IMMINENT" // départ passé depuis > 30 min, résultat pas encore tombé
  | "TERMINEE"; // arrivée officielle connue

/** "14:30:00" / "14:30" -> minutes depuis minuit (870), ou null si invalide. */
export function heureToMinutes(heure: string | null | undefined): number | null {
  if (!heure) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(heure.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function computeCourseStatus(params: {
  hasArrivee: boolean;
  /** minutes-de-journée de l'heure de départ (null si inconnue). */
  startMinutes: number | null;
  /** minutes-de-journée courantes, fuseau Paris. */
  nowMinutes: number;
}): CourseLiveStatus {
  if (params.hasArrivee) return "TERMINEE";
  if (params.startMinutes == null) return "A_VENIR";
  const elapsed = params.nowMinutes - params.startMinutes;
  if (elapsed < -10) return "A_VENIR";
  if (elapsed < 30) return "IMMINENTE";
  return "RESULTAT_IMMINENT";
}
