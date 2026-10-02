/**
 * lib/selection/preparer.ts
 *
 * La « Sélection stats » telle qu'un visiteur la voit. SOURCE UNIQUE pour la
 * fiche course et pour la photo prise ~10 min avant le départ (cron
 * photo-selection) : le bilan doit porter sur exactement ce qui est affiché.
 */
import { cotesPlausibles } from "@/lib/cotes/fiabilite";
import { appliquerCotesCsv } from "@/lib/cotes/cotes-du-moment";
import type { PmuCoteRow } from "@/lib/cotes/pmu-csv";
import { getCourseStatsEnrichies, type CourseStatsEnrichies } from "@/lib/courses/getCourseStatsEnrichies";
import { buildNotreSelection, type NotreSelectionItem } from "@/lib/courses/notre-selection";

export interface SelectionPreparee {
  /** Tous les partants (non-partants compris), triés par numéro, avec des cotes fiables. */
  tous: any[];
  partants: any[];
  nonPartants: any[];
  /** "csv" quand les cotes du moment ont remplacé celles de la base. */
  sourceCotes: "csv" | "base";
  stats: CourseStatsEnrichies;
  selection: NotreSelectionItem[];
}

/**
 * @param csv Cotes du moment (CSV PMU de l'Apps Script) si l'appelant les a
 *   chargées (course qui part bientôt), sinon null → cotes de la base.
 */
export async function preparerSelection(
  partantsBruts: any[],
  course: { numero_reunion: number; numero_course: number },
  csv: Map<string, PmuCoteRow> | null,
): Promise<SelectionPreparee> {
  const tries = [...partantsBruts].sort((a, b) => a.numero - b.numero);
  // Cotes factices (LONACI « 1,2 » pour chaque cheval, masse sans pari) → aucune cote.
  const base = cotesPlausibles(tries.filter((p) => !p.non_partant).map((p) => p.cote))
    ? tries
    : tries.map((p) => ({ ...p, cote: null }));
  const tous = csv ? appliquerCotesCsv(base, course.numero_reunion, course.numero_course, csv) : base;
  const partants = tous.filter((p) => !p.non_partant);
  const stats = await getCourseStatsEnrichies(partants);
  return {
    tous,
    partants,
    nonPartants: tous.filter((p) => p.non_partant),
    sourceCotes: tous !== base ? "csv" : "base",
    stats,
    selection: buildNotreSelection(stats.partants),
  };
}
