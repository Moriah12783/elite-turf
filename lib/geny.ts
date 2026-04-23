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
  return `https://www.geny.com/partants-pmu/${slug}`;
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

// ── Types re-exportés pour éviter l'import circulaire ────────────────────────

export interface GenyParticipant {
  numPmu:        number;
  nom:           string;
  coteProbable?: number;
  jockey?:       { nom: string };
  entraineur?:   { nom: string };
  musique?:      string;
  poids?:        number;
  age?:          number;
  sexe?:         string;
  placeCorde?:   number;
}

// ── Helpers HTML ─────────────────────────────────────────────────────────────

/** Supprime les balises HTML et décode les entités de base */
function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g,    (_, n)   => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Extrait les textes des <td> d'une ligne <tr> */
function extractCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const re = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowHtml)) !== null) {
    cells.push(stripHtml(m[1]));
  }
  return cells;
}

/**
 * Parse la page HTML des partants Geny pour extraire les chevaux.
 *
 * Colonnes attendues (ordre Geny partants-pmu) :
 *  [0] N°          numéro partant   ex: "1"
 *  [1] Cheval       nom             ex: "Ephesus"
 *  [2] C            place corde     ex: "4"
 *  [3] SA           sexe+âge        ex: "H4"  (H=Hongre, F=Femelle, M=Mâle, G=Gelding)
 *  [4] Poids        kg              ex: "61,5"
 *  [5] Déch.        décharge        ex: "-"
 *  [6] Jockey                       ex: "C. Demuro"
 *  [7] Entraîneur                   ex: "P. & J. Brandt"
 *  [8] Musique                      ex: "2p(25)1p2p"
 *  [9] Valeur                       ex: "42,5"
 * [10] Cotes réf.                   ex: "8,1"
 * [11] Dernières cotes              ex: "7,7"
 */
function parseGenyPartants(html: string): GenyParticipant[] {
  const participants: GenyParticipant[] = [];

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells = extractCells(rowMatch[1]);

    // On veut au moins 8 colonnes et la première doit être un numéro de partant (1-30)
    if (cells.length < 8) continue;
    const num = parseInt(cells[0], 10);
    if (isNaN(num) || num < 1 || num > 30) continue;

    const nom = cells[1] || `Cheval ${num}`;

    // Ignore les lignes entêtes récurrentes (ex: "Cheval")
    if (/^cheval$/i.test(nom)) continue;

    // Place corde (colonne 2)
    const placeCorde = parseInt(cells[2], 10) || undefined;

    // SA : sexe + âge  ex: "H4", "F5", "M5", "G4"
    const sa   = cells[3] || "";
    const sexe = sa.length > 0 ? sa.charAt(0).toUpperCase() : undefined;
    const age  = sa.length > 1 ? (parseInt(sa.slice(1), 10) || undefined) : undefined;

    // Poids (virgule → point)
    const poids = parseFloat((cells[4] || "").replace(",", ".")) || undefined;

    // Jockey (enlever éventuels préfixes "Mlle ", "M. " etc.)
    const jockeyNom = cells[6] || "";

    // Entraîneur
    const entraineurNom = cells[7] || "";

    // Musique
    const musique = cells[8] || undefined;

    // Cotes : préférer "Dernières cotes" [11], sinon "Cotes réf." [10]
    const coteRaw =
      (cells[11] && cells[11] !== "-" ? cells[11] : null) ??
      (cells[10] && cells[10] !== "-" ? cells[10] : null) ?? "";
    const coteProbable = parseFloat(coteRaw.replace(",", ".")) || undefined;

    participants.push({
      numPmu:      num,
      nom,
      placeCorde,
      sexe,
      age,
      poids,
      jockey:      jockeyNom      ? { nom: jockeyNom }      : undefined,
      entraineur:  entraineurNom  ? { nom: entraineurNom }  : undefined,
      musique,
      coteProbable,
    });
  }

  // Trier par numéro et dédupliquer (au cas où une ligne serait capturée deux fois)
  const seen = new Set<number>();
  return participants
    .filter((p) => { if (seen.has(p.numPmu)) return false; seen.add(p.numPmu); return true; })
    .sort((a, b) => a.numPmu - b.numPmu);
}

// ── Fetch public ─────────────────────────────────────────────────────────────

const GENY_HEADERS = {
  Accept:          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://www.geny.com/",
};

/**
 * Récupère les partants d'une course en scrapant la page publique Geny.
 *
 * Utilisé en fallback quand l'API PMU est indisponible (HTTP 420 rate-limit).
 * Retourne un tableau compatible avec PmuParticipant[] (même structure).
 *
 * @param dateCourse   "YYYY-MM-DD"
 * @param R            numéro réunion
 * @param C            numéro course
 * @param timeoutMs    timeout fetch (défaut 6 s)
 */
export async function fetchGenyPartants(
  dateCourse: string,
  R: number,
  C: number,
  timeoutMs = 6000,
): Promise<GenyParticipant[]> {
  const url = buildGenyUrl(dateCourse, R, C, "partants");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: GENY_HEADERS,
      cache:   "no-store",
      signal:  controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[Geny scrape] HTTP ${res.status} pour ${url}`);
      return [];
    }

    const html = await res.text();
    const partants = parseGenyPartants(html);
    if (partants.length > 0) {
      console.log(`[Geny scrape] ${partants.length} partants extraits depuis ${url}`);
    } else {
      console.warn(`[Geny scrape] 0 partants extraits depuis ${url}`);
    }
    return partants;
  } catch (e) {
    clearTimeout(timer);
    console.warn(`[Geny scrape] Erreur pour ${url}:`, e instanceof Error ? e.message : e);
    return [];
  }
}
