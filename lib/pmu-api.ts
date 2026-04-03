/**
 * PMU Open Data API client
 * Documentation : https://opendata.pmu.fr
 *
 * Endpoints gratuits utilisés :
 *  - Programme complet du jour  : GET /programmeComplet/{YYYYMMDD}
 *  - Résultats d'une course     : GET /resultats/{YYYYMMDD}/R{R}/C{C}
 */

const PMU_DIRECT = "https://online.turfinfo.api.pmu.fr";
// Cloudflare Worker proxy — contourne le blocage IP de PMU sur Vercel/AWS
const PMU_PROXY  = (process.env.PMU_PROXY_URL || "https://pmu-proxy.manuel-conti2008.workers.dev").replace(/\/$/, "");
const PMU_BASE   = `${PMU_PROXY}/rest/client/1`;

export interface PmuReunion {
  numOrdre:       number;
  hippodrome:     { libelleCourt: string; libelleLong: string; pays: { code: string } };
  dateReunion:    { date: number[] };    // [year, month, day]
  courses:        PmuCourse[];
}

export interface PmuPari {
  typePari: string;   // ex: "TIERCE", "QUARTE_PLUS", "QUINTE_PLUS", "TRIO", ...
  enVente?: boolean;
}

export interface PmuCourse {
  numOrdre:          number;
  libelle:           string;
  heureDepart:       number;             // timestamp ms
  distance:          number;             // mètres
  nombreDeclaresPartants: number;
  discipline:        string;             // "PLAT" | "TROT_ATTELE" | "OBSTACLE"
  conditions:        string;
  paris?:            PmuPari[];          // types de paris disponibles
  typesParis?:       string[];           // variante selon version API
}

export interface PmuProgramme {
  programme: { reunions: PmuReunion[] };
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Formate un Date en YYYYMMDD */
export function toDateStr(d: Date = new Date()): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}${mo}${da}`;
}

/** Convertit un tableau [year,month,day] PMU en "YYYY-MM-DD" */
function pmuDateToISO(arr: number[]): string {
  return `${arr[0]}-${String(arr[1]).padStart(2, "0")}-${String(arr[2]).padStart(2, "0")}`;
}

/** Timestamp ms → "HH:MM:SS" */
function tsToTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}:00`;
}

/** Discipline PMU → CourseCategory */
function toCategorie(discipline: string): "PLAT" | "TROT" | "OBSTACLE" {
  if (discipline?.includes("TROT")) return "TROT";
  if (discipline?.includes("OBSTACLE") || discipline?.includes("HAIE") || discipline?.includes("STEEPLE")) return "OBSTACLE";
  return "PLAT";
}

// ── API calls ────────────────────────────────────────────────────────────

/**
 * Récupère le programme complet PMU pour une date donnée
 */
const PMU_HEADERS = {
  "Accept":          "application/json, text/plain, */*",
  "Accept-Language": "fr-FR,fr;q=0.9",
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Referer":         "https://www.pmu.fr/",
  "Origin":          "https://www.pmu.fr",
};

export async function fetchPmuProgramme(dateStr?: string): Promise<PmuReunion[]> {
  const d = dateStr || toDateStr();

  // Proxy CF en premier (contourne le blocage IP Vercel/AWS), puis direct en fallback
  const urls = [
    `${PMU_PROXY}/rest/client/1/programmeComplet/${d}?specialisation=INTERNET`,
    `${PMU_PROXY}/rest/client/1/programmeComplet/${d}?specialisation=OFFLINE`,
    `${PMU_PROXY}/rest/client/2/programmeComplet/${d}?specialisation=INTERNET`,
    `${PMU_PROXY}/rest/client/7/programmeComplet/${d}?specialisation=INTERNET`,
    // Fallback direct (peut être bloqué par PMU sur Vercel)
    `${PMU_DIRECT}/rest/client/1/programmeComplet/${d}?specialisation=INTERNET`,
    `${PMU_DIRECT}/rest/client/2/programmeComplet/${d}?specialisation=INTERNET`,
    `${PMU_DIRECT}/rest/client/7/programmeComplet/${d}?specialisation=INTERNET`,
  ];

  let lastError = "";
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: PMU_HEADERS,
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json();
        const reunions = json?.programme?.reunions ?? json?.reunions ?? [];
        if (reunions.length > 0) return reunions;
        // Réponse 200 mais sans réunions → continuer vers le prochain endpoint
        lastError = `200 mais 0 réunions (${url})`;
        continue;
      }

      // Log du corps pour diagnostiquer les 400/403
      const body = await res.text().catch(() => "");
      lastError = `HTTP ${res.status} — ${body.slice(0, 120)}`;
      console.warn(`[PMU API] ${res.status} pour ${url}: ${body.slice(0, 200)}`);

    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(`PMU API error (tous les endpoints ont échoué): ${lastError} for date ${d}`);
}

// ── Normalisation pour Supabase ──────────────────────────────────────────

// Types de paris africains reconnus (LONACI, LONASE, PMU-CI, PMU Maroc…)
// Une course avec au moins un de ces types est "jouable en Afrique"
const PARIS_AFRIQUE = new Set([
  "TIERCE", "QUARTE", "QUARTE_PLUS",
  "QUINTE", "QUINTE_PLUS",
  "COUPLE_GAGNANT", "COUPLE_PLACE",
  "MULTI",
]);

/** Extrait les types de paris disponibles sur une course PMU */
function extractParisDisponibles(course: PmuCourse): string[] {
  const types = new Set<string>();

  // Variante 1 : tableau "paris" avec objets {typePari}
  if (Array.isArray(course.paris)) {
    for (const p of course.paris) {
      if (p?.typePari) types.add(p.typePari.toUpperCase());
    }
  }
  // Variante 2 : tableau "typesParis" de strings
  if (Array.isArray(course.typesParis)) {
    for (const t of course.typesParis) {
      if (t) types.add(t.toUpperCase());
    }
  }

  return Array.from(types);
}

