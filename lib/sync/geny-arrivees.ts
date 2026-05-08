/**
 * lib/sync/geny-arrivees.ts
 *
 * Scrape les arrivées depuis Geny.com et update Supabase. PMU API est
 * complètement déprécié (rate-limit HTTP 420 chronique sur les IPs
 * Cloudflare/Vercel).
 *
 * Stratégie depuis 2026-05-05 :
 *  - On utilise courses.geny_url (stockée à l'insertion) → on transforme
 *    /partants-pmu/... en /resultats-pmu/... via buildGenyUrlFromStored().
 *    Cette URL avec slug + ID interne est la SEULE forme reconnue par Geny.
 *  - L'ancienne URL pattern `/resultats-pmu/{date}r{R}c{C}` ne fonctionne
 *    plus (404 → "Unexpected end of JSON input" en aval).
 *  - On parse l'arrivée via plusieurs patterns regex (HTML Geny varie selon
 *    galop/trot/obstacle).
 */

import { createServiceClient } from "@/lib/supabase/server";
import { buildGenyUrlFromStored } from "@/lib/geny";
import { todayParisISO } from "@/lib/paris-date";
import {
  parseRapportsPMU,
  parseCommentaire,
  type RapportsPMU,
} from "@/lib/sync/geny-rapports-parser";

export interface GenyArriveesResult {
  ok:        true;
  date:      string;
  scraped:   number;
  upserted:  number;
  skipped:   number;          // courses sans geny_url
  not_found: number;          // page Geny vide ou pas d'arrivée encore
}

const USER_AGENT  = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 8000;
const CONCURRENCY = 4;

function extractNums(str: string): number[] {
  return str.split(/[\s\-,\.\/|]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 99);
}

/**
 * Limite max d'une arrivée scrapée. PMU utilise jusqu'à 7 chevaux pour le
 * Quinté+ Bonus 4 (5 du Quinté + 6e + 7e bonus). Geny affiche souvent 8
 * chevaux (les Dai exclus). On stocke jusqu'à 10 pour être large, l'affichage
 * front choisira combien afficher selon le type de pari.
 */
const MAX_HORSES = 10;

/**
 * Construit le predicate de validité d'un numéro de cheval.
 *
 * Si `validNumbers` est fourni (depuis la table `partants` de la DB) → on
 * filtre strictement contre cette liste (élimine 100% des faux positifs :
 * sidebars, rapports €, IDs HTML, etc.).
 *
 * Sinon → fallback heuristique : numéro doit être entre 1 et 20 (plage
 * typique des partants PMU). Moins fiable mais utilisable hors contexte DB.
 */
function buildIsValidNum(validNumbers?: number[]): (n: number) => boolean {
  if (validNumbers && validNumbers.length > 0) {
    const set = new Set(validNumbers);
    return (n: number) => set.has(n);
  }
  return (n: number) => n >= 1 && n <= 20;
}

/**
 * Limite la section au PREMIER marqueur de fin d'arrivée trouvé. Geny insère
 * souvent les sections suivantes après l'arrivée définitive (Rapports PMU,
 * Commentaires, sidebar avec autres arrivées du jour). On coupe la section
 * à leur premier mot pour éviter d'absorber leur contenu.
 *
 * Marqueurs de fin pris en compte :
 *  - Rapports PMU / officiels (= bloc des rapports €)
 *  - Commentaire d'arrivée
 *  - Arrivée Tiercé/Quarté (= sous-arrivées spéciales)
 *  - Détail des paris / Cotes finales
 *  - "Autres arrivées" / "Course suivante" (= sidebars de navigation)
 *  - HTML structuraux : <aside>, <nav>, <footer> (= éléments hors-contenu)
 */
function trimToArriveeOnly(section: string): string {
  const stopRe = /Rapports?\s*PMU|Rapports?\s*officiels|Commentaire\s*d['']?arriv|Arriv[eé]e\s*(?:Tierc[eé]|Quart[eé])|D[eé]tail\s*des\s*paris|Cotes\s*finales|Autres\s*arriv[eé]es?|Course\s*suivante|<aside\b|<nav\b|<footer\b/i;
  const m = section.match(stopRe);
  if (m && m.index != null && m.index > 0) {
    return section.slice(0, m.index);
  }
  return section;
}

