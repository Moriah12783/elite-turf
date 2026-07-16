/**
 * lib/sync/programme-upsert.ts
 *
 * Upsert PARTAGÉ du programme (hippodromes + courses), utilisé par les voies
 * PMU.fr et LONACI (fallbacks quand Geny bloque). Logique identique à celle de
 * la voie Geny — une seule source de vérité pour l'écriture.
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

/**
 * Résout les hippodromes (SELECT bulk + INSERT des manquants) puis
 * insère/upsert les courses. Ne crée jamais de doublon (clé
 * hippodrome_id + date + réunion + course).
 */
export async function upsertProgrammeCourses(courses: ProgrammeCourse[]): Promise<UpsertResult> {
  if (!courses.length) return { inserted: 0, updated: 0, hippodromes: 0 };
  const supabase = createServiceClient();

  // ── Hippodromes ────────────────────────────────────────────────────────
  const hipNoms = Array.from(new Set(courses.map((c) => c.hippodromeName)));
  const paysNeeded = Array.from(new Set(courses.map((c) => c.hippodromePays || "France")));
  const hipMap: Record<string, string> = {};

  const { data: allHip } = await supabase
    .from("hippodromes")
    .select("id, nom, pays")
    .in("pays", paysNeeded);

  for (const nom of hipNoms) {
    const pays = courses.find((c) => c.hippodromeName === nom)?.hippodromePays || "France";
    const found = (allHip ?? []).find(
      (h: { id: string; nom: string; pays: string }) =>
        h.pays === pays && canonicalHippodrome(h.nom) === canonicalHippodrome(nom),
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
    const { data: insertedHips } = await supabase
      .from("hippodromes")
      .insert(missingHips)
      .select("id, nom");
    for (const hip of insertedHips ?? []) hipMap[hip.nom] = hip.id;
  }

  // ── Courses ────────────────────────────────────────────────────────────
  const dates = Array.from(new Set(courses.map((c) => c.dateCourse)));
  const hipIds = Object.values(hipMap);

  const courseKey = (hipId: string, date: string, reunion: number, course: number) =>
    `${hipId}|${date}|${reunion}|${course}`;

  const existingCourseMap = new Map<string, string>();
  if (hipIds.length > 0 && dates.length > 0) {
    const { data } = await supabase
      .from("courses")
      .select("id, hippodrome_id, date_course, numero_reunion, numero_course")
      .in("hippodrome_id", hipIds)
      .in("date_course", dates);
    for (const c of (data as Array<{ id: string; hippodrome_id: string; date_course: string; numero_reunion: number; numero_course: number }>) ?? []) {
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

  if (toInsert.length > 0) await supabase.from("courses").insert(toInsert);
  if (toUpsert.length > 0) await supabase.from("courses").upsert(toUpsert);

  return {
    inserted: toInsert.length,
    updated: toUpsert.length,
    hippodromes: Object.keys(hipMap).length,
  };
}
