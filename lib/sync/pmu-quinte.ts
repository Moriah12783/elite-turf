/**
 * lib/sync/pmu-quinte.ts
 *
 * OVERLAY QUINTÉ+ — source API PMU (programme officiel).
 *
 * Contexte (constaté le 01/10/2026) : la veille au soir, le programme de J+1
 * vient de GenyBet, qui ne connaît pas les types de paris et marque comme
 * Quinté+ « la course au plus gros peloton de la réunion Quinté »
 * (genybet-programme.ts). Estimation fausse environ un jour sur deux : pour le
 * 02/10/2026, GenyBet désignait le Prix Atalante (R1C3, 18 partants), le PMU
 * le Prix Ludovica (R1C4). La LONACI ne corrige qu'au matin du jour J
 * (`nationale = 1`) : toute la nuit, l'accueil, /quinte-plus et les pages
 * pays montraient la mauvaise course comme le Quinté+.
 *
 * Cet overlay rejoue le programme PMU (`/programme/{DDMMYYYY}`, le même point
 * d'accès que l'overlay distance) et aligne les trois paris NATIONAUX
 * (Quinté+, Quarté+, Tiercé) de chaque course appariée sur ceux du PMU.
 *
 * Garde-fous (anti-fabrication) :
 *   - rien n'est écrit si le PMU ne désigne pas exactement UN Quinté+, ou si
 *     ce Quinté+ n'est pas apparié à une course en base ;
 *   - une course étiquetée par la LONACI (`nationale` renseigné) n'est jamais
 *     touchée : la LONACI pose ses propres Quarté+ / Tiercé sur ses
 *     Nationales 2 et 3 (augmentParisFromNationale) ;
 *   - les autres paris de la course sont laissés intacts.
 *
 * Appariement identique à l'overlay distance : (hippodrome canonique,
 * réunion `numExterne`, course `numOrdre`).
 */
import { createServiceClient } from "@/lib/supabase/service-client";
import { canonicalHippodrome } from "./hippodrome-canonical";
import { fetchPmuProgrammeRaw } from "./pmu-distance";

/** Paris réservés en France à la course du Quinté+. Ordre d'écriture. */
export const PARIS_NATIONAUX = ["QUINTE_PLUS", "QUARTE_PLUS", "TIERCE"];

const PMU_VERS_NATIONAL: Record<string, string> = {
  E_QUINTE_PLUS: "QUINTE_PLUS",
  E_QUARTE_PLUS: "QUARTE_PLUS",
  E_TIERCE: "TIERCE",
};

export interface CoursePmuParis {
  hippodrome: string;
  nReunion: number;
  numeroCourse: number;
  /** Sous-ensemble de PARIS_NATIONAUX proposé par le PMU sur cette course. */
  parisNationaux: string[];
}

export interface CourseBaseParis {
  id: string;
  hippodrome_id: string;
  numero_reunion: number;
  numero_course: number;
  nationale: number | null;
  paris_disponibles: string[] | null;
}

export interface QuinteInput {
  parsedCourses: CoursePmuParis[];
  dbCourses: CourseBaseParis[];
  /** canonique(nom) -> hippodrome_id (hippodromes EXISTANTS en base). */
  hippoCanonMap: Map<string, string>;
}

export interface QuinteUpdate {
  id: string;
  paris_disponibles: string[];
}

export interface QuinteReport {
  /** Nombre de courses portant le Quinté+ au programme PMU (attendu : 1). */
  quintes_pmu: number;
  quinte_apparie: boolean;
  matched: number;
  updated: number;
  /** Courses étiquetées par la LONACI, laissées telles quelles. */
  ignorees_lonaci: number;
  /** Pourquoi rien n'a été écrit, le cas échéant. */
  raison: string | null;
}

interface PmuRawReunion {
  numExterne?: number;
  numOfficiel?: number;
  numOrdre?: number;
  hippodrome?: { libelleCourt?: string; libelleLong?: string };
  courses?: Array<{ numOrdre?: number; numExterne?: number; paris?: Array<{ typePari?: string }> }>;
}

/** PUR : programme PMU brut → paris nationaux de chaque course. */
export function parsePmuProgrammeParis(
  payload: { programme?: { reunions?: PmuRawReunion[] } } | null | undefined,
): CoursePmuParis[] {
  const out: CoursePmuParis[] = [];
  const reunions = (payload && payload.programme && payload.programme.reunions) || [];
  for (const reu of reunions) {
    const R = reu.numExterne ?? reu.numOfficiel ?? reu.numOrdre;
    const hippo = (reu.hippodrome && (reu.hippodrome.libelleCourt || reu.hippodrome.libelleLong)) || "";
    if (R === undefined || !hippo) continue;
    for (const c of reu.courses || []) {
      const C = c.numOrdre ?? c.numExterne;
      if (C === undefined) continue;
      const nationaux: string[] = [];
      for (const p of c.paris || []) {
        const code = p && p.typePari ? PMU_VERS_NATIONAL[p.typePari] : undefined;
        if (code && nationaux.indexOf(code) === -1) nationaux.push(code);
      }
      out.push({ hippodrome: hippo, nReunion: R, numeroCourse: C, parisNationaux: nationaux });
    }
  }
  return out;
}

