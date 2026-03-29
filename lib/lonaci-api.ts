/**
 * Client API LONACI (Loterie Nationale de Côte d'Ivoire)
 *
 * Endpoint découvert par reverse-engineering :
 * https://api.lonacionline.flexbet-software.com:14443
 *   /sport-gateway/v1/hippique/get_active_games
 *   ?channel=7&versioncode=3&date_jr=&channel_id=3
 *
 * Retourne toutes les courses disponibles pour les parieurs
 * africains (LONACI-CI, LONASE-SN, PMU-MA, etc.)
 * avec le champ int_National_Number = 1|2|3 pour les Nationales.
 */

const LONACI_URL =
  "https://api.lonacionline.flexbet-software.com:14443" +
  "/sport-gateway/v1/hippique/get_active_games" +
  "?channel=7&versioncode=3&date_jr=&channel_id=3";

// ── Mapping codes paris LONACI → codes internes Elite Turf ──────────────
export const LONACI_PARIS_MAP: Record<string, string> = {
  QNPC3:    "QUINTE_PLUS",   // Quinté+  (Nationale 1)
  QRC3:     "QUARTE_PLUS",   // Quarté+  (Nationale 2)
  QNC3:     "QUINTE",        // Quinté   (Nationale 3 variante)
  TRC3:     "TIERCE",        // Tiercé   (Nationale 3)
  TRTE2C3:  "TIERCE",        // Tiercé variante
  MULTIC3:  "MULTI",         // Multi
  "24C3":   "QUARTE",        // 2-sur-4
  CPC3:     "COUPLE",        // Couplé
  TRIO:     "TRIO",
  SG:       "SIMPLE_GAGNANT",
  SP:       "SIMPLE_PLACE",
  JG:       "JUMELE_GAGNANT",
  JP:       "JUMELE_PLACE",
  P5:       "PICK5",
};

export interface LonaciReunion {
  nReunion:  number;
  libelle:   string;          // Nom hippodrome ex: "SAINT-CLOUD"
  rd:        string;          // "YYYY-MM-DD HH:mm:ss"
  races:     LonaciCourse[];
}

export interface LonaciCourse {
  course_number:       number;
  libelle:             string;
  racedt:              string;   // "YYYY-MM-DD HH:mm:ss"
  int_National_Number: number;   // 0=normale, 1=Nat1, 2=Nat2, 3=Nat3
  libelleJeux:         Record<string, string>;
  partants:            unknown[];
  distance:            number;
  statut_course:       string;
}

export interface NormalizedLonaciCourse {
  hippodrome:          string;   // nom normalisé
  pays:                string;
  nReunion:            number;
  numeroCourse:        number;
  libelle:             string;
  dateCourse:          string;   // "YYYY-MM-DD"
  heureDepart:         string;   // "HH:MM:SS"
  distance:            number;
  nbPartants:          number;
  nationale:           number;   // 1|2|3 (0 = pas une Nationale)
  parisDisponibles:    string[]; // codes internes Elite Turf
  parisLonaciCodes:    string[]; // codes bruts LONACI
}

// ── Hippodromes africains connus (non-français) ──────────────────────────
const PAYS_HIPPO: Record<string, string> = {
  "MARRAKECH":        "Maroc",
  "DAKAR":            "Sénégal",
  "CASABLANCA":       "Maroc",
  "ABIDJAN":          "Côte d'Ivoire",
  "TUNIS":            "Tunisie",
  "SOUSSE":           "Tunisie",
};

function getPays(hippodrome: string): string {
  const upper = hippodrome.toUpperCase();
  for (const [key, pays] of Object.entries(PAYS_HIPPO)) {
    if (upper.includes(key)) return pays;
  }
  return "France";
}

function normalizeHippoName(name: string): string {
  // Capitalise correctement : "SAINT-CLOUD" → "Saint-Cloud"
  return name
    .toLowerCase()
    .split(/[-\s]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(name.includes("-") ? "-" : " ");
}

// ── Fetch principal ──────────────────────────────────────────────────────

export async function fetchLonaciProgramme(): Promise<LonaciReunion[]> {
  const res = await fetch(LONACI_URL, {
    headers: {
      "Accept":          "application/json",
      "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer":         "https://pmu.lonacionline.ci/",
      "Origin":          "https://pmu.lonacionline.ci",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`LONACI API error ${res.status}`);
  }

  const json = await res.json();
  return (json?.data?.HP as LonaciReunion[]) ?? [];
}

// ── Normalisation ────────────────────────────────────────────────────────

export function normalizeLonaciReunions(
  reunions: LonaciReunion[]
): NormalizedLonaciCourse[] {
  const result: NormalizedLonaciCourse[] = [];

  for (const r of reunions) {
    const hippoNom = normalizeHippoName(r.libelle);
    const pays     = getPays(r.libelle);

    for (const c of r.races ?? []) {
      const parisLonaciCodes = Object.keys(c.libelleJeux ?? {});
      const parisDisponibles = [
        ...new Set(
          parisLonaciCodes
            .map(code => LONACI_PARIS_MAP[code])
            .filter(Boolean)
        ),
      ];

      // Heure départ depuis racedt "YYYY-MM-DD HH:mm:ss"
      const [datePart, timePart] = (c.racedt || "").split(" ");
      const heureDepart = timePart ? timePart.substring(0, 8) : "00:00:00";

      result.push({
        hippodrome:       hippoNom,
        pays,
        nReunion:         r.nReunion,
        numeroCourse:     c.course_number,
        libelle:          c.libelle,
        dateCourse:       datePart || new Date().toISOString().split("T")[0],
        heureDepart,
        distance:         c.distance || 0,
        nbPartants:       (c.partants ?? []).length,
        nationale:        c.int_National_Number || 0,
        parisDisponibles,
        parisLonaciCodes,
      });
    }
  }

  return result;
}

// ── Helper : label Nationale pour affichage ──────────────────────────────
export function getNationaleLabelFromNumber(n: number): string | null {
  if (n === 1) return "Nationale 1 — Quinté+";
  if (n === 2) return "Nationale 2 — Quarté+";
  if (n === 3) return "Nationale 3 — Tiercé";
  return null;
}
