import { canonicalHippodrome } from "./hippodrome-canonical";

/**
 * Logique PURE de l'enrichissement LONACI : rapproche chaque course LONACI
 * (France/Maroc) d'une course Geny EXISTANTE et calcule le verdict
 * "jouable Afrique" + Nationale. Ne touche jamais la BDD (testable en isolation).
 */
export interface EnrichInput {
  date: string;
  lonaciCourses: Array<{
    hippodrome: string;
    nReunion: number;
    numeroCourse: number;
    nationale: number; // 0 = pas Nationale, 1/2/3 sinon
  }>;
  genyCourses: Array<{
    id: string;
    hippodrome_id: string;
    numero_reunion: number;
    numero_course: number;
  }>;
  hippoCanonMap: Map<string, string>; // canonique(nom) -> hippodrome_id (existants)
}

export interface EnrichGuard {
  guardMinReunions: number; // ex: 3
  guardMinCoverage: number; // ex: 0.5
}

export interface CourseUpdate {
  id: string;
  jouable_afrique: boolean;
  nationale: number | null;
}

export interface EnrichReport {
  date: string;
  lonaci_total: number;
  matched: number;
  unmatched_hippodrome: number;
  unmatched_course: number;
  corrected_false: number;
  nationales: { n1: number; n2: number; n3: number };
  program_complete: boolean;
}

export interface EnrichResult {
  updates: CourseUpdate[];
  report: EnrichReport;
}

const courseKey = (hipId: string, r: number, c: number) => `${hipId}|${r}|${c}`;

export function computeLonaciEnrichment(input: EnrichInput, guard: EnrichGuard): EnrichResult {
  const genyByKey = new Map<string, string>(); // key -> course id
  for (const g of input.genyCourses) {
    genyByKey.set(courseKey(g.hippodrome_id, g.numero_reunion, g.numero_course), g.id);
  }

  const matchedIds = new Set<string>();
  const updates: CourseUpdate[] = [];
  let unmatchedHippodrome = 0;
  let unmatchedCourse = 0;
  const nat = { n1: 0, n2: 0, n3: 0 };
  const matchedLonaciReunions = new Set<number>();

  for (const lc of input.lonaciCourses) {
    const hid = input.hippoCanonMap.get(canonicalHippodrome(lc.hippodrome));
    if (!hid) {
      unmatchedHippodrome++;
      continue;
    }
    const cid = genyByKey.get(courseKey(hid, lc.nReunion, lc.numeroCourse));
    if (!cid) {
      unmatchedCourse++;
      continue;
    }
    if (matchedIds.has(cid)) continue;
    matchedIds.add(cid);
    matchedLonaciReunions.add(lc.nReunion);
    const nationale = lc.nationale > 0 ? lc.nationale : null;
    if (nationale === 1) nat.n1++;
    else if (nationale === 2) nat.n2++;
    else if (nationale === 3) nat.n3++;
    updates.push({ id: cid, jouable_afrique: true, nationale });
  }

  // Garde-fou : le programme LONACI du jour est-il "complet" ?
  const genyReunions = new Set(input.genyCourses.map((g) => g.numero_reunion));
  const coverage = genyReunions.size === 0 ? 0 : matchedLonaciReunions.size / genyReunions.size;
  const programComplete =
    matchedLonaciReunions.size >= guard.guardMinReunions && coverage >= guard.guardMinCoverage;

  let correctedFalse = 0;
  if (programComplete) {
    for (const g of input.genyCourses) {
      if (!matchedIds.has(g.id)) {
        updates.push({ id: g.id, jouable_afrique: false, nationale: null });
        correctedFalse++;
      }
    }
  }

  return {
    updates,
    report: {
      date: input.date,
      lonaci_total: input.lonaciCourses.length,
      matched: matchedIds.size,
      unmatched_hippodrome: unmatchedHippodrome,
      unmatched_course: unmatchedCourse,
      corrected_false: correctedFalse,
      nationales: nat,
      program_complete: programComplete,
    },
  };
}
