/**
 * lib/sync/genybet-discipline.ts
 *
 * OVERLAY DISCIPLINE (correctif « tout en Plat ») — source GenyBet.
 *
 * Contexte : le programme est inséré avec `categorie` en dur = "PLAT" par la
 * voie Geny (`geny-programme.ts`, la page programme Geny n'expose pas la
 * discipline) ET par LONACI (`lonaci-programme.ts`, flux sans discipline). Et
 * `categorie` est write-once (les upsert ne la corrigent jamais). Le seul
 * correcteur historique (`enrichir-partants` via Geny.com) est mort : le Worker
 * CF est bloqué (403/429) par Geny.com → 0 partant → 0 correction.
 *
 * GenyBet (site sœur de Geny, MÊMES données, domaine NON bloqué) expose la
 * discipline via `icon-race trot-attele/galop-plat/galop-haie` et est DÉJÀ
 * parsée par `parseGenybetReunions` (→ `categorie`). Cet overlay rejoue ce
 * parsing et UPDATE `courses.categorie` sur les courses EXISTANTES, en matchant
 * par (hippodrome canonique, réunion, course) — la même clé que lonaci-enrich.
 *
 * Anti-fabrication : une course parsée sans correspondance en base (hippodrome
 * inconnu ou réunion/course absente) n'est JAMAIS inventée — elle est comptée
 * `unmatched` et ignorée. La partie pure (`computeDisciplineUpdates`) ne touche
 * jamais la BDD → testable en isolation.
 */
import { createServiceClient } from "@/lib/supabase/service-client";
import { canonicalHippodrome } from "./hippodrome-canonical";
import { fetchGenybetHtml, parseGenybetReunions, toGenybetDate } from "./genybet-programme";

export type Categorie = "PLAT" | "TROT" | "OBSTACLE";

export interface DisciplineInput {
  parsedCourses: Array<{
    hippodrome:   string;
    nReunion:     number;
    numeroCourse: number;
    categorie:    Categorie;
  }>;
  dbCourses: Array<{
    id:             string;
    hippodrome_id:  string;
    numero_reunion: number;
    numero_course:  number;
    categorie:      string | null;
  }>;
  /** canonique(nom) -> hippodrome_id (hippodromes EXISTANTS en base). */
  hippoCanonMap: Map<string, string>;
}

export interface DisciplineUpdate {
  id:        string;
  categorie: Categorie;
}

export interface DisciplineReport {
  parsed_total:         number;
  matched:              number;
  updated:              number;
  unchanged:            number;
  unmatched_hippodrome: number;
  unmatched_course:     number;
}

export interface DisciplineResult {
  updates: DisciplineUpdate[];
  report:  DisciplineReport;
}

const courseKey = (hipId: string, r: number, c: number) => `${hipId}|${r}|${c}`;

/**
 * PUR : calcule les UPDATE de `categorie` à partir des courses GenyBet parsées
 * et des courses en base. Ne met à jour QUE celles qui matchent ET divergent.
 */
export function computeDisciplineUpdates(input: DisciplineInput): DisciplineResult {
  const dbByKey = new Map<string, { id: string; categorie: string | null }>();
  for (const c of input.dbCourses) {
    dbByKey.set(courseKey(c.hippodrome_id, c.numero_reunion, c.numero_course), {
      id: c.id,
      categorie: c.categorie,
    });
  }

  const updates: DisciplineUpdate[] = [];
  const seen = new Set<string>(); // garde-fou : 1 update max par course
  let matched = 0;
  let updated = 0;
  let unchanged = 0;
  let unmatchedHippodrome = 0;
  let unmatchedCourse = 0;

  for (const pc of input.parsedCourses) {
    const hid = input.hippoCanonMap.get(canonicalHippodrome(pc.hippodrome));
    if (!hid) {
      unmatchedHippodrome++;
      continue;
    }
    const db = dbByKey.get(courseKey(hid, pc.nReunion, pc.numeroCourse));
    if (!db) {
      unmatchedCourse++;
      continue;
    }
    if (seen.has(db.id)) continue;
    seen.add(db.id);
    matched++;

    if (db.categorie === pc.categorie) {
      unchanged++;
    } else {
      updates.push({ id: db.id, categorie: pc.categorie });
      updated++;
    }
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
    },
  };
}

