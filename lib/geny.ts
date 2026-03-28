/**
 * Génère un lien Geny.com pour vérifier une course PMU
 *
 * Format programme  : https://www.geny.com/partants-pmu/YYYYMMDD_reunionR_courseC
 * Format résultats  : https://www.geny.com/resultats-pmu/YYYYMMDD_reunionR_courseC
 */
export function buildGenyUrl(
  dateCourse: string,      // "YYYY-MM-DD"
  numeroReunion: number,   // ex: 1
  numeroCourse: number,    // ex: 5
  type: "partants" | "resultats" = "partants"
): string {
  // Normaliser la date → YYYYMMDD
  const d = dateCourse.replace(/-/g, "");   // "2026-03-15" → "20260315"
  const r = String(numeroReunion).padStart(2, "0");  // 1 → "01"
  const c = String(numeroCourse).padStart(2, "0");   // 5 → "05"
  const slug = `${d}_r${r}c${c}`;

  if (type === "resultats") {
    return `https://www.geny.com/resultats-pmu/${slug}`;
  }
  return `https://www.geny.com/programme-complet/partants-pmu/${slug}`;
}

/**
 * Détermine si la course est passée (→ lien résultats) ou future (→ lien partants)
 */
export function buildGenyUrlAuto(
  dateCourse: string,
  numeroReunion: number,
  numeroCourse: number
): string {
  const courseDate = new Date(dateCourse);
  const now = new Date();
  const isPast = courseDate < now;
  return buildGenyUrl(dateCourse, numeroReunion, numeroCourse, isPast ? "resultats" : "partants");
}
