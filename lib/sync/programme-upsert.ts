/**
 * lib/sync/programme-upsert.ts
 *
 * Upsert PARTAGÉ du programme (hippodromes + courses), utilisé par les voies
 * PMU.fr, LONACI et GenyBet (fallbacks quand Geny bloque). Logique identique à
 * celle de la voie Geny — une seule source de vérité pour l'écriture.
 *
 * ⚠️ CONTRAT ANTI-SILENT-FAILURE : toute requête Supabase en échec lève une
 * exception, et `inserted`/`updated` ne comptent que les lignes que la base
 * confirme avoir écrites (`count: "exact"`).
 *
 * Historique du bug : le `{ error }` de supabase-js n'était lu NULLE PART. Un
 * INSERT refusé (NOT NULL sur `numero_reunion`, overflow numérique, RLS…)
 * renvoyait quand même `inserted: N`. `programmeFallback` (geny-programme.ts)
 * en concluait que le programme était chargé et NE basculait PAS sur la source
 * suivante de la chaîne Geny → PMU → LONACI → GenyBet : le programme du jour
 * restait vide, sans erreur nulle part. Même piège sur la résolution des
 * hippodromes (courses silencieusement ignorées) et sur le SELECT des courses
 * existantes (ré-insertion → doublons).
 *
 * PUR (client Supabase sans next/headers) → bundlable Node sur GitHub Actions.
 */
import { createServiceClient } from "@/lib/supabase/service-client";
import { canonicalHippodrome } from "@/lib/sync/hippodrome-canonical";

/** Forme normalisée commune (PMU.fr `NormalizedCourse` la satisfait déjà). */
export interface ProgrammeCourse {
  hippodromeName:   string;
  hippodromePays:   string;
  dateCourse:       string;   // "YYYY-MM-DD"
  heureDepart:      string;   // "HH:MM:SS"
  numeroReunion:    number;
  numeroCourse:     number;
  libelle:          string;
  distanceMetres:   number;
  categorie:        "PLAT" | "TROT" | "OBSTACLE";
  nbPartants:       number;
  parisDisponibles: string[];
}

export interface UpsertResult {
  inserted:    number;
  updated:     number;
  hippodromes: number;
}

// ── Client Supabase : sous-ensemble réellement appelé ici ──────────────────
//
// Typer explicitement ce qu'on utilise permet d'injecter un double en test
// (`opts.client`) et donc d'exercer le VRAI câblage — lecture des `{ error }`
// comprise — sans base de données.

/** Réponse brute d'une requête supabase-js (sous-ensemble utilisé ici). */
interface SupabaseResponse {
  data:   unknown[] | null;
  error:  { message: string } | null;
  count?: number | null;
}

/** SELECT chaînable : `.in(...).in(...)` puis `await`. */
interface SelectBuilder extends PromiseLike<SupabaseResponse> {
  in(column: string, values: readonly (string | number)[]): SelectBuilder;
}

/** INSERT : `await` direct, ou `.select(...)` pour récupérer les lignes créées. */
interface InsertBuilder extends PromiseLike<SupabaseResponse> {
  select(columns: string): PromiseLike<SupabaseResponse>;
}

export interface ProgrammeUpsertClient {
  from(table: string): {
    select(columns: string): SelectBuilder;
    insert(rows: Record<string, unknown>[], options?: { count?: "exact" }): InsertBuilder;
    upsert(rows: Record<string, unknown>[], options?: { count?: "exact" }): PromiseLike<SupabaseResponse>;
  };
}

/**
 * ANTI-SILENT-FAILURE : toute erreur renvoyée par supabase-js remonte en
 * exception. Une écriture refusée (NOT NULL, overflow numérique, RLS…) ne doit
 * JAMAIS passer pour un succès : l'appelant (`programmeFallback`) compte sur
 * l'exception pour basculer sur la source suivante de la chaîne
 * Geny → PMU → LONACI → GenyBet. Sans ça, le programme du jour reste vide.
 */
function assertOk(operation: string, res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(`programme-upsert: ${operation} échoué — ${res.error.message}`);
}

/**
 * Résout les hippodromes (SELECT bulk + INSERT des manquants) puis
 * insère/upsert les courses. Ne crée jamais de doublon (clé
 * hippodrome_id + date + réunion + course).
 *
 * @param opts.client client Supabase injectable (test). Défaut : service role.
 * @throws si une requête Supabase échoue (voir `assertOk`).
 */
