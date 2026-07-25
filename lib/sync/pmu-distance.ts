/**
 * lib/sync/pmu-distance.ts
 *
 * OVERLAY DISTANCE (correctif « 0m partout ») — source API PMU.
 *
 * Contexte : `courses.distance_metres` est inséré à `0` en dur par la voie Geny
 * (`geny-programme.ts:339`) et par GenyBet (`genybet-programme.ts:138`, dont le
 * commentaire « enrichie ailleurs » est faux — rien n'écrivait cette colonne
 * après l'insertion). Comme `categorie` avant le fix discipline, la colonne est
 * write-once : une course insérée à 0 restait à 0 pour toujours (96 % de la base).
 *
 * L'API PMU expose la vraie distance et reste joignable via le proxy
 * `pmu-proxy` (l'IP du Worker CF est bloquée en direct). Cet overlay rejoue le
 * programme PMU et UPDATE `distance_metres` sur les courses EXISTANTES, en
 * matchant par (hippodrome canonique, réunion, course) — même schéma que
 * `genybet-discipline.ts`.
 *
 * ⚠️ Clés de matching vérifiées sur la réponse réelle de l'API (2026-07-25) :
 *   - réunion  → `numExterne` (et NON `numOrdre`, absent de la réponse) ;
 *   - hippodrome → `libelleCourt` ("ENGHIEN"), car `libelleLong`
 *     ("HIPPODROME D'ENGHIEN SOISY") ne correspond pas aux noms en base.
 *
 * Anti-fabrication (strict) : on n'écrit jamais une distance qu'on n'a pas.
 * Course absente de PMU, distance manquante/0, ou valeur hors plage plausible
 * → aucune écriture, la valeur en base est laissée intacte et comptée.
 */
import { createServiceClient } from "@/lib/supabase/service-client";
import { canonicalHippodrome } from "./hippodrome-canonical";

/** Plage plausible d'une course hippique (les vraies valeurs en base : 1000-4400 m). */
const DISTANCE_MIN = 800;
const DISTANCE_MAX = 8000;

export interface DistanceInput {
  parsedCourses: Array<{
    hippodrome:     string;
    nReunion:       number;
    numeroCourse:   number;
    distanceMetres: number;
  }>;
  dbCourses: Array<{
    id:              string;
    hippodrome_id:   string;
    numero_reunion:  number;
    numero_course:   number;
    distance_metres: number | null;
  }>;
  /** canonique(nom) -> hippodrome_id (hippodromes EXISTANTS en base). */
  hippoCanonMap: Map<string, string>;
}

export interface DistanceUpdate {
  id:              string;
  distance_metres: number;
}

export interface DistanceReport {
  parsed_total:         number;
  matched:              number;
  updated:              number;
  unchanged:            number;
  unmatched_hippodrome: number;
  unmatched_course:     number;
  /** Course matchée mais PMU ne donne pas de distance → on ne touche à rien. */
  source_sans_distance: number;
  /** Distance hors plage plausible → refusée plutôt qu'écrite. */
  rejected_aberrant:    number;
}

export interface DistanceResult {
  updates: DistanceUpdate[];
  report:  DistanceReport;
}

const courseKey = (hipId: string, r: number, c: number) => `${hipId}|${r}|${c}`;

/**
 * PUR : calcule les UPDATE de `distance_metres`. N'émet une écriture que si la
 * source fournit une distance plausible ET différente de celle en base.
 */
export function computeDistanceUpdates(input: DistanceInput): DistanceResult {
  const dbByKey = new Map<string, { id: string; distance_metres: number | null }>();
  for (const c of input.dbCourses) {
    dbByKey.set(courseKey(c.hippodrome_id, c.numero_reunion, c.numero_course), {
      id: c.id,
      distance_metres: c.distance_metres,
    });
  }

  const updates: DistanceUpdate[] = [];
  const seen = new Set<string>();
  let matched = 0, updated = 0, unchanged = 0;
  let unmatchedHippodrome = 0, unmatchedCourse = 0;
  let sourceSansDistance = 0, rejectedAberrant = 0;

  for (const pc of input.parsedCourses) {
    const hid = input.hippoCanonMap.get(canonicalHippodrome(pc.hippodrome));
    if (!hid) { unmatchedHippodrome++; continue; }

    const db = dbByKey.get(courseKey(hid, pc.nReunion, pc.numeroCourse));
    if (!db) { unmatchedCourse++; continue; }

    if (seen.has(db.id)) continue;
    seen.add(db.id);
    matched++;

    const d = pc.distanceMetres;

    // Anti-fabrication : pas de distance exploitable → on ne touche à rien.
    if (!d) { sourceSansDistance++; continue; }
    if (d < DISTANCE_MIN || d > DISTANCE_MAX) { rejectedAberrant++; continue; }

    if (db.distance_metres === d) unchanged++;
    else { updates.push({ id: db.id, distance_metres: d }); updated++; }
  }

  return {
    updates,
    report: {
      parsed_total: input.parsedCourses.length,
      matched,
      updated,
      unchanged,
      unmatched_hippodrome: unmatchedHippodrome,
      unmatched_course: unmatchedCourse,
      source_sans_distance: sourceSansDistance,
      rejected_aberrant: rejectedAberrant,
    },
  };
}

