/**
 * lib/sync/pmu-programme.ts
 *
 * Sync du PROGRAMME via l'API OFFICIELLE PMU.fr (lib/pmu-api → proxy Cloudflare
 * `pmu-proxy`). Sert de FALLBACK quand Geny bloque le scraping (403/429) : PMU.fr
 * passe par le proxy qui contourne les blocages d'IP, donc reste accessible même
 * quand Geny ferme la porte au Worker ET à GitHub Actions.
 *
 * PUR (client Supabase via le module SANS next/headers) → bundlable en Node sur
 * GitHub Actions, puisque runGenyProgrammeSync (appelé par la CLI) l'invoque en
 * fallback. Logique d'upsert alignée sur celle de la voie Geny.
 */
import { createServiceClient } from "@/lib/supabase/service-client";
import { fetchPmuProgramme, normalizePmuReunions } from "@/lib/pmu-api";

export interface PmuProgrammeSyncResult {
  inserted: number;
  updated: number;
  hippodromes: number;
  courses: number;
  reunions: number;
}

/** Nom d'hippodrome normalisé (sans accents, majuscules) pour le matching. */
function normalizeHipName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

/**
 * Charge le programme PMU.fr d'une date et l'upsert dans `courses` (+ hippodromes).
 * @param dateStr format "YYYYMMDD"
 */
export async function runPmuProgrammeSync(dateStr: string): Promise<PmuProgrammeSyncResult> {
  const supabase = createServiceClient();

  const reunions = await fetchPmuProgramme(dateStr);
  const courses = normalizePmuReunions(reunions);
  if (!courses.length) {
    return { inserted: 0, updated: 0, hippodromes: 0, courses: 0, reunions: reunions.length };
  }

  // ── Hippodromes : 1 SELECT bulk + 1 INSERT bulk des manquants ──────────────
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
        h.pays === pays && normalizeHipName(h.nom) === normalizeHipName(nom),
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

  // ── Courses : 1 SELECT bulk existant + INSERT/UPSERT bulk ──────────────────
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
    courses: courses.length,
    reunions: reunions.length,
  };
}