export async function upsertProgrammeCourses(
  courses: ProgrammeCourse[],
  opts: { client?: ProgrammeUpsertClient } = {},
): Promise<UpsertResult> {
  if (!courses.length) return { inserted: 0, updated: 0, hippodromes: 0 };
  const supabase = opts.client ?? (createServiceClient() as unknown as ProgrammeUpsertClient);

  // ── Hippodromes ────────────────────────────────────────────────────────
  const hipNoms = Array.from(new Set(courses.map((c) => c.hippodromeName)));
  const paysNeeded = Array.from(new Set(courses.map((c) => c.hippodromePays || "France")));
  const hipMap: Record<string, string> = {};

  const hipRes = await supabase
    .from("hippodromes")
    .select("id, nom, pays")
    .in("pays", paysNeeded);
  // Un SELECT KO renvoie `data: null` : sans remontée, tous les hippodromes
  // passeraient pour manquants et on tenterait de les recréer (doublons).
  assertOk("SELECT des hippodromes", hipRes);
  const allHip = (hipRes.data ?? []) as Array<{ id: string; nom: string; pays: string }>;

  for (const nom of hipNoms) {
    const pays = courses.find((c) => c.hippodromeName === nom)?.hippodromePays || "France";
    const found = allHip.find(
      (h) => h.pays === pays && canonicalHippodrome(h.nom) === canonicalHippodrome(nom),
    );
    if (found) hipMap[nom] = found.id;
  }

  const missingHips = hipNoms
    .filter((nom) => !hipMap[nom])
    .map((nom) => ({
      nom,
      pays: courses.find((c) => c.hippodromeName === nom)?.hippodromePays || "France",
      ville: nom,
      fuseau_horaire: "Europe/Paris",
      actif: true,
    }));

  if (missingHips.length > 0) {
    const hipInsRes = await supabase
      .from("hippodromes")
      .insert(missingHips)
      .select("id, nom");
    // Sans remontée : `hipMap` reste vide pour ces hippodromes, TOUTES leurs
    // courses sont ignorées plus bas (`continue`) et la fonction renvoie
    // `inserted: 0` sans erreur — un faux succès de plus.
    assertOk(`INSERT de ${missingHips.length} hippodrome(s)`, hipInsRes);
    const insertedHips = (hipInsRes.data ?? []) as Array<{ id: string; nom: string }>;
    for (const hip of insertedHips) hipMap[hip.nom] = hip.id;
  }

  // ── Courses ────────────────────────────────────────────────────────────
  const dates = Array.from(new Set(courses.map((c) => c.dateCourse)));
  const hipIds = Object.values(hipMap);

  const courseKey = (hipId: string, date: string, reunion: number, course: number) =>
    `${hipId}|${date}|${reunion}|${course}`;

  const existingCourseMap = new Map<string, string>();
  if (hipIds.length > 0 && dates.length > 0) {
    const exRes = await supabase
      .from("courses")
      .select("id, hippodrome_id, date_course, numero_reunion, numero_course")
      .in("hippodrome_id", hipIds)
      .in("date_course", dates);
    // Sans remontée : `data: null` → aucune course connue → tout repart en
    // INSERT, y compris les courses déjà en base (doublons).
    assertOk("SELECT des courses existantes", exRes);
    const existing = (exRes.data ?? []) as Array<{ id: string; hippodrome_id: string; date_course: string; numero_reunion: number; numero_course: number }>;
    for (const c of existing) {
      existingCourseMap.set(courseKey(c.hippodrome_id, c.date_course, c.numero_reunion, c.numero_course), c.id);
    }
  }

  const toInsert: Record<string, unknown>[] = [];
  const toUpsert: Record<string, unknown>[] = [];

  for (const c of courses) {
    const hippodromeId = hipMap[c.hippodromeName];
    if (!hippodromeId) continue;

    const existingId = existingCourseMap.get(
      courseKey(hippodromeId, c.dateCourse, c.numeroReunion, c.numeroCourse),
    );

    if (existingId) {
      // Course déjà là (ex. insérée par Geny ou à la main) : on NE touche PAS à
      // la catégorie/heure existantes, on rafraîchit juste nb_partants/libellé/paris.
      toUpsert.push({
        id: existingId,
        nb_partants: c.nbPartants,
        libelle: c.libelle,
        paris_disponibles: c.parisDisponibles,
      });
    } else {
      toInsert.push({
        hippodrome_id: hippodromeId,
        date_course: c.dateCourse,
        heure_depart: c.heureDepart,
        numero_reunion: c.numeroReunion,
        numero_course: c.numeroCourse,
        libelle: c.libelle,
        distance_metres: c.distanceMetres,
        categorie: c.categorie,
        nb_partants: c.nbPartants,
        statut: "PROGRAMME",
        paris_disponibles: c.parisDisponibles,
      });
    }
  }

  // On ne compte QUE ce que la base confirme avoir écrit (`count: "exact"`).
  // `count` absent (en-tête Content-Range manquant) alors qu'aucune erreur n'est
  // remontée = écriture réussie : un INSERT/UPSERT bulk PostgreSQL est atomique,
  // donc toutes les lignes envoyées sont passées. On retombe alors sur leur
  // nombre plutôt que de rapporter 0 (même repli que `pmu-distance.ts`).
  let inserted = 0;
  let updated  = 0;

  if (toInsert.length > 0) {
    const insRes = await supabase.from("courses").insert(toInsert, { count: "exact" });
    assertOk(`INSERT de ${toInsert.length} course(s)`, insRes);
    inserted = insRes.count ?? toInsert.length;
  }

  if (toUpsert.length > 0) {
    const upsRes = await supabase.from("courses").upsert(toUpsert, { count: "exact" });
    assertOk(`UPSERT de ${toUpsert.length} course(s)`, upsRes);
    updated = upsRes.count ?? toUpsert.length;
  }

  return {
    inserted,
    updated,
    hippodromes: Object.keys(hipMap).length,
  };
}
