import { todayParisISO, tomorrowParisISO } from "@/lib/paris-date";

const GENY_BASE = "https://www.geny.com";

/**
 * Construit un lien Geny à partir d'une URL stockée en DB (geny_url).
 *
 * La vraie URL Geny d'une course individuelle suit le format :
 *   /partants-pmu/2026-04-23-parislongchamp-pmu-prix-du-pantheon_c1647206
 * Ce format comporte un slug de hippodrome, un slug de course et un ID interne
 * qu'on ne peut pas reconstruire à la volée → il faut utiliser l'URL stockée.
 *
 * Pour les RÉSULTATS, Geny n'utilise pas la même structure d'URL :
 * la page arrivée + rapports vit sur :
 *   /arrivee-et-rapports-pmu?id_course=<ID>
 * où <ID> est extrait du suffixe `_c<ID>` de l'URL partants.
 * (L'ancien chemin /resultats-pmu/<slug> est 404 — vérifié 2026-05-06.)
 *
 * @param genyUrl   Valeur de courses.geny_url (chemin absolu commençant par "/")
 * @param type      "partants" (défaut) ou "resultats"
 */
export function buildGenyUrlFromStored(
  genyUrl: string,
  type: "partants" | "resultats" = "partants"
): string {
  if (type === "resultats") {
    const id = extractCourseIdFromGenyUrl(genyUrl);
    if (id) {
      return `${GENY_BASE}/arrivee-et-rapports-pmu?id_course=${id}`;
    }
    // Pas d'ID extractable : on retourne quand même un lien lisible (page partants).
    return `${GENY_BASE}${genyUrl.replace("/resultats-pmu/", "/partants-pmu/")}`;
  }
  // type === "partants"
  return `${GENY_BASE}${genyUrl.replace("/resultats-pmu/", "/partants-pmu/")}`;
}

/**
 * Extrait l'ID interne Geny depuis le suffixe `_c<ID>` de l'URL stockée.
 * Ex : "/partants-pmu/2026-04-25-auteuil-pmu-prix_c1647693" → "1647693"
 * Renvoie null si pattern non reconnu.
 */