// ── Fetch programme PMU (brut : pas de filtre de curation) ────────────────
//
// On NE réutilise PAS `normalizePmuReunions` : elle filtre à >= 8 partants
// (curation à l'insertion du programme). Pour un overlay d'enrichissement ce
// filtre laisserait des courses non corrigées — on lit donc le programme brut.

const PMU_PROXY = process.env.PMU_PROXY || "https://pmu-proxy.manuel-conti2008.workers.dev";
const FETCH_TIMEOUT_MS = 15_000;

interface PmuRawReunion {
  numExterne?: number;
  numOrdre?:   number;
  hippodrome?: { libelleCourt?: string; libelleLong?: string };
  courses?:    Array<{ numOrdre?: number; numExterne?: number; distance?: number }>;
}

/** "YYYY-MM-DD" -> "DDMMYYYY" (format d'URL du programme PMU). */
export function toPmuDate(dateISO: string): string {
  const [y, m, d] = dateISO.split("-");
  return `${d}${m}${y}`;
}

/**
 * Programme PMU brut d'une date -> (hippodrome, réunion, course, distance).
 * PURE côté transformation : `parsePmuProgrammeDistances` est testable sur un
 * objet JSON de fixture.
 */
export function parsePmuProgrammeDistances(
  payload: { programme?: { reunions?: PmuRawReunion[] } },
): DistanceInput["parsedCourses"] {
  const out: DistanceInput["parsedCourses"] = [];
  for (const reu of payload.programme?.reunions ?? []) {
    // `numExterne` d'abord : `numOrdre` est absent de la réponse réelle.
    const R = reu.numExterne ?? reu.numOrdre;
    const hippo = reu.hippodrome?.libelleCourt || reu.hippodrome?.libelleLong || "";
    if (R === undefined || !hippo) continue;
    for (const c of reu.courses ?? []) {
      const C = c.numOrdre ?? c.numExterne;
      if (C === undefined) continue;
      out.push({
        hippodrome: hippo,
        nReunion: R,
        numeroCourse: C,
        distanceMetres: c.distance ?? 0,
      });
    }
  }
  return out;
}

export async function fetchPmuProgrammeRaw(dateISO: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${PMU_PROXY}/rest/client/61/programme/${toPmuDate(dateISO)}`, {
      headers: {
        "Accept":     "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer":    "https://www.pmu.fr/",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`PMU HTTP ${res.status} pour ${dateISO}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export interface DistanceSyncResult extends DistanceReport {
  date:       string;
  db_courses: number;
  applied:    number;
  dry_run:    boolean;
}

/**
 * Runner : fetch PMU pour une date, matche les courses EXISTANTES et applique
 * les UPDATE `distance_metres`. Best-effort côté appelant (à envelopper dans un
 * try/catch : un incident PMU ne doit jamais casser le chargement du programme).
 */
export async function runPmuDistanceSync(
  dateISO: string,
  opts: { dryRun?: boolean } = {},
): Promise<DistanceSyncResult> {
  const dryRun = opts.dryRun ?? false;
  const supabase = createServiceClient();

  const payload = await fetchPmuProgrammeRaw(dateISO);
  const parsedCourses = parsePmuProgrammeDistances(
    payload as { programme?: { reunions?: PmuRawReunion[] } },
  );

  const { data: dbRaw } = await supabase
    .from("courses")
    .select("id, hippodrome_id, numero_reunion, numero_course, distance_metres, hippodromes(nom)")
    .eq("date_course", dateISO);
  const dbCourses = (dbRaw ?? []) as Array<{
    id: string; hippodrome_id: string; numero_reunion: number;
    numero_course: number; distance_metres: number | null;
    hippodromes: { nom: string } | { nom: string }[] | null;
  }>;

  const hippoCanonMap = new Map<string, string>();
  for (const c of dbCourses) {
    const h = Array.isArray(c.hippodromes) ? c.hippodromes[0] : c.hippodromes;
    if (h?.nom) hippoCanonMap.set(canonicalHippodrome(h.nom), c.hippodrome_id);
  }

  const { updates, report } = computeDistanceUpdates({
    parsedCourses,
    dbCourses: dbCourses.map((c) => ({
      id: c.id, hippodrome_id: c.hippodrome_id, numero_reunion: c.numero_reunion,
      numero_course: c.numero_course, distance_metres: c.distance_metres,
    })),
    hippoCanonMap,
  });

  // Application : groupée par distance identique → 1 UPDATE bulk par valeur
  // distincte (bien moins de subrequests qu'un update par ligne).
  let applied = 0;
  if (!dryRun && updates.length > 0) {
    const byDistance = new Map<number, string[]>();
    for (const u of updates) {
      const ids = byDistance.get(u.distance_metres);
      if (ids) ids.push(u.id);
      else byDistance.set(u.distance_metres, [u.id]);
    }
    const entries: Array<[number, string[]]> = [];
    byDistance.forEach((ids, d) => entries.push([d, ids]));
    for (const entry of entries) {
      const { error, count } = await supabase
        .from("courses")
        .update({ distance_metres: entry[0] }, { count: "exact" })
        .in("id", entry[1]);
      if (error) throw new Error(`UPDATE distance_metres=${entry[0]} échoué: ${error.message}`);
      applied += count ?? entry[1].length;
    }
  }

  return { date: dateISO, db_courses: dbCourses.length, applied, dry_run: dryRun, ...report };
}