/**
 * Pre-traitement HTML pour éliminer les artefacts qui polluent l'extraction
 * de numéros :
 *  - Labels de position : "1er", "2e", "3ème" (suffixes ordinaux)
 *  - Décimaux : "1.50", "12,80" (rapports € formatés)
 *  - Montants en € : "100 €", "1234€"
 */
function stripArtifacts(text: string): string {
  return text
    .replace(/\b\d+(?:er|ère|e|ème|ième)\b/gi, "")  // 1er, 2e, 3ème
    .replace(/\b\d+[.,]\d+\b/g, "")                 // 1.50, 12,80
    .replace(/\d+\s*€/g, "");                       // 100€, 1234 €
}

/**
 * Extrait les numéros d'arrivée en parcourant le texte SÉQUENTIELLEMENT et
 * en gardant uniquement les numéros présents dans `validNumbers`. L'ordre
 * d'apparition dans le HTML est l'ordre d'arrivée (1er, 2e, 3e, ...).
 *
 * **Pourquoi cette approche est robuste** :
 *  - Quel que soit le format HTML (table, span, dash-separated, mixed),
 *    on extrait CHAQUE numéro entier indépendamment.
 *  - Le filtre validNumbers élimine TOUS les faux positifs (sidebars,
 *    rapports, IDs, dates, etc.) qui ne sont pas des partants de la course.
 *  - Le dédoublonnage préserve l'ordre (premier apparition gagne).
 */
function extractNumbersInOrder(
  text: string,
  isValid: (n: number) => boolean,
): number[] {
  const found: number[] = [];
  const seen = new Set<number>();
  const re = /\b(\d{1,2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (!isValid(n)) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    found.push(n);
    if (found.length >= MAX_HORSES) break;
  }
  return found;
}

/**
 * Parse le tableau structuré Geny `<table id="arrivees">`.
 *
 * Format observé sur Geny.com (vérifié 2026-05-08) :
 *   <table id="arrivees">
 *     <tr>headers</tr>
 *     <tr>
 *       <td>1</td>          <!-- POSITION (1er) — ignorer -->
 *       <td>8</td>           <!-- NUMÉRO CHEVAL ← garder -->
 *       <td>Rougegarde</td>  <!-- nom -->
 *       ...
 *     </tr>
 *     ...
 *   </table>
 *
 * Stratégie : trouver le tableau, parser chaque <tr> de données, extraire
 * la 2ème <td> qui contient le numéro de cheval. C'est bulletproof car
 * indépendant des artefacts HTML alentour (height="18", strong 1er, etc.).
 */
function parseArriveeTable(html: string, isValid: (n: number) => boolean): number[] | null {
  // ⚠️ Pré-traitement : Geny imbrique depuis 2026 des sous-tables
  // <table class="table-oei">…</table> dans la cellule "Cheval" pour afficher
  // les icônes (œillères, attache-langue, etc.). Cette imbrication casse le
  // regex <table>...</table> non-greedy qui se ferme à la première sous-table.
  // On retire donc TOUTES les tables imbriquées avant de chercher la principale.
  const flatHtml = html.replace(
    /<table\b[^>]*class=["'][^"']*table-oei[^"']*["'][^>]*>[\s\S]*?<\/table>/gi,
    "",
  );

  // Cherche le tableau d'arrivée principal. Geny utilise id="arrivees".
  const tableMatch = flatHtml.match(/<table[^>]*id=["']arrivees["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return null;

  const tableContent = tableMatch[1];
  // Chaque ligne <tr>...</tr>
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const horses: number[] = [];
  const seen = new Set<number>();
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(tableContent)) !== null) {
    const rowContent = rowMatch[1];
    // Extrait toutes les <td>...</td> de la ligne
    const cellRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowContent)) !== null) {
      cells.push(cellMatch[1]);
    }

    // Skip les lignes header (pas de cellules data, ou avec class="enteteColonne")
    if (cells.length < 2) continue;
    if (/enteteColonne|<th\b/i.test(rowContent)) continue;

    // La 2ème cellule contient le numéro de cheval. On extrait le 1er nombre
    // 1-2 chiffres trouvé (souvent entouré d'espaces et tags).
    const horseCell = cells[1];
    const numMatch = horseCell.match(/(?:^|>)\s*(\d{1,2})\s*(?:<|$)/);
    if (!numMatch) continue;

    const num = parseInt(numMatch[1], 10);
    if (!isValid(num)) continue;
    if (seen.has(num)) continue;

    seen.add(num);
    horses.push(num);
    if (horses.length >= MAX_HORSES) break;
  }

  return horses.length >= 3 ? horses : null;
}

