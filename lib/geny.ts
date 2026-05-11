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
 * Parse la page HTML des partants Geny pour extraire les chevaux.
 *
 * **Structure unifiée Geny 2026 (TROT et GALOP)** — 10 colonnes :
 *
 *  [0] N°            [1] Cheval        [2] SA (sexe+age, ex "M3", "F3", "H9")
 *  [3] Distance      [4] Jockey/Driver [5] Entraîneur
 *  [6] Musique       [7] Gains         [8] Cote ancienne
 *  [9] Cote actuelle (= cote probable)
 *
 * Vérifié 2026-05-09 sur Caen (trot) + Hyères (galop) : structure identique
 * pour les deux disciplines.
 *
 * Note historique : avant 2026, Geny utilisait deux structures différentes
 * (12 colonnes pour galop, 12 pour trot avec ordre différent). Le parser
 * faisait une détection trot vs galop. Maintenant tout est unifié.
 *
 * NB : Geny imbrique une sous-table <table class="table-oei"> dans la
 * cellule "Cheval" pour afficher les icônes œillères/attache-langue. Cette
 * sous-table casse le regex <tr>...</tr> non-greedy. On la retire AVANT
 * de parser, et on isole le <tbody> du tableau "tableau_partants" pour
 * éviter de capturer les <tr> d'autres tableaux de la page (stats jockeys).
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

    // Structure 2026 : 10 colonnes minimum (parfois 11 si Geny ajoute une col).
    // ⚠️ AVANT : on tolérait `< 8` ce qui causait un décalage cells[5]/cells[6]
    // → l'entraineur recevait la MUSIQUE du cheval (bug parser massif :
    //   356 faux entraineurs créés en BDD sur 1591, soit 22% pollution).
    // Maintenant on accepte 8-9 colonnes mais SANS extraire entraineur/musique
    // pour éviter la corruption.
    if (cells.length < 8) continue;
    const num = parseInt(cells[0], 10);
    if (isNaN(num) || num < 1 || num > 30) continue;

    /** Structure complète disponible (10+ colonnes) → on peut tout extraire. */
    const fullStructure = cells.length >= 10;

    // Geny intègre des icônes (œillères, attache-langue, déferré) via des
    // caractères Unicode Private Use Area (U+E900-U+E9FF). On les retire pour
    // garder un nom propre. Les `&#xe904;` sont déjà décodés par stripHtml.
    const nom = (cells[1] || `Cheval ${num}`)
      .replace(/[-]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Ignore les lignes entêtes récurrentes (ex: "Cheval")
    if (/^cheval$/i.test(nom)) continue;

    // ── Mapping unifié structure 2026 ─────────────────────────────────
    // [2] = SA → ex "M3" (mâle 3 ans), "F3" (femelle), "H9" (hongre 9 ans)
    const sa  = cells[2] || "";
    const sexe = sa.length > 0 ? sa.charAt(0).toUpperCase() : undefined;
    const age  = sa.length > 1 ? (parseInt(sa.slice(1), 10) || undefined) : undefined;

    // [3] = Distance (info course, identique pour tous → ignoré ici car
    //       c'est une donnée de la course, pas du partant individuel)
    // Pas de "poids" dans la structure 2026 — pour le galop, le poids du
    //  jockey n'est plus exposé dans cette table simplifiée.
    const poids: number | undefined = undefined;
    const placeCorde: number | undefined = undefined;

    // [4] = Jockey (galop) ou Driver (trot)
    const jockeyNom = (cells[4] || "").trim();

    // [5] = Entraîneur — UNIQUEMENT si structure complète (10+ colonnes)
    // Sinon on prend le risque d'avoir la musique du cheval à la place.
    let entraineurNom = fullStructure ? (cells[5] || "").trim() : "";

    // [6] = Musique — UNIQUEMENT si structure complète
    let musique: string | undefined = fullStructure
      ? ((cells[6] || "").trim() || undefined)
      : undefined;
    if (musique === "-" || musique === "") musique = undefined;

    // ── Garde-fou anti-pollution : si l'entraineur "ressemble à une musique"
    //    (ex: "0a(25)DaDa", "3m5m0a6m4m", "0h3h7h1h"), c'est un bug parser
    //    Geny qui n'a pas renvoyé la bonne colonne → on rejette l'entraineur
    //    et on remonte cette valeur en musique si la musique est vide.
    if (entraineurNom && looksLikeMusique(entraineurNom)) {
      if (!musique) {
        musique = entraineurNom;
      }
      entraineurNom = "";
    }

    // [7] = Gains (numérique, ignoré pour l'instant)

    // [8] = Cote ancienne, [9] = Cote actuelle. On préfère [9] (la plus à jour).
    const coteActu = (cells[9] || "").trim();
    const coteAncienne = (cells[8] || "").trim();
    const coteRaw =
      (coteActu && coteActu !== "-" ? coteActu : "") ||
      (coteAncienne && coteAncienne !== "-" ? coteAncienne : "");
    const coteProbable = coteRaw
      ? (parseFloat(coteRaw.replace(",", ".")) || undefined)
      : undefined;

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
