/**
 * Rattache un consensus de presse à une course du programme.
 * Module PUR (utilisable client ET serveur), déterministe, testable.
 * Le filtrage par date se fait en amont (on ne passe que les courses du jour).
 */

export interface CourseLite {
  id: string;
  hippodrome: string | null;
  numero_reunion?: number | null;
  numero_course?: number | null;
  libelle?: string | null;
}

export interface ConsensusMeta {
  hippodrome?: string | null;
  /** R extrait du libellé "R1C3" si dispo */
  reunion?: number | null;
  /** C extrait du libellé "R1C3" si dispo */
  course?: number | null;
}

export interface MatchResult {
  courseId: string;
  confidence: number; // 0-100
}

/** Normalise un nom d'hippodrome : minuscules, sans accents, alphanum compacté. */
export function normalizeHippo(name: string | null | undefined): string {
  if (!name) return "";
  const lower = name.toLowerCase();
  // retire les accents français courants sans regex unicode (ES5-safe)
  const accents = "àâäáãçéèêëíìîïñóòôöõúùûü";
  const plain = "aaaaaceeeeiiiinooooouuuu";
  let out = "";
  for (let i = 0; i < lower.length; i++) {
    const idx = accents.indexOf(lower[i]);
    out += idx === -1 ? lower[i] : plain[idx];
  }
  return out.replace(/[^a-z0-9]+/g, " ").trim();
}

/** Extrait { reunion, course } d'un texte type "R1C3" / "r2 c5". null si absent. */
export function parseReunionCourse(text: string | null | undefined): { reunion: number | null; course: number | null } {
  if (!text) return { reunion: null, course: null };
  const m = text.match(/r\s*(\d{1,2})\s*c\s*(\d{1,2})/i);
  if (!m) return { reunion: null, course: null };
  return { reunion: parseInt(m[1], 10), course: parseInt(m[2], 10) };
}

/** Tokens significatifs d'un nom normalisé (≥ 4 caractères ; ignore "de"/"sur"/"la"…). */
function significantTokens(normalized: string): string[] {
  return normalized.split(" ").filter((t) => t.length >= 4);
}

/**
 * Trouve la meilleure course correspondant au consensus parmi les courses fournies.
 * Score : hippodrome exact (+60) ou token partagé ≥4 car. (+50) ; R (+20) ; C (+20).
 * Renvoie null si :
 *   - la meilleure confiance est < 50 (rattachement trop incertain), OU
 *   - plusieurs courses sont à égalité au sommet (ambigu : ex. plusieurs courses
 *     du même hippodrome sans R/C pour départager) → on force le choix manuel
 *     plutôt que de rattacher arbitrairement la première.
 */
export function findBestCourseMatch(meta: ConsensusMeta, courses: CourseLite[]): MatchResult | null {
  if (!courses || courses.length === 0) return null;
  const hippo = normalizeHippo(meta.hippodrome);
  const hippoTokens = significantTokens(hippo);

  let best: MatchResult | null = null;
  let bestCount = 0;
  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    let score = 0;

    const ch = normalizeHippo(c.hippodrome);
    if (hippo && ch) {
      if (ch === hippo) {
        score += 60;
      } else {
        const chTokens = significantTokens(ch);
        const shares = hippoTokens.some((t) => chTokens.indexOf(t) !== -1);
        if (shares) score += 50;
      }
    }
    if (meta.reunion != null && c.numero_reunion === meta.reunion) score += 20;
    if (meta.course != null && c.numero_course === meta.course) score += 20;

    if (score <= 0) continue;
    const conf = Math.min(100, score);
    if (!best || conf > best.confidence) { best = { courseId: c.id, confidence: conf }; bestCount = 1; }
    else if (conf === best.confidence) { bestCount++; }
  }

  if (!best || best.confidence < 50) return null;
  if (bestCount > 1) return null; // égalité au sommet → ambigu, choix manuel requis
  return best;
}