/**
 * Parse l'arrivée d'une course depuis le HTML d'une page Geny.com de type
 * /arrivee-et-rapports-pmu?id_course=X.
 *
 * @param html         HTML brut de la page Geny
 * @param validNumbers Liste des numéros valides (= partants de la course
 *                     depuis la DB). Si fournie, garantit une extraction
 *                     bulletproof (rejette tout numéro non-partant).
 *                     Si absente, fallback sur heuristique 1-20.
 *
 * Stratégie en cascade :
 *  1. **Tableau structuré** `<table id="arrivees">` (le plus fiable)
 *  2. Section "Arrivée définitive/officielle/complète" + extraction filtrée
 *  3. data-attribute "data-arrivee" structuré
 *  4. Fallback global : plus longue séquence valide du HTML entier
 */
export function parseArrivee(
  html: string,
  validNumbers?: number[],
): number[] | null {
  const isValid = buildIsValidNum(validNumbers);

  // ── Stratégie 1 (priorité absolue) : tableau structuré Geny ─────────────
  // <table id="arrivees"> avec position en col 1, numéro cheval en col 2.
  // C'est le marqueur Geny stable et le plus fiable. Élimine tous les bruits
  // (attributs HTML height, strong 1er, cotes 15/1, temps 1'39'08).
  const fromTable = parseArriveeTable(html, isValid);
  if (fromTable) return fromTable;

  // ── Stratégie 2 : sections "Arrivée définitive/officielle" ──────────────
  // Fallback si Geny change la classe id="arrivees". On capture la section,
  // on la coupe au premier marqueur de fin, strip les artefacts, et on
  // extrait les numéros valides séquentiellement.
  const sectionPatterns: RegExp[] = [
    /[Aa]rriv[eé]e\s*d[eé]finitive[\s\S]{0,3000}/,
    /[Aa]rriv[eé]e\s*officielle[\s\S]{0,3000}/,
    /[Aa]rriv[eé]e\s*compl[eè]te[\s\S]{0,3000}/,
  ];

  for (const sectionRe of sectionPatterns) {
    const sectionMatch = html.match(sectionRe);
    if (!sectionMatch) continue;
    const trimmed = trimToArriveeOnly(sectionMatch[0]);
    const cleaned = stripArtifacts(trimmed);
    const found = extractNumbersInOrder(cleaned, isValid);
    if (found.length >= 3) {
      return found.slice(0, MAX_HORSES);
    }
  }

  // ── Stratégie 3 : data-attributes structurés ────────────────────────────
  const dataMatch = html.match(/data-(?:arrivee|ordre|result)[^=]*=["']([\d\s,\-–]+)["']/i);
  if (dataMatch) {
    const nums = dataMatch[1]
      .split(/[\s\-–,]+/)
      .map(Number)
      .filter((n) => Number.isInteger(n) && isValid(n));
    const seen = new Set<number>();
    const ordered = nums.filter((n) => {
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
    if (ordered.length >= 3) return ordered.slice(0, MAX_HORSES);
  }

  // ── Stratégie 4 (fallback global) : recherche dans le HTML entier ───────
  const cleanedHtml = stripArtifacts(html);
  const fallback = extractNumbersInOrder(cleanedHtml, isValid);
  if (fallback.length >= 3) {
    return fallback.slice(0, MAX_HORSES);
  }

  return null;
}

interface CourseRow {
  id:             string;
  numero_reunion: number;
  numero_course:  number;
  geny_url:       string | null;
  /**
   * Liste des numéros des partants de cette course (depuis la DB). Permet au
   * parser d'arrivée de filtrer les faux positifs (sidebars, rapports, IDs
   * HTML, etc.) en ne gardant que les numéros qui correspondent réellement
   * à un partant.
   */
  validNumbers?: number[];
}

interface FetchedArrivee {
  arrivee:     number[];
  rapports:    RapportsPMU | null;
  commentaire: string | null;
}

async function fetchArriveeForCourse(course: CourseRow): Promise<FetchedArrivee | null> {
  if (!course.geny_url) return null;

  // Transforme /partants-pmu/... en /resultats-pmu/...
  const url = buildGenyUrlFromStored(course.geny_url, "resultats");

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        "User-Agent":      USER_AGENT,
        "Accept":          "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Referer":         "https://www.geny.com/",
      },
      cache:  "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const html = await res.text();

    const arrivee = parseArrivee(html, course.validNumbers);
    if (!arrivee) return null;

    // Bonus : rapports PMU complets + commentaire d'arrivée (best-effort)
    let rapports: RapportsPMU | null = null;
    let commentaire: string | null = null;
    try {
      const r = parseRapportsPMU(html);
      // Considère "non vide" si au moins une clé existe
      if (r && Object.keys(r).length > 0) rapports = r;
    } catch {
      // Parser défensif : on ne casse pas la sync si parsing rapports échoue
    }
    try {
      commentaire = parseCommentaire(html);
    } catch {
      // idem
    }

    return { arrivee, rapports, commentaire };
  } catch {
    return null;
  }
}

/** Limite la concurrence à `n` workers. */
async function processInPool<T, R>(
  items: T[],
  workerCount: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function next(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, () => next()));
  return results;
}

export async function runGenyArriveesSync(dateISO?: string): Promise<GenyArriveesResult> {
  // Default = "aujourd'hui Paris" (pas UTC) — sinon entre minuit-2h Paris on
  // chercherait les arrivées de la veille au lieu du jour actuel.
  const date = dateISO || todayParisISO();
  const supabase = createServiceClient();

  // JOIN partants pour passer leurs numéros au parser → garantit zéro faux
  // positif (sidebar, rapports €, IDs HTML rejetés automatiquement).
  const { data: rawCourses } = await supabase
    .from("courses")
    .select("id, numero_reunion, numero_course, geny_url, partants(numero)")
    .eq("date_course", date)
    .is("arrivee_officielle", null);

  if (!rawCourses?.length) {
    return { ok: true, date, scraped: 0, upserted: 0, skipped: 0, not_found: 0 };
  }

  // Mappe chaque course avec sa liste de numéros valides (partants)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const courses: CourseRow[] = (rawCourses as any[]).map((c) => ({
    id:             c.id,
    numero_reunion: c.numero_reunion,
    numero_course:  c.numero_course,
    geny_url:       c.geny_url,
    validNumbers:   Array.isArray(c.partants)
      ? c.partants.map((p: { numero: number }) => p.numero).filter((n: number) => Number.isInteger(n))
      : undefined,
  }));

  // Dédupliquer par (R, C) au cas où
  const seen = new Set<string>();
  const unique = courses.filter((c) => {
    const key = `${c.numero_reunion}-${c.numero_course}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Skipper celles sans geny_url (LONACI Afrique sans équivalent Geny)
  const withGeny    = unique.filter((c) => !!c.geny_url);
  const withoutGeny = unique.length - withGeny.length;

  console.log(`[geny-arrivees] ${unique.length} courses (avec geny_url: ${withGeny.length}, sans: ${withoutGeny})`);

  // Scraper en parallèle (4 workers)
  const scraped = await processInPool(withGeny, CONCURRENCY, async (course) => {
    const data = await fetchArriveeForCourse(course);
    return data ? { courseId: course.id, ...data } : null;
  });

  const valid = scraped.filter(
    (s): s is { courseId: string } & FetchedArrivee => s !== null,
  );

  // Upsert dans courses (arrivee_officielle + statut TERMINE)
  if (valid.length > 0) {
    const courseUpdates = valid.map(({ courseId, arrivee }) => ({
      id:                 courseId,
      arrivee_officielle: arrivee,
      statut:             "TERMINE",
    }));
    await supabase.from("courses").upsert(courseUpdates);

    // Upsert dans table arrivees (best-effort, table optionnelle)
    // Inclut désormais rapports_pmu (JSONB) + commentaire (TEXT)
    const arriveesRows = valid.map(({ courseId, arrivee, rapports, commentaire }) => ({
      course_id:     courseId,
      ordre_arrivee: arrivee,
      rapports_pmu: rapports ?? null,
      commentaire:  commentaire ?? null,
      horodatage:    new Date().toISOString(),
    }));
    try {
      await supabase.from("arrivees").upsert(arriveesRows, { onConflict: "course_id" });
    } catch {
      // Table arrivees absente — silencieux
    }

    const withRapports = valid.filter((v) => v.rapports !== null).length;
    console.log(
      `[geny-arrivees] upserted ${valid.length} arrivées (rapports PMU: ${withRapports})`,
    );
  }

  return {
    ok:        true,
    date,
    scraped:   valid.length,
    upserted:  valid.length,
    skipped:   withoutGeny,
    not_found: withGeny.length - valid.length,
  };
}