/** Paris de la course, avec les trois paris nationaux alignés sur le PMU. */
export function alignerParisNationaux(actuels: string[], nationauxPmu: string[]): string[] {
  const out = actuels.filter((p) => PARIS_NATIONAUX.indexOf(p) === -1);
  for (const p of PARIS_NATIONAUX) if (nationauxPmu.indexOf(p) !== -1) out.push(p);
  return out;
}

function memesParis(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const x = a.slice().sort();
  const y = b.slice().sort();
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

const courseKey = (hipId: string, r: number, c: number) => `${hipId}|${r}|${c}`;

/** PUR : calcule les UPDATE de `paris_disponibles`. Voir les garde-fous en tête. */
export function computeQuinteUpdates(input: QuinteInput): { updates: QuinteUpdate[]; report: QuinteReport } {
  const report: QuinteReport = {
    quintes_pmu: 0, quinte_apparie: false, matched: 0, updated: 0, ignorees_lonaci: 0, raison: null,
  };

  const quintes = input.parsedCourses.filter((c) => c.parisNationaux.indexOf("QUINTE_PLUS") !== -1);
  report.quintes_pmu = quintes.length;
  if (quintes.length !== 1) {
    report.raison = `${quintes.length} Quinté+ au programme PMU (1 attendu) : rien n'est modifié`;
    return { updates: [], report };
  }

  const dbByKey = new Map<string, CourseBaseParis>();
  for (const c of input.dbCourses) dbByKey.set(courseKey(c.hippodrome_id, c.numero_reunion, c.numero_course), c);
  const cle = (pc: CoursePmuParis): string | null => {
    const hid = input.hippoCanonMap.get(canonicalHippodrome(pc.hippodrome));
    return hid ? courseKey(hid, pc.nReunion, pc.numeroCourse) : null;
  };

  const cleQuinte = cle(quintes[0]);
  if (!cleQuinte || !dbByKey.has(cleQuinte)) {
    report.raison = "Quinté+ du PMU introuvable en base : rien n'est modifié";
    return { updates: [], report };
  }
  report.quinte_apparie = true;

  const updates: QuinteUpdate[] = [];
  const vus: Record<string, boolean> = {};
  for (const pc of input.parsedCourses) {
    const k = cle(pc);
    const db = k ? dbByKey.get(k) : undefined;
    if (!db || vus[db.id]) continue;
    vus[db.id] = true;
    report.matched++;
    if (db.nationale !== null && db.nationale !== undefined) {
      report.ignorees_lonaci++;
      continue;
    }
    const actuels = db.paris_disponibles || [];
    const voulus = alignerParisNationaux(actuels, pc.parisNationaux);
    if (!memesParis(actuels, voulus)) {
      updates.push({ id: db.id, paris_disponibles: voulus });
      report.updated++;
    }
  }
  return { updates, report };
}

export interface QuinteSyncResult extends QuinteReport {
  date: string;
  db_courses: number;
  applied: number;
  dry_run: boolean;
}

/**
 * Runner : fetch PMU pour une date, apparie les courses EXISTANTES et aligne
 * leurs paris nationaux. Best-effort côté appelant (try/catch) : un incident
 * PMU ne doit jamais casser le chargement du programme.
 */
export async function runPmuQuinteSync(
  dateISO: string,
  opts: { dryRun?: boolean } = {},
): Promise<QuinteSyncResult> {
  const dryRun = opts.dryRun ?? false;
  const supabase = createServiceClient();

  const payload = await fetchPmuProgrammeRaw(dateISO);
  const parsedCourses = parsePmuProgrammeParis(payload as { programme?: { reunions?: PmuRawReunion[] } });

  const { data: dbRaw } = await supabase
    .from("courses")
    .select("id, hippodrome_id, numero_reunion, numero_course, nationale, paris_disponibles, hippodromes(nom)")
    .eq("date_course", dateISO);
  const dbCourses = (dbRaw ?? []) as Array<CourseBaseParis & {
    hippodromes: { nom: string } | { nom: string }[] | null;
  }>;

  const hippoCanonMap = new Map<string, string>();
  for (const c of dbCourses) {
    const h = Array.isArray(c.hippodromes) ? c.hippodromes[0] : c.hippodromes;
    if (h?.nom) hippoCanonMap.set(canonicalHippodrome(h.nom), c.hippodrome_id);
  }

  const { updates, report } = computeQuinteUpdates({ parsedCourses, dbCourses, hippoCanonMap });

  let applied = 0;
  if (!dryRun) {
    for (const u of updates) {
      // `nationale` nul revérifié à l'écriture : la LONACI a pu passer entre-temps.
      const { error } = await supabase
        .from("courses")
        .update({ paris_disponibles: u.paris_disponibles })
        .eq("id", u.id)
        .is("nationale", null);
      if (error) console.warn(`[pmu-quinte] UPDATE ${u.id} KO : ${error.message}`);
      else applied++;
    }
  }

  return { ...report, date: dateISO, db_courses: dbCourses.length, applied, dry_run: dryRun };
}
