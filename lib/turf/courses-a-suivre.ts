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
 * Correction du 30/09/2026 (Steph) : un jour sans Nationale 2, la liste ne
 * montrait QUE des courses marocaines — elles passent avant les réunions
 * françaises. Or la majorité des visiteurs jouent le PMU France : un nouveau
 * venu pouvait croire à un site de courses marocaines. D'où :
 *
 * Règle, parmi les courses À VENIR (hors vedette, hors annulées) :
 *   - d'abord les courses FRANÇAISES : la Nationale 2, puis les courses
 *     relayées en Afrique (jouable_afrique), puis les autres — dans l'ordre
 *     des départs ;
 *   - puis UNE SEULE course marocaine, en dernier (la Nationale 3 de
 *     préférence), pour montrer que ces réunions sont aussi couvertes.
 *   Jamais de 2e course marocaine pour compléter : mieux vaut une liste courte.
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

export type EtiquetteCourse = "Nationale 2" | "Nationale 3" | "Nationale 3 · Maroc" | "Maroc" | "PMU France" | null;

export interface CourseASuivre<T> {
  course: T;
  etiquette: EtiquetteCourse;
}

/** Le pays en base, ou à défaut le nom (fiches encore enregistrées « France »). */
export function estHippodromeMarocain(h: { nom?: string | null; pays?: string | null } | null | undefined): boolean {
  if (!h) return false;
  return h.pays === "Maroc" || estNomHippodromeMarocain(h.nom);
}


function minutes(heure: string | null | undefined): number | null {
  const m = /^(\d{2}):(\d{2})/.exec(heure ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function etiquetteDe(c: CourseASuivreCandidate): EtiquetteCourse {
  if (estHippodromeMarocain(c.hippodrome)) return c.nationale === 3 ? "Nationale 3 · Maroc" : "Maroc";
  if (c.nationale === 2) return "Nationale 2";
  if (c.nationale === 3) return "Nationale 3";
  const pays = c.hippodrome?.pays;
  return !pays || pays === "France" ? "PMU France" : null;
}

export function pickCoursesASuivre<T extends CourseASuivreCandidate>(
  courses: T[],
  opts: { exclureId?: string | null; maintenantMinutesParis: number; max?: number },
): CourseASuivre<T>[] {
  const max = opts.max ?? 3;
  const aVenir = courses
    .filter((c) => {
      if (c.id === opts.exclureId || c.statut === "ANNULE") return false;
      // À venir = départ pas encore donné : une course partie ne se joue plus.
      const depart = minutes(c.heure_depart);
      return depart === null || depart >= opts.maintenantMinutesParis;
    })
    .sort((a, b) => (a.heure_depart ?? "").localeCompare(b.heure_depart ?? ""));

  const marocaines = aVenir.filter((c) => estHippodromeMarocain(c.hippodrome));
  const francaises = aVenir.filter((c) => !estHippodromeMarocain(c.hippodrome));
  const marocaine = marocaines.filter((c) => c.nationale === 3)[0] || marocaines[0];

  // Courses françaises par importance : Nationale 2, Nationale 3 (rare),
  // relayées en Afrique, puis les autres ; chaque groupe dans l'ordre des départs.
  const rang = (c: T) => (c.nationale === 2 ? 0 : c.nationale === 3 ? 1 : c.jouable_afrique === true ? 2 : 3);
  const triees = francaises
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rang(a.c) - rang(b.c) || a.i - b.i)
    .map((x) => x.c);

  const retenues = triees.slice(0, marocaine ? max - 1 : max);
  if (marocaine) retenues.push(marocaine);
  return retenues.map((course) => ({ course, etiquette: etiquetteDe(course) }));
}
