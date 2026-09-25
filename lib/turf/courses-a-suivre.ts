/**
 * « Courses à suivre » de la home (bloc sous la carte Vedette du Jour, tant
 * qu'aucun pronostic n'est publié) — demande de Steph, 25/09/2026 : montrer,
 * comme la LONACI, une Nationale 2, une Nationale 3 et une course du Maroc,
 * plutôt que les 3 premières courses du jour (souvent des courses sans intérêt
 * pour les abonnés : ex. Prix d'Arles, simple gagnant, 6 partants).
 *
 * Constat sur 60 jours : la Nationale 2 est toujours une course française ; la
 * Nationale 3 est toujours le quinté marocain (Settat, Anfa, Khemisset…).
 *
 * Règle, parmi les courses À VENIR (hors vedette, hors annulées) :
 *   1. la Nationale 2, 2. la Nationale 3, 3. une course marocaine ;
 *   puis on complète jusqu'à 3 par les prochaines courses jouables en Afrique,
 *   puis par les prochaines tout court.
 *
 * PUR, ES5-safe (pas de Map/Set), testé.
 */
import { estNomHippodromeMarocain } from "@/lib/sync/hippodrome-pays";

export interface CourseASuivreCandidate {
  id: string;
  heure_depart?: string | null;
  nationale?: number | null;
  jouable_afrique?: boolean | null;
  statut?: string | null;
  hippodrome?: { nom?: string | null; pays?: string | null } | null;
}

export type EtiquetteCourse = "Nationale 2" | "Nationale 3" | "Maroc" | null;

export interface CourseASuivre<T> {
  course: T;
  etiquette: EtiquetteCourse;
}

/** Le pays en base, ou à défaut le nom (fiches encore enregistrées « France »). */
export function estHippodromeMarocain(h: { nom?: string | null; pays?: string | null } | null | undefined): boolean {
  if (!h) return false;
  return h.pays === "Maroc" || estNomHippodromeMarocain(h.nom);
}

/** Même règle que la home : une course est « courue » 40 min après son départ. */
const MINUTES_APRES_DEPART = 40;

function minutes(heure: string | null | undefined): number | null {
  const m = /^(\d{2}):(\d{2})/.exec(heure ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function etiquetteDe(c: CourseASuivreCandidate): EtiquetteCourse {
  if (c.nationale === 2) return "Nationale 2";
  if (c.nationale === 3) return "Nationale 3";
  return estHippodromeMarocain(c.hippodrome) ? "Maroc" : null;
}

export function pickCoursesASuivre<T extends CourseASuivreCandidate>(
  courses: T[],
  opts: { exclureId?: string | null; maintenantMinutesParis: number; max?: number },
): CourseASuivre<T>[] {
  const max = opts.max ?? 3;
  const aVenir = courses
    .filter((c) => {
      if (c.id === opts.exclureId || c.statut === "ANNULE") return false;
      const depart = minutes(c.heure_depart);
      return depart === null || opts.maintenantMinutesParis - depart <= MINUTES_APRES_DEPART;
    })
    .sort((a, b) => (a.heure_depart ?? "").localeCompare(b.heure_depart ?? ""));

  const retenues: T[] = [];
  const dejaRetenue = (c: T) => retenues.indexOf(c) !== -1;
  const ajouter = (c: T | undefined) => {
    if (c && !dejaRetenue(c) && retenues.length < max) retenues.push(c);
  };

  ajouter(aVenir.filter((c) => c.nationale === 2)[0]);
  ajouter(aVenir.filter((c) => c.nationale === 3)[0]);
  ajouter(aVenir.filter((c) => !dejaRetenue(c) && estHippodromeMarocain(c.hippodrome))[0]);
  for (let i = 0; i < aVenir.length; i++) if (aVenir[i].jouable_afrique === true) ajouter(aVenir[i]);
  for (let i = 0; i < aVenir.length; i++) ajouter(aVenir[i]);

  return retenues.map((course) => ({ course, etiquette: etiquetteDe(course) }));
}
