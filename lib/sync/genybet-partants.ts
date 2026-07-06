/**
 * lib/sync/genybet-partants.ts
 *
 * Enrichissement des CHAMPS DE FORME des partants via GenyBet (musique, âge,
 * sexe, poids, corde, jockey, entraîneur) — les données que LONACI n'a PAS.
 *
 * ⚠️ Les COTES GenyBet sont chargées en JavaScript/WebSocket (absentes du HTML
 * server-rendered, vérifié 2026-07-06) → NON scrapables. GenyBet ne remplace
 * donc pas les cotes : il complète les partants LONACI (qui portent les cotes)
 * avec la forme. Fusion par numéro côté appelant (geny-enrich-cli).
 *
 * Page course : /courses/partants-pronostics/{id}. Table partants, colonnes :
 *   N° · Cheval · C(orde) · S/A(sexe-âge) · Poids · Jockey · Entraîneur · Val.
 *   · Performances(musique) · Réf. · Live
 *
 * PUR (fetch via genybet-programme) → bundlable Node sur GitHub Actions.
 */
import { fetchGenybetHtml, toGenybetDate } from "./genybet-programme";

/** Champs de forme d'un partant (sous-ensemble GenyParticipant, SANS cote). */
export interface GenybetPartant {
  numPmu:      number;
  nom:         string;
  jockey?:     { nom: string };
  entraineur?: { nom: string };
  musique?:    string;
  poids?:      number;
  age?:        number;
  sexe?:       string;
  placeCorde?: number;
  nonPartant:  boolean;
}

function decode(str: string): string {
  return str
    .replace(/&#0*39;/g, "'").replace(/&#0*34;/g, '"')
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/’/g, "'");
}

/** Retire les balises, décode les entités, normalise les espaces. */
function cellText(html: string): string {
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Parse la table partants d'une page course GenyBet → champs de forme.
 * PURE (testable). Ne throw jamais ; ligne malformée ignorée.
 */
export function parseGenybetPartants(html: string): GenybetPartant[] {
  const out: GenybetPartant[] = [];
  const tbodyM = html.match(/<tbody[^>]*class="[^"]*table-body[^"]*"[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyM) return out;

  // Défensif : retire d'éventuelles sous-tables imbriquées (icônes) qui
  // casseraient le découpage des cellules.
  const body = tbodyM[1].replace(/<table\b[\s\S]*?<\/table>/gi, "");
  const rows = body.split(/<tr\b/i).slice(1);

  for (const row of rows) {
    const cells = Array.from(row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)).map((m) => m[1]);
    if (cells.length < 7) continue;

    const numPmu = parseInt(cellText(cells[0]), 10);
    const nom = cellText(cells[1]);
    if (!Number.isFinite(numPmu) || !nom) continue;

    const corde = parseInt(cellText(cells[2]), 10);
    const sa = cellText(cells[3]).match(/([A-Za-z])\s*(\d+)/); // "M2" → M, 2
    const poids = parseFloat(cellText(cells[4]).replace(",", "."));
    const jockey = cellText(cells[5]);
    const entraineur = cellText(cells[6]);
    const musique = cells.length > 8 ? cellText(cells[8]) : "";

    out.push({
      numPmu,
      nom,
      jockey:      jockey ? { nom: jockey } : undefined,
      entraineur:  entraineur ? { nom: entraineur } : undefined,
      musique:     musique || undefined,
      poids:       Number.isFinite(poids) && poids > 0 ? poids : undefined,
      age:         sa ? parseInt(sa[2], 10) : undefined,
      sexe:        sa ? sa[1].toUpperCase() : undefined,
      placeCorde:  Number.isFinite(corde) ? corde : undefined,
      nonPartant:  /non[- ]?partant/i.test(row),
    });
  }

  return out;
}

/**
 * Mappe `${reunion}|${course}` → ID de course GenyBet, depuis la page programme.
 * Nécessaire pour construire l'URL des pages course (l'ID = même que PMU/Geny).
 */
export function parseGenybetCourseIds(html: string): Map<string, number> {
  const map = new Map<string, number>();
  const parts = html.split(/id="reunion-(\d+)"/i);
  for (let i = 1; i < parts.length; i += 2) {
    const reunionNum = parseInt(parts[i], 10);
    const block = parts[i + 1] || "";
    const tbodyM = block.match(/<tbody class="table-body">([\s\S]*?)<\/tbody>/i);
    if (!tbodyM) continue;
    for (const row of tbodyM[1].split(/<tr\b/i).slice(1)) {
      const numM = row.match(/<th[^>]*scope="row"[^>]*>\s*(\d+)\s*<\/th>/i);
      const idM = row.match(/\/courses\/(?:partants-pronostics|resultats)\/(\d+)/i);
      if (numM && idM) map.set(`${reunionNum}|${parseInt(numM[1], 10)}`, parseInt(idM[1], 10));
    }
  }
  return map;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Récupère les champs de forme GenyBet des courses voulues → map
 * `${reunion}|${course}` → partants. 1 fetch (page programme, pour les IDs) +
 * 1 fetch par course voulue. Ne throw jamais (map vide/partielle si KO).
 * @param dateISO "YYYY-MM-DD"
 * @param wanted  clés `${reunion}|${course}` à récupérer (limite les fetches)
 */
export async function fetchGenybetPartantsMap(
  dateISO: string,
  wanted?: Set<string>,
): Promise<Map<string, GenybetPartant[]>> {
  const out = new Map<string, GenybetPartant[]>();

  let idMap: Map<string, number>;
  try {
    const html = await fetchGenybetHtml(`https://www.genybet.fr/reunions/${toGenybetDate(dateISO)}`);
    idMap = parseGenybetCourseIds(html);
  } catch {
    return out;
  }

  // tsconfig sans `target` → pas d'itération directe de Map ; on passe par les clés.
  for (const key of Array.from(idMap.keys())) {
    if (wanted && !wanted.has(key)) continue;
    const courseId = idMap.get(key)!;
    try {
      const html = await fetchGenybetHtml(`https://www.genybet.fr/courses/partants-pronostics/${courseId}`);
      const partants = parseGenybetPartants(html);
      if (partants.length > 0) out.set(key, partants);
    } catch {
      // course KO → on continue (enrichissement best-effort)
    }
    await sleep(300); // pacing poli entre pages course
  }

  return out;
}
