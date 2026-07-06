/**
 * lib/sync/genybet-programme.ts
 *
 * Source PROGRAMME via GenyBet (www.genybet.fr) — site betting sœur de Geny,
 * MÊMES données que Geny.com mais sur un domaine NON bloqué (Geny.com renvoie
 * 429 aux IP Worker CF + Azure GitHub Actions ; genybet.fr = 200, vérifié
 * résidentiel + Azure le 2026-07-06).
 *
 * Rôle : DERNIER filet de la chaîne programme (après LONACI). LONACI ne relaie
 * que le JOUR courant → le J+1 (aperçu du lendemain la veille) était un écran
 * noir quand Geny+PMU bloquaient. GenyBet sert le programme PAR DATE, J+1
 * inclus : `https://www.genybet.fr/reunions/JJ-MM-AAAA`.
 *
 * Parse HTML pur (pas d'API JSON exposée) → réutilise `upsertProgrammeCourses`.
 * PUR (client Supabase sans next/headers via l'upsert partagé) → bundlable Node.
 *
 * Périmètre : France + Maroc (comme la voie Geny primaire qu'il remplace).
 * Vedette : GenyBet est bookmaker (pas de type de pari PMU natif) → la réunion
 * Quinté est repérée par la présence du lien « 100% Quinté » (centpourcent-quinte,
 * exactement 1 réunion/jour), et la course vedette est estimée = plus gros
 * peloton de cette réunion (heuristique aperçu, corrigée exactement par LONACI
 * le jour J via augmentParisFromNationale).
 */
import { upsertProgrammeCourses, type ProgrammeCourse } from "./programme-upsert";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// Paris marqués sur la course vedette (Quinté+) pour que pickCourseVedette la
// détecte ; paris génériques ailleurs. (GenyBet n'expose pas les types PMU.)
const QUINTE_PARIS  = ["QUINTE_PLUS", "QUARTE_PLUS", "TIERCE", "COUPLE_GAGNANT", "COUPLE_PLACE", "TRIO"];
const DEFAULT_PARIS = ["SIMPLE_GAGNANT", "SIMPLE_PLACE"];

