/**
 * PMU Open Data API client
 * Documentation : https://opendata.pmu.fr
 *
 * Endpoints gratuits utilisés :
 *  - Programme complet du jour  : GET /programmeComplet/{YYYYMMDD}
 *  - Résultats d'une course     : GET /resultats/{YYYYMMDD}/R{R}/C{C}
 */

import { canonicalHippodrome } from "@/lib/sync/hippodrome-canonical";

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#0*39;/g, "'")
    .replace(/&#0*34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

const PMU_DIRECT = "https://online.turfinfo.api.pmu.fr";
// Cloudflare Worker proxy — contourne le blocage IP de PMU sur Vercel/AWS
const PMU_PROXY  = (process.env.PMU_PROXY_URL || "https://pmu-proxy.manuel-conti2008.workers.dev").replace(/\/$/, "");
const PMU_BASE   = `${PMU_PROXY}/rest/client/1`;

/**
 * Une réunion PMU. Deux endpoints programme coexistent et ne renvoient PAS la
 * même forme (vérifié en direct le 2026-07-25) :
 *
 *  - `/programmeComplet` (celui que cible `fetchPmuProgramme` — répond HTTP 420
 *    sur proxy ET direct, clients 1/2/7/61) : `numOrdre`, `hippodrome.pays.code`,
 *    `dateReunion.date` = [année, mois, jour] ;
 *  - `/programme` (vivant, déjà utilisé par `lib/sync/pmu-distance.ts`) :
 *    `numExterne`, `pays.code` porté par la RÉUNION, `dateReunion` = timestamp ms.
 *
 * Les champs propres à une seule forme sont donc optionnels, et les accesseurs
 * (`reunionNumero`, `reunionPaysCode`, `reunionDateISO`) gèrent les deux.
 */
export interface PmuReunion {
  /** `/programmeComplet` uniquement. */
  numOrdre?:       number;
  /** `/programme` uniquement. */
  numExterne?:     number;
  hippodrome:      { libelleCourt?: string; libelleLong?: string; pays?: { code: string } };
  /** `/programme` : le pays est porté par la réunion, pas par l'hippodrome. */
  pays?:           { code: string };
  /** `{ date: [a, m, j] }` (/programmeComplet) ou timestamp ms (/programme). */
  dateReunion?:    { date: number[] } | number;
  /** Décalage du fuseau de la réunion, en ms (`/programme`). */
  timezoneOffset?: number;
  courses:         PmuCourse[];
}

export interface PmuPari {
  typePari: string;   // ex: "TIERCE", "QUARTE_PLUS", "QUINTE_PLUS", "TRIO", ...
  enVente?: boolean;
}

export interface PmuCourse {
  numOrdre?:         number;
  libelle?:          string;
  heureDepart?:      number;             // timestamp ms
  distance?:         number;             // mètres
  nombreDeclaresPartants?: number;
  discipline?:       string;             // "PLAT" | "TROT_ATTELE" | "ATTELE" | "MONTE" | "OBSTACLE"
  /** `/programme` : discipline détaillée ("TROT_ATTELE") quand `discipline` est abrégée ("ATTELE"). */
  specialite?:       string;
  conditions?:       string;
  paris?:            PmuPari[];          // types de paris disponibles
  typesParis?:       string[];           // variante selon version API
}

export interface PmuProgramme {
  programme: { reunions: PmuReunion[] };
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Formate un Date en YYYYMMDD (toujours en UTC pour éviter le décalage autour de minuit) */
export function toDateStr(d: Date = new Date()): string {
  const y  = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${mo}${da}`;
}

/** Convertit un tableau [year,month,day] PMU en "YYYY-MM-DD" */
function pmuDateToISO(arr: number[]): string {
  return `${arr[0]}-${String(arr[1]).padStart(2, "0")}-${String(arr[2]).padStart(2, "0")}`;
}

/** Timestamp ms → "HH:MM:SS" ; null si le timestamp est inexploitable. */
function tsToTime(ts?: number): string | null {
  if (typeof ts !== "number" || !isFinite(ts)) return null;
  const d = new Date(ts);
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}:00`;
}

/**
 * Discipline/spécialité PMU → CourseCategory.
 * `/programme` abrège la discipline ("ATTELE", "MONTE") là où `/programmeComplet`
 * la donnait en clair ("TROT_ATTELE") : sans reconnaître les deux formes, tout le
 * trot retomberait en PLAT — l'incident « tout en Plat » corrigé par la PR #288.
 */
function toCategorie(discipline?: string): "PLAT" | "TROT" | "OBSTACLE" {
  const d = discipline || "";
  if (d.includes("TROT") || d.includes("ATTELE") || d.includes("MONTE")) return "TROT";
  if (d.includes("OBSTACLE") || d.includes("HAIE") || d.includes("STEEPLE")) return "OBSTACLE";
  return "PLAT";
}

/** Numéro de réunion : `numExterne` (/programme) ou `numOrdre` (/programmeComplet). */
function reunionNumero(r: PmuReunion): number | null {
  const n = r.numExterne ?? r.numOrdre;
  return typeof n === "number" && isFinite(n) ? n : null;
}

/** Code pays : porté par la réunion (/programme) ou par l'hippodrome (/programmeComplet). */
function reunionPaysCode(r: PmuReunion): string {
  return r.pays?.code || r.hippodrome?.pays?.code || "";
}

const JOUR_MS = 86_400_000;

/**
 * Date "YYYY-MM-DD" de la réunion, quelle que soit la forme ; null si illisible.
 *
 * `/programme` renvoie le timestamp de MINUIT LOCAL : lu tel quel en UTC il tombe
 * la VEILLE (minuit à Paris le 25/07 = 2026-07-24T22:00:00Z). On le recale avec
 * `timezoneOffset`, puis on arrondit au jour UTC le plus proche — ce qui reste
 * juste même si le décalage venait à manquer.
 */
function reunionDateISO(r: PmuReunion): string | null {
  const d = r.dateReunion;
  if (typeof d === "number" && isFinite(d)) {
    const jour = new Date(Math.round((d + (r.timezoneOffset || 0)) / JOUR_MS) * JOUR_MS);
    const mo = String(jour.getUTCMonth() + 1).padStart(2, "0");
    const da = String(jour.getUTCDate()).padStart(2, "0");
    return `${jour.getUTCFullYear()}-${mo}-${da}`;
  }
  const arr = d && typeof d === "object" ? d.date : null;
  return Array.isArray(arr) && arr.length >= 3 ? pmuDateToISO(arr) : null;
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

/**
 * "YYYYMMDD" → "DDMMYYYY", le format réellement attendu par l'API PMU.
 *
 * Vérifié le 2026-07-25 : `/programme/25072026` répond 200, `/programme/20260725`
 * répond 400 « Requête invalide ». Or `toDateStr()` et les appelants de la
 * chaîne de fallback produisent tous du `YYYYMMDD`.
 *
 * Lève plutôt que de fabriquer une URL fausse silencieusement.
 */
export function toPmuUrlDate(dateStr: string): string {
  if (!/^\d{8}$/.test(dateStr)) {
    throw new Error(`Date PMU invalide (format attendu YYYYMMDD) : "${dateStr}"`);
  }
  return `${dateStr.slice(6, 8)}${dateStr.slice(4, 6)}${dateStr.slice(0, 4)}`;
}

/**
 * URLs du programme PMU, par ordre de préférence.
 *
 * `/programme` d'abord : c'est le SEUL endpoint programme qui répond (200,
 * vérifié le 2026-07-25 via le proxy ET en direct). `/programmeComplet` renvoie
 * 420 partout depuis le 04/07 — quels que soient le client, le format de date
 * et `specialisation` — mais on le garde en dernier recours au cas où PMU le
 * rétablirait : `normalizePmuReunions` sait lire les deux formes de réponse.
 */
export function buildProgrammeUrls(dateStr: string): string[] {
  const d = toPmuUrlDate(dateStr);
  return [
    // Vivants — proxy Cloudflare d'abord (l'IP du Worker est bloquée en direct).
    `${PMU_PROXY}/rest/client/61/programme/${d}`,
    `${PMU_PROXY}/rest/client/1/programme/${d}`,
    `${PMU_DIRECT}/rest/client/61/programme/${d}`,
    // Dernier recours — 420 depuis le 04/07, conservé si le contrat revient.
    `${PMU_PROXY}/rest/client/1/programmeComplet/${dateStr}?specialisation=INTERNET`,
    `${PMU_DIRECT}/rest/client/61/programmeComplet/${dateStr}?specialisation=INTERNET`,
  ];
}

export async function fetchPmuProgramme(dateStr?: string): Promise<PmuReunion[]> {
  const d = dateStr || toDateStr();
  const urls = buildProgrammeUrls(d);

  let lastError = "";
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (i > 0) await new Promise(r => setTimeout(r, 2000));

    try {
      const res = await fetch(url, {
        headers: PMU_HEADERS,
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json();
        const reunions = json?.programme?.reunions ?? json?.reunions ?? [];
        if (reunions.length > 0) {
          console.log(`[PMU API] Succès via: ${url}`);
          return reunions;
        }
        lastError = `200 mais 0 réunions (${url})`;
        continue;
      }

      const body = await res.text().catch(() => "");
      lastError = `HTTP ${res.status} — ${body.slice(0, 200)}`;
      console.warn(`[PMU API] ${res.status} pour ${url}: ${body.slice(0, 200)}`);
      // On continue même sur 420 pour tenter les autres endpoints

    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : String(e);
      console.warn(`[PMU API] Erreur réseau sur ${url}: ${lastError}`);
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

const NATIONALE_LABELS: Record<number, string> = {
  1: "Nationale 1 — Quinté+",
  2: "Nationale 2 — Quarté+",
  3: "Nationale 3 — Tiercé",
};

/**
 * Verdict "jouable Afrique" + label Nationale pour une course.
 * Priorise l'autoritaire LONACI (colonnes jouable_afrique/nationale), sinon
 * retombe sur l'heuristique derivee des paris disponibles.
 * jouable_afrique NULL/absent = non evalue -> fallback heuristique.
 */
export function resolveAfrique(course: {
  jouable_afrique?: boolean | null;
  nationale?: number | null;
  paris_disponibles?: string[] | null;
}): { jouable: boolean; nationaleLabel: string | null } {
  const paris = course.paris_disponibles ?? [];
  const jouable = course.jouable_afrique ?? isJouableAfrique(paris);
  const nationaleLabel =
    course.nationale != null && NATIONALE_LABELS[course.nationale]
      ? NATIONALE_LABELS[course.nationale]
      : jouable
        ? getNationaleLabel(paris)
        : null;
  return { jouable, nationaleLabel };
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
  timeoutMs = 1500,   // timeout par URL — 4 URLs × 1.5s = 6s max, sous le seuil Vercel 10s
): Promise<PmuParticipant[]> {
  const urls = [
    `${PMU_PROXY}/rest/client/1/partants/${dateStr}/R${R}/C${C}?specialisation=INTERNET`,
    `${PMU_DIRECT}/rest/client/61/partants/${dateStr}/R${R}/C${C}?specialisation=INTERNET`,
    `${PMU_DIRECT}/rest/client/7/partants/${dateStr}/R${R}/C${C}?specialisation=INTERNET`,
    `${PMU_PROXY}/rest/client/2/partants/${dateStr}/R${R}/C${C}?specialisation=OFFLINE`,
  ];

  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: PMU_HEADERS,
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = await res.json();
      const list: PmuParticipant[] =
        json?.participants ?? json?.partants ?? json?.programme?.participants ?? [];
      if (list.length > 0) return list;
    } catch {
      clearTimeout(timer);
      /* URL indisponible ou timeout — on passe à la suivante */
    }
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
  timeoutMs = 3000,   // timeout par URL — utilisé dans les crons, peut attendre un peu plus
): Promise<PmuResultat | null> {
  const urls = [
    `${PMU_PROXY}/rest/client/1/resultats/${dateStr}/R${R}/C${C}?specialisation=INTERNET`,
    `${PMU_DIRECT}/rest/client/61/resultats/${dateStr}/R${R}/C${C}?specialisation=INTERNET`,
    `${PMU_DIRECT}/rest/client/7/resultats/${dateStr}/R${R}/C${C}?specialisation=INTERNET`,
    `${PMU_PROXY}/rest/client/2/resultats/${dateStr}/R${R}/C${C}?specialisation=OFFLINE`,
  ];

  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: PMU_HEADERS,
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
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
    } catch {
      clearTimeout(timer);
      /* URL indisponible ou timeout — on passe à la suivante */
    }
  }
  return null;
}

/**
 * Transforme les réunions PMU en liste de courses normalisées.
 * Filtre automatiquement : France + Maroc uniquement, minimum 8 partants.
 */

// Pays autorisés pour Elite Turf (marché Afrique francophone)
const PAYS_AUTORISES: Record<string, string> = {
  FRA: "France",
  MAR: "Maroc",
};
const MIN_PARTANTS = 8;

/**
 * Variantes PMU qui ne se rapprochent pas seules d'un hippodrome EXISTANT.
 *
 * `libelleCourt` fait matcher 14 hippodromes sur 18 via `canonicalHippodrome` ;
 * ces 3 formes-là créeraient un DOUBLON (vérifié le 2026-07-25 contre les 183
 * hippodromes en base). On les rapproche explicitement plutôt que de relâcher
 * `canonicalHippodrome`, partagé avec LONACI, GenyBet et l'overlay distance —
 * un assouplissement là-bas risquerait de fusionner des hippodromes distincts.
 *
 * Clé = forme canonique (robuste à la casse et à la ponctuation). Un hippodrome
 * réellement absent de la base (ex. GUADELOUPE) n'a PAS d'alias : on ne lui en
 * invente pas, il sera créé tel que PMU le nomme.
 */
const ALIAS_HIPPODROME_PMU: Record<string, string> = {
  cagnesmer:      "Cagnes-sur-Mer",
  mauquenchy:     "Rouen-Mauquenchy",
  clairefontaine: "Clairefontaine-Deauville",
};

/** Nom d'hippodrome PMU rapproché du nom en base, sinon rendu inchangé. */
function resolveHippodromeNom(nom: string): string {
  return ALIAS_HIPPODROME_PMU[canonicalHippodrome(nom)] || nom;
}

export function normalizePmuReunions(reunions: PmuReunion[]): NormalizedCourse[] {
  const courses: NormalizedCourse[] = [];

  for (const reunion of reunions) {
    // ── Filtre 1 : pays autorisé (France + Maroc uniquement) ──
    const hipPays = PAYS_AUTORISES[reunionPaysCode(reunion)];
    if (!hipPays) continue;

    // ── Anti-fabrication : on n'invente ni numéro de réunion, ni date, ni nom
    //    d'hippodrome. Une réunion illisible est ignorée — jamais insérée avec
    //    une valeur par défaut (un `numero_reunion` absent violerait de toute
    //    façon la contrainte NOT NULL, et un hippodrome « Inconnu » polluerait
    //    la table).
    const numeroReunion = reunionNumero(reunion);
    if (numeroReunion === null) continue;

    const dateCourse = reunionDateISO(reunion);
    if (dateCourse === null) continue;

    // `libelleCourt` d'abord : « ENGHIEN » se rapproche du nom en base
    // (« Enghien ») via `canonicalHippodrome`, là où `libelleLong`
    // (« HIPPODROME D'ENGHIEN SOISY ») créerait un hippodrome en DOUBLON.
    const hipNomBrut = reunion.hippodrome?.libelleCourt || reunion.hippodrome?.libelleLong || "";
    if (!hipNomBrut) continue;
    const hipNom = resolveHippodromeNom(hipNomBrut);

    for (const c of reunion.courses ?? []) {
      const nbPartants = c.nombreDeclaresPartants || 0;

      // ── Filtre 2 : minimum 8 partants (Tiercé viable) ──
      if (nbPartants < MIN_PARTANTS) continue;

      const numeroCourse = typeof c.numOrdre === "number" && isFinite(c.numOrdre) ? c.numOrdre : null;
      if (numeroCourse === null) continue;

      const heureDepart = tsToTime(c.heureDepart);
      if (heureDepart === null) continue;

      courses.push({
        hippodromeName:   hipNom,
        hippodromePays:   hipPays,
        dateCourse,
        heureDepart,
        numeroReunion,
        numeroCourse,
        libelle:          decodeHtmlEntities(c.libelle || `Course R${numeroReunion}C${numeroCourse}`),
        distanceMetres:   c.distance || 0,
        // `specialite` d'abord : sur `/programme`, `discipline` vaut "ATTELE".
        categorie:        toCategorie(c.specialite || c.discipline),
        nbPartants,
        parisDisponibles: extractParisDisponibles(c),
      });
    }
  }

  return courses;
}
