/**
 * Course(s) vedette(s) du jour = la (les) grande(s) course(s) à pari national
 * (Quinté+ en tête) — celle que LONACI/LONAB relaient pour l'Afrique francophone.
 *
 * Module PUR, déterministe, testable. AUCUN scraping : s'appuie uniquement sur
 * les paris déjà ingérés (`paris_disponibles`) + la liste d'hippodromes
 * prioritaires de course-eligibility.
 *
 * Constat data (2026-06) : il y a exactement 1 Quinté+ par jour dans le
 * programme → repère fiable. Les colonnes `jouable_afrique`/`nationale`
 * existent mais ne sont PAS peuplées → on ne s'appuie pas dessus.
 */
import { isHippodromePrioritaire } from "./course-eligibility";

export interface CourseForVedette {
  id: string;
  libelle?: string | null;
  numero_reunion?: number | null;
  numero_course?: number | null;
  heure_depart?: string | null;
  nb_partants?: number | null;
  paris_disponibles?: string[] | null;
  hippodrome?: string | null;
  statut?: string | null;
}

export interface CourseVedette {
  id: string;
  libelle: string | null;
  numero_reunion: number | null;
  numero_course: number | null;
  heure_depart: string | null;
  nb_partants: number | null;
  hippodrome: string | null;
  pari_principal: string; // QUINTE_PLUS / QUARTE_PLUS / QUARTE / TIERCE
  score: number;
  raison: string;
}

/** Rang des paris nationaux (Quinté+ = la grande course du jour). */
const PARI_RANK: Record<string, number> = {
  QUINTE_PLUS: 100,
  QUARTE_PLUS: 70,
  QUARTE: 65,
  TIERCE: 50,
};

const LIBELLE_PARI: Record<string, string> = {
  QUINTE_PLUS: "Quinté+",
  QUARTE_PLUS: "Quarté+",
  QUARTE: "Quarté+",
  TIERCE: "Tiercé",
};

function bestPariNational(paris: string[] | null | undefined): { pari: string; rank: number } | null {
  if (!Array.isArray(paris)) return null;
  let best: { pari: string; rank: number } | null = null;
  for (let i = 0; i < paris.length; i++) {
    const key = paris[i];
    // hasOwnProperty + typeof number : évite les clés héritées ("toString"…)
    // qui renverraient une fonction → NaN dans le score.
    const r = Object.prototype.hasOwnProperty.call(PARI_RANK, key) ? PARI_RANK[key] : undefined;
    if (typeof r === "number" && (!best || r > best.rank)) best = { pari: key, rank: r };
  }
  return best;
}

/**
 * Classe les courses du jour et renvoie la/les vedette(s) (top `limit`).
 * Score = rang du pari national + bonus hippodrome prestigieux (+15) + bonus
 * lisibilité (14-16 partants +10, 12-18 +6). Tri : score desc puis heure asc.
 */
export function pickCoursesVedettes(courses: CourseForVedette[], limit = 2): CourseVedette[] {
  const out: CourseVedette[] = [];
  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    const bp = bestPariNational(c.paris_disponibles);
    if (!bp) continue; // pas de pari national → pas une vedette

    let score = bp.rank;
    if (isHippodromePrioritaire(c.hippodrome)) score += 15;
    const np = c.nb_partants ?? 0;
    if (np >= 14 && np <= 16) score += 10;
    else if (np >= 12 && np <= 18) score += 6;

    const libelleP = LIBELLE_PARI[bp.pari] ?? bp.pari;
    const raison = `${libelleP} du jour${c.hippodrome ? ` à ${c.hippodrome}` : ""}${np ? ` · ${np} partants` : ""}`;

    out.push({
      id: c.id,
      libelle: c.libelle ?? null,
      numero_reunion: c.numero_reunion ?? null,
      numero_course: c.numero_course ?? null,
      heure_depart: c.heure_depart ?? null,
      nb_partants: c.nb_partants ?? null,
      hippodrome: c.hippodrome ?? null,
      pari_principal: bp.pari,
      score,
      raison,
    });
  }
  out.sort((a, b) => b.score - a.score || (a.heure_depart ?? "").localeCompare(b.heure_depart ?? ""));
  return out.slice(0, limit);
}

/** Raccourci : LA course vedette (la mieux classée) ou null. */
export function pickCourseVedette(courses: CourseForVedette[]): CourseVedette | null {
  const v = pickCoursesVedettes(courses, 1);
  return v.length > 0 ? v[0] : null;
}
