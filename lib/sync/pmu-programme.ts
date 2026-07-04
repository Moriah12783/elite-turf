/**
 * lib/sync/pmu-programme.ts
 *
 * Sync du PROGRAMME via l'API OFFICIELLE PMU.fr (lib/pmu-api → proxy Cloudflare
 * `pmu-proxy`). Sert de FALLBACK quand Geny bloque le scraping (403/429).
 * L'upsert est délégué à `upsertProgrammeCourses` (partagé avec la voie LONACI).
 *
 * PUR → bundlable Node sur GitHub Actions (appelé en fallback par la CLI).
 */
import { fetchPmuProgramme, normalizePmuReunions } from "@/lib/pmu-api";
import { upsertProgrammeCourses } from "./programme-upsert";

export interface PmuProgrammeSyncResult {
  inserted: number;
  updated: number;
  hippodromes: number;
  courses: number;
  reunions: number;
}

/**
 * Charge le programme PMU.fr d'une date et l'upsert dans `courses`.
 * @param dateStr format "YYYYMMDD"
 */
export async function runPmuProgrammeSync(dateStr: string): Promise<PmuProgrammeSyncResult> {
  const reunions = await fetchPmuProgramme(dateStr);
  const courses = normalizePmuReunions(reunions); // NormalizedCourse ⊂ ProgrammeCourse
  const r = await upsertProgrammeCourses(courses);
  return { ...r, courses: courses.length, reunions: reunions.length };
}
