const GENY_BASE = "https://www.geny.com";

/**
 * Construit un lien Geny à partir d'une URL stockée en DB (geny_url).
 *
 * La vraie URL Geny d'une course individuelle suit le format :
 *   /partants-pmu/2026-04-23-parislongchamp-pmu-prix-du-pantheon_c1647206
 * Ce format comporte un slug de hippodrome, un slug de course et un ID interne
 * qu'on ne peut pas reconstruire à la volée → il faut utiliser l'URL stockée.
 *
 * @param genyUrl   Valeur de courses.geny_url (chemin absolu commençant par "/")
 * @param type      "partants" (défaut) ou "resultats"
 */
export function buildGenyUrlFromStored(
  genyUrl: string,
  type: "partants" | "resultats" = "partants"
): string {
  // Remplacer le préfixe partants-pmu ↔ resultats-pmu si nécessaire
  const path = type === "resultats"
    ? genyUrl.replace("/partants-pmu/", "/resultats-pmu/")
    : genyUrl.replace("/resultats-pmu/", "/partants-pmu/");
  return `${GENY_BASE}${path}`;
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
  const today = new Date().toISOString().split("T")[0];
  if (dateCourse === today) return `${GENY_BASE}/reunions-courses-pmu/_daujourdhui`;
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
 * Détecte si une valeur ressemble à une musique PMU (ex: "2p1p(25)3a", "Da9a", "0a").
 * Utilisé pour distinguer une colonne jockey d'une colonne musique dans le tableau Geny.
 */
function looksLikeMusique(val: string): boolean {
  // La musique PMU contient des chiffres suivis de lettres (p=plat, a=attelé, m=monté, s=steeplechase)
  // et parfois des parenthèses avec des gains ex: (25), (12)
  return /^\s*(?:\d*[a-zA-D()\s]+){2,}/.test(val) && /\d/.test(val) && /[a-zA-D]/.test(val);
}

/**
 * Parse la page HTML des partants Geny pour extraire les chevaux.
 *
 * Geny utilise deux structures de tableau selon le type de course :
 *
 * GALOP (Plat / Obstacle) — colonnes TD :
 *  [0] N°    [1] Cheval  [2] C  [3] SA  [4] Poids  [5] Déch
 *  [6] Jockey  [7] Entraîneur  [8] Musique  [9] Valeur  [10] CotesRéf  [11] DernièresCotes
 *
 * TROT (Attelé / Monté) — colonnes TD :
 *  [0] N°    [1] Cheval  [2] SA  [3] Poids  [4] RédKm  [5] Déch
 *  [6] Musique  [7] Gains  [8] Driver  [9] Entraîneur  [10-11] Cotes
 *
 * On détecte automatiquement le type en vérifiant si cells[6] ressemble à une musique PMU.
 *
 * NB : depuis 2026, Geny imbrique une sous-table <table class="table-oei">
 * dans la cellule "Cheval" pour afficher les icônes œillères/attache-langue.
 * Cette sous-table casse le regex <tr>...</tr> non-greedy. On la retire AVANT
 * de parser, et on isole le <tbody> du tableau "tableau_partants" pour éviter
 * de capturer les <tr> d'autres tableaux de la page (stats jockeys, etc.).
 */
function parseGenyPartants(html: string): GenyParticipant[] {
  const participants: GenyParticipant[] = [];

  // 1) Localiser le <tbody> du tableau principal des partants
  const tbodyMatch = html.match(
    /id="tableau_partants"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i,
  );
  if (!tbodyMatch) {
    console.warn("[Geny parser] tableau_partants/tbody introuvable");
    return [];
  }
  // 2) Retirer les sous-tables imbriquées (icônes œillères, attache-langue)
  //    qui pourrissent le matching <tr> non-greedy.
  const tbody = tbodyMatch[1].replace(/<table[^>]*>[\s\S]*?<\/table>/gi, "");

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(tbody)) !== null) {
    const cells = extractCells(rowMatch[1]);

    // On veut au moins 8 colonnes et la première doit être un numéro de partant (1-30)
    if (cells.length < 8) continue;
    const num = parseInt(cells[0], 10);
    if (isNaN(num) || num < 1 || num > 30) continue;

    const nom = cells[1] || `Cheval ${num}`;

    // Ignore les lignes entêtes récurrentes (ex: "Cheval")
    if (/^cheval$/i.test(nom)) continue;

    // Détection auto galop vs trot :
    // Si cells[6] ressemble à une musique PMU → structure TROT
    const isTrot = looksLikeMusique(cells[6] ?? "");

    let jockeyNom: string;
    let entraineurNom: string;
    let musique: string | undefined;
    let placeCorde: number | undefined;
    let sexe: string | undefined;
    let age: number | undefined;
    let poids: number | undefined;

    if (isTrot) {
      // ── Structure TROT ──────────────────────────────────────────────
      // [2]=SA  [3]=Poids  [6]=Musique  [7]=Gains  [8]=Driver  [9]=Entraîneur
      const sa = cells[2] || "";
      sexe      = sa.length > 0 ? sa.charAt(0).toUpperCase() : undefined;
      age       = sa.length > 1 ? (parseInt(sa.slice(1), 10) || undefined) : undefined;
      poids     = parseFloat((cells[3] || "").replace(",", ".")) || undefined;
      musique   = cells[6] || undefined;
      // cells[7] = Gains (numérique, ex: "87,985") — ignoré
      jockeyNom    = cells[8] || "";   // Driver
      entraineurNom = cells[9] || "";  // Entraîneur
    } else {
      // ── Structure GALOP ─────────────────────────────────────────────
      // [2]=C  [3]=SA  [4]=Poids  [5]=Déch  [6]=Jockey  [7]=Entraîneur  [8]=Musique
      placeCorde   = parseInt(cells[2], 10) || undefined;
      const sa     = cells[3] || "";
      sexe         = sa.length > 0 ? sa.charAt(0).toUpperCase() : undefined;
      age          = sa.length > 1 ? (parseInt(sa.slice(1), 10) || undefined) : undefined;
      poids        = parseFloat((cells[4] || "").replace(",", ".")) || undefined;
      jockeyNom    = cells[6] || "";
      entraineurNom = cells[7] || "";
      musique      = cells[8] || undefined;
    }

    // Musique : nettoyer "-" ou valeurs vides
    if (musique === "-" || musique === "") musique = undefined;

    // Cotes : préférer "Dernières cotes" [11], sinon "Cotes réf." [10]
    const coteRaw =
      (cells[11] && cells[11] !== "-" ? cells[11] : null) ??
      (cells[10] && cells[10] !== "-" ? cells[10] : null) ?? "";
    const coteProbable = parseFloat(coteRaw.replace(",", ".")) || undefined;

    // Détection non-partant : Geny met "Non-partant" dans la colonne jockey
    // ou dans le nom du cheval pour les chevaux qui ne courront pas.
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
      entraineur:  entraineurNom  ? { nom: entraineurNom }  : undefined,
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