export interface DisciplineSyncResult extends DisciplineReport {
  date:        string;
  db_courses:  number;
  applied:     number;   // lignes réellement écrites (0 si dryRun)
  dry_run:     boolean;
}

/**
 * Runner : fetch GenyBet pour une date, parse la discipline, matche les courses
 * EXISTANTES en base et applique les UPDATE `categorie`. Best-effort côté appel
 * (à envelopper dans un try/catch : un incident GenyBet ne doit jamais casser le
 * chargement du programme). `dryRun` calcule sans écrire (audit/backfill à sec).
 */
export async function runGenybetDisciplineSync(
  dateISO: string,
  opts: { dryRun?: boolean } = {},
): Promise<DisciplineSyncResult> {
  const dryRun = opts.dryRun ?? false;
  const supabase = createServiceClient();

  // 1. GenyBet (non bloqué) → courses parsées avec vraie discipline.
  const html = await fetchGenybetHtml(`https://www.genybet.fr/reunions/${toGenybetDate(dateISO)}`);
  const parsed = parseGenybetReunions(html, dateISO);
  const parsedCourses = parsed.map((p) => ({
    hippodrome:   p.hippodromeName,
    nReunion:     p.numeroReunion,
    numeroCourse: p.numeroCourse,
    categorie:    p.categorie,
  }));

  // 2. Courses EXISTANTES de la date + leurs hippodromes (pour la clé canonique).
  const { data: dbCoursesRaw } = await supabase
    .from("courses")
    .select("id, hippodrome_id, numero_reunion, numero_course, categorie, hippodromes(nom)")
    .eq("date_course", dateISO);
  const dbCourses = (dbCoursesRaw ?? []) as Array<{
    id: string; hippodrome_id: string; numero_reunion: number;
    numero_course: number; categorie: string | null;
    hippodromes: { nom: string } | { nom: string }[] | null;
  }>;

  const hippoCanonMap = new Map<string, string>();
  for (const c of dbCourses) {
    const h = Array.isArray(c.hippodromes) ? c.hippodromes[0] : c.hippodromes;
    if (h?.nom) hippoCanonMap.set(canonicalHippodrome(h.nom), c.hippodrome_id);
  }

  // 3. Calcul PUR des updates.
  const { updates, report } = computeDisciplineUpdates({
    parsedCourses,
    dbCourses: dbCourses.map((c) => ({
      id: c.id, hippodrome_id: c.hippodrome_id, numero_reunion: c.numero_reunion,
      numero_course: c.numero_course, categorie: c.categorie,
    })),
    hippoCanonMap,
  });

  // 4. Application : groupée par catégorie cible → au plus 3 UPDATE bulk
  //    (PLAT/TROT/OBSTACLE). Un vrai UPDATE (pas un upsert partiel qui buterait
  //    sur les colonnes NOT NULL via INSERT…ON CONFLICT), et ≤3 subrequests →
  //    safe vs la limite Cloudflare Workers Free (50/invocation).
  let applied = 0;
  if (!dryRun && updates.length > 0) {
    const CATS: Categorie[] = ["PLAT", "TROT", "OBSTACLE"];
    for (const cat of CATS) {
      const ids = updates.filter((u) => u.categorie === cat).map((u) => u.id);
      if (ids.length === 0) continue;
      const { error, count } = await supabase
        .from("courses")
        .update({ categorie: cat }, { count: "exact" })
        .in("id", ids);
      if (error) throw new Error(`UPDATE categorie=${cat} échoué: ${error.message}`);
      applied += count ?? ids.length;
    }
  }

  return { date: dateISO, db_courses: dbCourses.length, applied, dry_run: dryRun, ...report };
}