function decodeEntities(str: string): string {
  return str
    .replace(/&#0*39;/g, "'")
    .replace(/&#0*34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Apostrophe typographique -> droite : evite les doublons d'hippodromes
    // (« Les Sables-d'Olonne » variantes) lors du matching upsert.
    .replace(/’/g, "'");
}

/** Discipline GenyBet (classe icon-race) -> categorie course. */
function disciplineToCategorie(iconClass: string): "PLAT" | "TROT" | "OBSTACLE" {
  const c = iconClass.toLowerCase();
  if (c.includes("trot")) return "TROT";
  if (c.includes("haie") || c.includes("obstacle") || c.includes("steeple") || c.includes("cross")) return "OBSTACLE";
  return "PLAT";
}

interface ReunionHeader { pays: string; hippo: string; }

/**
 * Extrait les en-tetes de reunion pour la DATE AFFICHEE : R{n} -> { pays (title
 * du drapeau), hippodrome }. Source = le titre `<h3>` de chaque reunion :
 *   <h3> <span class="flag flag-fr" title="France"></span>
 *        <span class="vb">R1 - Chantilly</span> </h3>
 *
 * ⚠️ NE PAS utiliser le menu lateral `meeting-name-link` : il liste TOUJOURS le
 * jour courant, meme sur la page J+1 (verifie : liens `/reunions/06-07-2026#R…`
 * sur la page du 07/07) -> il donnerait l'hippodrome d'AUJOURD'HUI pour le J+1.
 * Le `<span class="vb">` reflete bien la date consultee.
 */
export function parseReunionHeaders(html: string): Map<number, ReunionHeader> {
  const map = new Map<number, ReunionHeader>();
  const re = /<h3[^>]*>[\s\S]{0,400}?flag flag-\w+"\s+title="([^"]+)"[\s\S]{0,300}?<span class="vb">R(\d+)\s*-\s*([^<]+?)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const num = parseInt(m[2], 10);
    if (!map.has(num)) {
      map.set(num, { pays: decodeEntities(m[1]).trim(), hippo: decodeEntities(m[3]).trim() });
    }
  }
  return map;
}

/**
 * Parse la page programme GenyBet (`/reunions/JJ-MM-AAAA`) -> courses France/Maroc.
 * PURE (testable sur fixture). Ne throw jamais sur une reunion/ligne malformee
 * (elle est simplement ignoree).
 */
export function parseGenybetReunions(html: string, dateISO: string): ProgrammeCourse[] {
  const headers = parseReunionHeaders(html);
  const out: ProgrammeCourse[] = [];

  // Decoupe par conteneur de reunion (le vrai tableau programme, pas le widget
  // « prochaines courses » partage sur toutes les pages).
  const parts = html.split(/id="reunion-(\d+)"/i);
  for (let i = 1; i < parts.length; i += 2) {
    const reunionNum = parseInt(parts[i], 10);
    const block = parts[i + 1] || "";
    const header = headers.get(reunionNum);
    if (!header) continue;
    // Perimetre France + Maroc (identique a la voie Geny primaire).
    if (header.pays !== "France" && header.pays !== "Maroc") continue;

    // Reunion Quinte = celle qui a le lien « 100% Quinte » (1 seule par jour).
    const isQuinteReunion = /centpourcent-quinte\//i.test(block);

    // Corps du tableau principal uniquement.
    const tbodyM = block.match(/<tbody class="table-body">([\s\S]*?)<\/tbody>/i);
    if (!tbodyM) continue;
    const rows = tbodyM[1].split(/<tr\b/i).slice(1);

    const reunionCourses: ProgrammeCourse[] = [];
    for (const row of rows) {
      const numM = row.match(/<th[^>]*scope="row"[^>]*>\s*(\d+)\s*<\/th>/i);
      if (!numM) continue;
      const courseNum = parseInt(numM[1], 10);

      const libM = row.match(/race-name[\s\S]*?<a[^>]*>\s*([^<][\s\S]*?)\s*<\/a>/i);
      const libelle = libM ? decodeEntities(libM[1].replace(/\s+/g, " ")).trim() : `Course ${courseNum}`;

      const discM = row.match(/icon-race\s+([a-z-]+)/i);
      const categorie = disciplineToCategorie(discM ? discM[1] : "");

      // Heure + partants = 2 <td> juste apres la colonne discipline.
      const hpM = row.match(
        /class="discipline">[\s\S]*?<\/td>\s*<td[^>]*>\s*(\d{1,2})[:h](\d{2})\s*<\/td>\s*<td[^>]*>\s*(\d+)\s*<\/td>/i,
      );
      const heureDepart = hpM ? `${hpM[1].padStart(2, "0")}:${hpM[2]}:00` : "12:00:00";
      const nbPartants = hpM ? parseInt(hpM[3], 10) : 0;

      reunionCourses.push({
        hippodromeName:   header.hippo,
        hippodromePays:   header.pays,
        dateCourse:       dateISO,
        heureDepart,
        numeroReunion:    reunionNum,
        numeroCourse:     courseNum,
        libelle,
        distanceMetres:   0, // pas de colonne distance sur GenyBet (enrichie ailleurs)
        categorie,
        nbPartants,
        parisDisponibles: DEFAULT_PARIS,
      });
    }

    // Vedette : sur la reunion Quinte, la course au plus gros peloton recoit
    // QUINTE_PLUS (heuristique apercu J+1 ; LONACI corrige exactement le jour J).
    if (isQuinteReunion && reunionCourses.length > 0) {
      let best = reunionCourses[0];
      for (const c of reunionCourses) if (c.nbPartants > best.nbPartants) best = c;
      best.parisDisponibles = QUINTE_PARIS;
    }

    for (const c of reunionCourses) out.push(c);
  }

  return out;
}

// -- Fetch (timeout + retry, defense-in-depth comme la voie Geny) --
const FETCH_TIMEOUT_MS = 12_000;
const FETCH_ATTEMPTS   = 2;
const RETRY_DELAY_MS   = 1_500;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchGenybetHtml(url: string): Promise<string> {
  let lastError = "";
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":      UA,
          "Accept":          "text/html,application/xhtml+xml",
          "Accept-Language": "fr-FR,fr;q=0.9",
          "Referer":         "https://www.genybet.fr/",
        },
        cache:  "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) return await res.text();
      lastError = `GenyBet HTTP ${res.status} pour ${url}`;
      if (res.status < 500 && res.status !== 429) throw new Error(lastError);
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.message.startsWith("GenyBet HTTP 4")) throw err;
      lastError = err instanceof Error && err.name === "AbortError"
        ? `GenyBet timeout apres ${FETCH_TIMEOUT_MS}ms pour ${url}`
        : err instanceof Error ? err.message : String(err);
    }
    if (attempt < FETCH_ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }
  throw new Error(`GenyBet fetch echoue (${FETCH_ATTEMPTS} tentatives) : ${lastError}`);
}

/** "YYYY-MM-DD" -> "JJ-MM-AAAA" (format d'URL GenyBet). */
export function toGenybetDate(dateISO: string): string {
  const [y, m, d] = dateISO.split("-");
  return `${d}-${m}-${y}`;
}

export interface GenybetProgrammeResult {
  courses:     number;
  inserted:    number;
  updated:     number;
  reunions:    number;
  hippodromes: number;
  filteredOut: number;
}

/**
 * Fetch + parse + upsert du programme GenyBet pour une date.
 * @param dateISO "YYYY-MM-DD" (jour courant OU J+1 OU passe)
 */
export async function runGenybetProgrammeSync(dateISO: string): Promise<GenybetProgrammeResult> {
  const url = `https://www.genybet.fr/reunions/${toGenybetDate(dateISO)}`;
  const html = await fetchGenybetHtml(url);
  const courses = parseGenybetReunions(html, dateISO);

  const result = await upsertProgrammeCourses(courses);
  const reunions = new Set(courses.map((c) => `${c.hippodromeName}|${c.numeroReunion}`)).size;

  return {
    courses:     courses.length,
    inserted:    result.inserted,
    updated:     result.updated,
    reunions,
    hippodromes: result.hippodromes,
    filteredOut: 0,
  };
}