/** Retourne true si la course est jouable depuis l'Afrique (LONACI…) */
export function isJouableAfrique(paris: string[]): boolean {
  return paris.some(p => PARIS_AFRIQUE.has(p));
}

/** Label "Nationale" LONACI selon les paris disponibles */
export function getNationaleLabel(paris: string[]): string | null {
  if (paris.includes("QUINTE_PLUS") || paris.includes("QUINTE")) return "Nationale 1 — Quinté+";
  if (paris.includes("QUARTE_PLUS") || paris.includes("QUARTE"))  return "Nationale 2 — Quarté+";
  if (paris.includes("TIERCE"))                                    return "Nationale 3 — Tiercé";
  return null;
}

export interface NormalizedCourse {
  hippodromeName:  string;
  hippodromePays:  string;
  dateCourse:      string;          // "YYYY-MM-DD"
  heureDepart:     string;          // "HH:MM:SS"
  numeroReunion:   number;
  numeroCourse:    number;
  libelle:         string;
  distanceMetres:  number;
  categorie:       "PLAT" | "TROT" | "OBSTACLE";
  nbPartants:      number;
  parisDisponibles: string[];       // ex: ["TIERCE","QUARTE_PLUS","QUINTE_PLUS"]
}

// ── Partants & Côtes (live) ───────────────────────────────────────────────

export interface PmuParticipant {
  numPmu:            number;
  nom:               string;
  coteProbable?:     number;
  coteDefinitive?:   number;
  dernierRapportDirect?: { rapport?: number };
  jockey?:           { nom: string };
  entraineur?:       { nom: string };
  musique?:          string;
  poids?:            number;
  age?:              number;
  sexe?:             string;
  handicapPoids?:    number;
  placeCorde?:       number;
}

/**
 * Récupère les partants + côtes temps réel pour une course PMU
 * Endpoint : GET /partants/{YYYYMMDD}/R{R}/C{C}?specialisation=INTERNET
 */
export async function fetchPmuPartants(
  dateStr: string,
  R: number,
  C: number,
): Promise<PmuParticipant[]> {
  const urls = [
    `${PMU_BASE}/partants/${dateStr}/R${R}/C${C}?specialisation=INTERNET`,
    `${PMU_BASE}/partants/${dateStr}/R${R}/C${C}?specialisation=OFFLINE`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: PMU_HEADERS, cache: "no-store" });
      if (!res.ok) continue;
      const json = await res.json();
      const list: PmuParticipant[] =
        json?.participants ?? json?.partants ?? json?.programme?.participants ?? [];
      if (list.length > 0) return list;
    } catch { /* silently continue */ }
  }
  return [];
}

// ── Résultats & Rapports ──────────────────────────────────────────────────

export interface PmuDividende {
  combinaison: string;   // ex: "1", "1-3-7"
  rapport:     number;   // en centimes × 10 → diviser par 10 pour avoir € pour 1€ misé
}

export interface PmuRapport {
  typePari:    string;
  dividendes?: PmuDividende[];
}

export interface PmuResultat {
  arrivee:  number[];
  rapports: PmuRapport[];
}

/**
 * Récupère l'arrivée officielle + rapports (dividendes) d'une course terminée
 * Endpoint : GET /resultats/{YYYYMMDD}/R{R}/C{C}?specialisation=INTERNET
 */
export async function fetchPmuResultats(
  dateStr: string,
  R: number,
  C: number,
): Promise<PmuResultat | null> {
  const urls = [
    `${PMU_BASE}/resultats/${dateStr}/R${R}/C${C}?specialisation=INTERNET`,
    `${PMU_BASE}/resultats/${dateStr}/R${R}/C${C}?specialisation=OFFLINE`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: PMU_HEADERS, cache: "no-store" });
      if (!res.ok) continue;
      const json = await res.json();
      // L'API PMU peut imbriquer les résultats sous "resultats" ou à la racine
      const root = json?.resultats ?? json;
      const arrivee: number[] = root?.arrivee ?? root?.ordreArrivee ?? [];
      const rapports: PmuRapport[] =
        root?.rapports ?? root?.dividendes ?? json?.rapports ?? [];
      if (arrivee.length > 0 || rapports.length > 0) {
        return { arrivee, rapports };
      }
    } catch { /* silently continue */ }
  }

  return null;
}

/**
 * Transforme les réunions PMU en liste de courses normalisées
 */
export function normalizePmuReunions(reunions: PmuReunion[]): NormalizedCourse[] {
  const courses: NormalizedCourse[] = [];

  for (const reunion of reunions) {
    const dateCourse = pmuDateToISO(reunion.dateReunion.date);
    const hipNom     = reunion.hippodrome?.libelleLong || reunion.hippodrome?.libelleCourt || "Inconnu";
    const hipPays    = reunion.hippodrome?.pays?.code === "FRA" ? "France" : (reunion.hippodrome?.pays?.code || "France");

    for (const c of reunion.courses ?? []) {
      courses.push({
        hippodromeName:  hipNom,
        hippodromePays:  hipPays,
        dateCourse,
        heureDepart:     tsToTime(c.heureDepart),
        numeroReunion:   reunion.numOrdre,
        numeroCourse:    c.numOrdre,
        libelle:         c.libelle || `Course R${reunion.numOrdre}C${c.numOrdre}`,
        distanceMetres:  c.distance || 0,
        categorie:       toCategorie(c.discipline),
        nbPartants:      c.nombreDeclaresPartants || 0,
        parisDisponibles: extractParisDisponibles(c),
      });
    }
  }

  return courses;
}
