/**
 * lib/sync/lonaci.ts
 *
 * Synchronise le programme LONACI dans Supabase.
 * Extrait de /api/lonaci/sync/route.ts pour appel direct (sans HTTP).
 */

import { createServiceClient } from "@/lib/supabase/server";
import {
  fetchLonaciProgramme,
  normalizeLonaciReunions,
} from "@/lib/lonaci-api";

export interface LonaciSyncResult {
  ok:         true;
  date?:      string;
  total:      number;
  nationales: Array<{
    nationale:  number;
    hippodrome: string;
    reunion:    number;
    course:     number;
    libelle:    string;
    heure:      string;
  }>;
  inserted:   number;
  updated:    number;
  message?:   string;
}

export async function runLonaciSync(): Promise<LonaciSyncResult> {
  const supabase = createServiceClient();

  // 1. Fetch LONACI
  const reunions = await fetchLonaciProgramme();
  const courses  = normalizeLonaciReunions(reunions);

  if (!courses.length) {
    return {
      ok:         true,
      message:    "Aucune course LONACI trouvée",
      total:      0,
      nationales: [],
      inserted:   0,
      updated:    0,
    };
  }

  // 2. Hippodromes — bulk SELECT + bulk INSERT
  const hipMap: Record<string, string> = {};
  const hipNoms = Array.from(new Set(courses.map(c => c.hippodrome)));

  const { data: existingHips } = await supabase
    .from("hippodromes")
    .select("id, nom")
    .in("nom", hipNoms);

  for (const hip of (existingHips ?? []) as Array<{ id: string; nom: string }>) {
    hipMap[hip.nom] = hip.id;
  }

  const missingHips = hipNoms
    .filter((nom) => !hipMap[nom])
    .map((nom) => ({
      nom,
      pays:           courses.find((c) => c.hippodrome === nom)?.pays || "France",
      ville:          nom,
      fuseau_horaire: "Europe/Paris",
      actif:          true,
    }));

  if (missingHips.length > 0) {
    const { data: insertedHips } = await supabase
      .from("hippodromes")
      .insert(missingHips)
      .select("id, nom");
    for (const hip of (insertedHips ?? []) as Array<{ id: string; nom: string }>) {
      hipMap[hip.nom] = hip.id;
    }
  }

  // 3. Courses — bulk SELECT + bulk INSERT + bulk UPSERT
  const dates  = Array.from(new Set(courses.map(c => c.dateCourse)));
  const hipIds = Object.values(hipMap);

  type ExistingCourse = {
    id: string;
    hippodrome_id:  string;
    date_course:    string;
    numero_reunion: number;
    numero_course:  number;
  };

  let existingCourses: ExistingCourse[] = [];
  if (hipIds.length > 0 && dates.length > 0) {
    const { data } = await supabase
      .from("courses")
      .select("id, hippodrome_id, date_course, numero_reunion, numero_course")
      .in("hippodrome_id", hipIds)
      .in("date_course", dates);
    existingCourses = (data as ExistingCourse[]) ?? [];
  }

  const courseKey = (hipId: string, date: string, reunion: number, course: number) =>
    `${hipId}|${date}|${reunion}|${course}`;

  const existingCourseMap = new Map<string, string>();
  for (const c of existingCourses) {
    existingCourseMap.set(
      courseKey(c.hippodrome_id, c.date_course, c.numero_reunion, c.numero_course),
      c.id
    );
  }

  const toInsert: Record<string, unknown>[] = [];
  const toUpsert: Record<string, unknown>[] = [];

  for (const c of courses) {
    const hippodromeId = hipMap[c.hippodrome];
    if (!hippodromeId) continue;

    const existingId = existingCourseMap.get(
      courseKey(hippodromeId, c.dateCourse, c.nReunion, c.numeroCourse)
    );

    if (existingId) {
      toUpsert.push({
        id:                existingId,
        paris_disponibles: c.parisDisponibles,
        nb_partants:       c.nbPartants,
        libelle:           c.libelle,
      });
    } else {
      toInsert.push({
        hippodrome_id:    hippodromeId,
        date_course:      c.dateCourse,
        heure_depart:     c.heureDepart,
        numero_reunion:   c.nReunion,
        numero_course:    c.numeroCourse,
        libelle:          c.libelle,
        distance_metres:  c.distance,
        categorie:        "PLAT",
        nb_partants:      c.nbPartants,
        statut:           "PROGRAMME",
        paris_disponibles: c.parisDisponibles,
      });
    }
  }

  if (toInsert.length > 0) {
    await supabase.from("courses").insert(toInsert);
  }
  if (toUpsert.length > 0) {
    await supabase.from("courses").upsert(toUpsert);
  }

  const inserted = toInsert.length;
  const updated  = toUpsert.length;
  const nationales = courses.filter(c => c.nationale > 0);

  console.log(`[LONACI Sync] ${courses.length} courses, ${nationales.length} nationales → ${inserted} insérées, ${updated} màj`);

  return {
    ok:         true,
    date:       courses[0]?.dateCourse,
    total:      courses.length,
    nationales: nationales.map(c => ({
      nationale:  c.nationale,
      hippodrome: c.hippodrome,
      reunion:    c.nReunion,
      course:     c.numeroCourse,
      libelle:    c.libelle,
      heure:      c.heureDepart,
    })),
    inserted,
    updated,
  };
}