export function extractCourseIdFromGenyUrl(genyUrl: string): string | null {
  const m = genyUrl.match(/_c(\d+)(?:[/?#]|$)/);
  return m ? m[1] : null;
}

/**
 * Fallback : lien vers le programme du jour quand geny_url n'est pas encore stocké.
 * Redirige vers la page du programme (pas une course individuelle).
 */
export function buildGenyUrl(
  dateCourse: string,
  _numeroReunion: number,
  _numeroCourse: number,
  _type: "partants" | "resultats" = "partants"
): string {
  // ⚠️  Les URLs individuelles Geny ne peuvent pas être reconstruites sans l'ID interne.
  // On renvoie la page programme du jour comme fallback lisible par l'utilisateur.
  // Comparaison faite en heure de PARIS car Geny est hébergé en France et nos
  // workers tournent en UTC (cf. lib/paris-date.ts pour le contexte).
  if (dateCourse === todayParisISO()) return `${GENY_BASE}/reunions-courses-pmu/_daujourdhui`;
  if (dateCourse === tomorrowParisISO()) return `${GENY_BASE}/reunions-courses-pmu/_ddemain`;
  return `${GENY_BASE}/reunions-courses-pmu/${dateCourse}_d${dateCourse}`;
}

/**
 * @deprecated  Utiliser buildGenyUrlFromStored() quand geny_url est disponible.
 */
export function buildGenyUrlAuto(
  dateCourse: string,
  numeroReunion: number,
  numeroCourse: number
): string {
  return buildGenyUrl(dateCourse, numeroReunion, numeroCourse);
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
  nonPartant?:   boolean;
}

// ── Sanitizers : alignés sur les contraintes DB ──────────────────────────────
// partants.cote     = numeric(6,2) → max 9999.99
// partants.poids_kg = numeric(4,1) → max 999.9
// partants.numero, place_corde, age = integer → max 2147483647 (jamais atteint)
//
// Les overflow venaient d'erreurs de parsing Geny qui chopent une cellule
// "Gains" (ex: 87985) à la place d'une cote/poids. On clampe à null pour
// éviter Postgres "numeric field overflow" sur insert bulk.

/** Renvoie une cote DB-safe (numeric(6,2)). Hors plage → null. */
export function safeCote(n: number | undefined | null): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (n <= 0 || n > 9999.99) return null;
  return Number(n.toFixed(2));
}

/** Renvoie un poids DB-safe (numeric(4,1) — max 999.9 kg). Hors plage → null. */
export function safePoids(n: number | undefined | null): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  // Min 30 kg (poulain léger), max 999.9 (DB cap). Au-delà : valeur Geny erronée
  // (probable parsing d'une colonne Gains à la place du Poids).
  if (n < 30 || n > 999.9) return null;
  return Number(n.toFixed(1));
}

/** Renvoie un entier DB-safe (integer). null si invalide ou hors plage. */
export function safeSmallInt(n: number | undefined | null, min = 1, max = 99): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

// ── Helpers HTML ─────────────────────────────────────────────────────────────

/**
 * Entités HTML nommées rencontrées dans Geny (notamment dans les `<thead>` :
 * "Derni&egrave;res cotes", "R&eacute;sultats", "&Eacute;quipe").
 * Couvre les caractères accentués français + ñ/ç majuscules/minuscules.
 * (Liste minimale ; pour décodage exhaustif HTML5 il faudrait une lib.)
 */
const NAMED_ENTITIES: Record<string, string> = {
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", aring: "å", aelig: "æ",
  egrave: "è", eacute: "é", ecirc: "ê", euml: "ë",
  igrave: "ì", iacute: "í", icirc: "î", iuml: "ï",
  ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö", oslash: "ø",
  ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü",
  yacute: "ý", yuml: "ÿ", ccedil: "ç", ntilde: "ñ", szlig: "ß",
  Agrave: "À", Aacute: "Á", Acirc: "Â", Atilde: "Ã", Auml: "Ä", Aring: "Å", AElig: "Æ",
  Egrave: "È", Eacute: "É", Ecirc: "Ê", Euml: "Ë",
  Igrave: "Ì", Iacute: "Í", Icirc: "Î", Iuml: "Ï",
  Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ", Ouml: "Ö", Oslash: "Ø",
  Ugrave: "Ù", Uacute: "Ú", Ucirc: "Û", Uuml: "Ü",
  Yacute: "Ý", Ccedil: "Ç", Ntilde: "Ñ",
};

/** Supprime les balises HTML et décode les entités de base. */
function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&([A-Za-z]+);/g, (full, name) => NAMED_ENTITIES[name] ?? full)
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
 * Détecte si une chaîne ressemble à une "musique PMU" (historique récent
 * d'un cheval) plutôt qu'à un vrai nom d'entraineur ou de jockey.
 *
 * Format musique : suite de codes "place + lettre type-course" séparés par
 * tirets ou collés. Exemples réels rencontrés en BDD à cause du bug parser :
 *   "0a(25)DaDa"     — places + (année) + suspension
 *   "3m5m0a6m4m"     — courses au monté
 *   "0h3h7h1h"       — courses haies
 *   "2p1p3p"         — courses plat
 *   "(25)1a4a8a"     — avec parenthèse année
 *
 * Lettres turf : a (attelé/plat), m (monté), h (haies), p (plat/parcours),
 *                s (steeple), D (disqualifié), T (tombé), R (refus), t (tiré).
 *
 * @returns true si la chaîne ressemble à une musique (à rejeter pour
 *          entraineur/jockey), false sinon.
 */
export function looksLikeMusique(str: string): boolean {
  if (!str) return false;
  const s = str.trim();
  // Trop court pour être un nom réaliste (1-2 chars) → suspect
  if (s.length < 3) return false;

  // Si la chaîne contient des espaces normaux (ex: "J. Dupont", "F. Boudot"),
  // c'est presque toujours un vrai nom. La musique est généralement collée
  // ou séparée par tirets/parenthèses uniquement.
  if (/\s+[A-Z]/.test(s) && !/\d/.test(s.replace(/\(.*?\)/g, ""))) return false;

  // Pattern 1 : suite chiffre+lettre turf répétée (au moins 2 fois)
  //   ex: "0h3h7h1h", "3m5m0a6m4m", "2p1p3p", "1a2a4a"
  if (/^(\(\d{2}\))?(\d[ahmpsDTRt]){2,}$/i.test(s.replace(/\s+/g, ""))) {
    return true;
  }

  // Pattern 2 : commence par chiffre+lettre turf et contient peu de
  // caractères "non-musique"
  //   ex: "0a(25)DaDa", "(25)1a4a8a"
  const sansParentheses = s.replace(/\(\d+\)/g, "");
  if (/^[\d]([ahmpsDTRt]\d){2,}/i.test(sansParentheses.replace(/\s+/g, ""))) {
    return true;
  }

  // Pattern 3 : ratio chiffres + lettres turf >= 70% de la chaîne
  const totalChars = s.replace(/[\s\-]/g, "").length;
  const musiqueChars = (s.match(/[\d]|[ahmpsDTRt]/gi) || []).length;
  if (totalChars >= 4 && musiqueChars / totalChars >= 0.7) {
    return true;
  }

  return false;
}

/**
 * Normalise un libellé d'en-tête HTML pour comparaison robuste :
 *  - retire HTML, entités, accents, ponctuation, espaces
 *  - passe en lowercase
 * Ex : "Entraîneur" → "entraineur", "Dernières cotes" → "dernierescotes",
 *      "Cotes références" → "cotesreferences", "N°" → "n".
 */
function normalizeHeader(raw: string): string {
  return stripHtml(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Champs structurés que le parser sait remplir depuis le tableau Geny. */
interface GenyHeaderIndex {
  num?:          number;
  nom?:          number;
  placeCorde?:   number;  // colonne "C" (Plat uniquement)
  sa?:           number;  // sexe + age, ex "F6", "M3", "H9"
  poids?:        number;  // colonne "Poids" (Plat uniquement)
  jockey?:       number;  // "Jockey" (Plat) ou "Driver" (Trot) — alias
  entraineur?:   number;
  musique?:      number;
  coteAncienne?: number;  // "Cotes références"
  coteActuelle?: number;  // "Dernières cotes"
}

/**
 * Mapping libellé Geny normalisé → champ partant.
 * Colonnes ignorées (décision PO 2026-05-14) : Dist./Distance, Déch., Gains,
 * Valeur. Elles ne sont pas reportées en BDD.
 */
const HEADER_TO_FIELD: Record<string, keyof GenyHeaderIndex> = {
  n:               "num",
  cheval:          "nom",
  c:               "placeCorde",
  sa:              "sa",
  poids:           "poids",
  jockey:          "jockey",
  driver:          "jockey",
  entraineur:      "entraineur",
  musique:         "musique",
  cotesreferences: "coteAncienne",
  dernierescotes:  "coteActuelle",
};

/** Construit un mapping {champ → index colonne} depuis le <thead> Geny. */
function parseTheadIndex(theadHtml: string): GenyHeaderIndex {
  const idx: GenyHeaderIndex = {};
  const re = /<th[^>]*>([\s\S]*?)<\/th>/gi;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(theadHtml)) !== null) {
    const key = normalizeHeader(m[1]);
    const field = HEADER_TO_FIELD[key];
    // Premier mapping gagne (évite qu'un en-tête dupliqué écrase l'indice).
    if (field && idx[field] === undefined) idx[field] = i;
    i++;
  }
  return idx;
}

/**
 * Parse la page HTML des partants Geny pour extraire les chevaux.
 *
 * **Mapping dynamique par <thead>** (refactor 2026-05-14) : on lit les
 * en-têtes du tableau et on construit un index colonne par colonne. Cela
 * couvre les deux structures Geny rencontrées :
 *
 * - **TROT** (10 colonnes) : N° / Cheval / SA / Dist. / Driver / Entraîneur /
 *   Musique / Gains / Cotes références / Dernières cotes
 *
 * - **PLAT/GALOP** (12 colonnes) : N° / Cheval / C / SA / Poids / Déch. /
 *   Jockey / Entraîneur / Musique / Valeur / Cotes références / Dernières cotes
 *
 * Avant ce refactor, le parser supposait une structure "unifiée 10 cols",
 * ce qui décalait toutes les colonnes en Plat : le poids était stocké comme
 * jockey, le jockey comme musique, et la cote prise depuis la colonne
 * "Valeur" Geny (≠ cote réelle). ~43% des partants étaient corrompus.
 *
 * NB technique : Geny imbrique une sous-table <table class="table-oei"> dans
 * la cellule "Cheval" pour afficher les icônes œillères/attache-langue. Cette
 * sous-table casse le regex <tr>...</tr> non-greedy. On la retire AVANT de
 * parser, et on isole thead/tbody du tableau "tableau_partants" pour éviter
 * de capturer les <tr> d'autres tableaux de la page (stats jockeys).
 */
function parseGenyPartants(html: string): GenyParticipant[] {
  const participants: GenyParticipant[] = [];

  // 1) Localiser thead + tbody du tableau principal en une seule passe.
  const tableMatch = html.match(
    /id="tableau_partants"[\s\S]*?(<thead[\s\S]*?<\/thead>)[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i,
  );
  if (!tableMatch) {
    console.warn("[Geny parser] tableau_partants/thead/tbody introuvable");
    return [];
  }

  const idx = parseTheadIndex(tableMatch[1]);
  // Garde-fou : sans num+nom on ne peut rien faire d'utile.
  if (idx.num === undefined || idx.nom === undefined) {
    console.warn("[Geny parser] en-têtes critiques (N°, Cheval) introuvables", idx);
    return [];
  }

  // 2) Retirer les sous-tables imbriquées qui cassent le regex <tr>.
  const tbody = tableMatch[2].replace(/<table[^>]*>[\s\S]*?<\/table>/gi, "");

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  /** Lit une cellule via l'index colonne et renvoie une string trimée. "" si absent. */
  const cellAt = (cells: string[], i: number | undefined): string =>
    i !== undefined && i < cells.length ? (cells[i] || "").trim() : "";

  while ((rowMatch = rowRe.exec(tbody)) !== null) {
    const cells = extractCells(rowMatch[1]);
    // Doit au moins contenir la colonne nom pour être exploitable.
    if (cells.length <= idx.nom) continue;

    const num = parseInt(cellAt(cells, idx.num), 10);
    if (isNaN(num) || num < 1 || num > 30) continue;

    // Geny intègre des icônes (œillères, attache-langue) via des
    // caractères Unicode Private Use Area (U+E900-U+E9FF). On les retire
    // pour garder un nom propre.
    const nom = cellAt(cells, idx.nom)
      .replace(/[-]/g, "")
      .replace(/\s+/g, " ")
      .trim() || `Cheval ${num}`;

    // Ignore les lignes entêtes récurrentes (ex: "Cheval")
    if (/^cheval$/i.test(nom)) continue;

    // SA → "F6" (femelle 6 ans), "M3" (mâle), "H9" (hongre)
    const sa = cellAt(cells, idx.sa);
    const sexe = sa.length > 0 ? sa.charAt(0).toUpperCase() : undefined;
    const age = sa.length > 1 ? (parseInt(sa.slice(1), 10) || undefined) : undefined;

    // Corde "C" (Plat uniquement). Trot n'a pas cette colonne.
    let placeCorde: number | undefined;
    if (idx.placeCorde !== undefined) {
      const c = parseInt(cellAt(cells, idx.placeCorde), 10);
      if (Number.isFinite(c) && c >= 1 && c <= 30) placeCorde = c;
    }

    // Poids handicap (Plat uniquement). Trot n'a pas cette colonne.
    let poids: number | undefined;
    if (idx.poids !== undefined) {
      const p = parseFloat(cellAt(cells, idx.poids).replace(",", "."));
      // Range raisonnable poids cavalier+selle (Plat handicap : 49-62 kg
      // typiquement, marge 30-100 pour cas atypiques).
      if (Number.isFinite(p) && p >= 30 && p <= 100) poids = p;
    }

    const jockeyNom = cellAt(cells, idx.jockey);
    let entraineurNom = cellAt(cells, idx.entraineur);
    let musique: string | undefined = cellAt(cells, idx.musique) || undefined;
    if (musique === "-" || musique === "") musique = undefined;

    // Garde-fou anti-pollution historique : si l'entraineur "ressemble à
    // une musique" (ex "3m5m0a6m4m", "0h3h7h1h"), c'est un bug Geny qui
    // n'a pas renvoyé la bonne colonne → on rejette l'entraineur et on
    // remonte cette valeur en musique si la musique est vide. Garde sa
    // pertinence même avec mapping dynamique (sécurité défensive).
    if (entraineurNom && looksLikeMusique(entraineurNom)) {
      if (!musique) musique = entraineurNom;
      entraineurNom = "";
    }

    // Cote : préférer "Dernières cotes" (à jour), fallback "Cotes références".
    const coteActu = cellAt(cells, idx.coteActuelle);
    const coteAncienne = cellAt(cells, idx.coteAncienne);
    const coteRaw =
      (coteActu && coteActu !== "-" ? coteActu : "") ||
      (coteAncienne && coteAncienne !== "-" ? coteAncienne : "");
    const coteProbable = coteRaw
      ? (parseFloat(coteRaw.replace(",", ".")) || undefined)
      : undefined;

    // Non-partant : Geny met "Non-partant" dans jockey ou nom du cheval.
    const nonPartant =
      /non[\s-]?partant/i.test(jockeyNom) ||
      /non[\s-]?partant/i.test(nom);

    participants.push({
      numPmu:      num,
      nom,
      placeCorde,
      sexe,
      age,
      poids,
      jockey:      jockeyNom && !nonPartant ? { nom: jockeyNom } : undefined,
      entraineur:  entraineurNom ? { nom: entraineurNom } : undefined,
      musique,
      coteProbable,
      nonPartant,
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
 * @param R            numéro réunion (ignoré si genyUrl fourni)
 * @param C            numéro course  (ignoré si genyUrl fourni)
 * @param timeoutMs    timeout fetch (défaut 6 s)
 * @param genyUrl      URL complète Geny depuis courses.geny_url (ex: "/partants-pmu/2026-04-23-..._c1647206")
 *                     Quand fourni, dateCourse/R/C sont ignorés pour la construction de l'URL.
 */
export async function fetchGenyPartants(
  dateCourse: string,
  R: number,
  C: number,
  timeoutMs = 6000,
  genyUrl?: string | null,
): Promise<GenyParticipant[]> {
  // Utiliser l'URL stockée en DB si disponible, sinon fallback (programme day)
  const url = genyUrl
    ? `${GENY_BASE}${genyUrl.startsWith("/") ? genyUrl : "/" + genyUrl}`
    : buildGenyUrl(dateCourse, R, C, "partants");

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
