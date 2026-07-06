/**
 * lib/sync/genybet-arrivees.ts
 *
 * Fallback ARRIVÉES (ordre d'arrivée) via GenyBet, quand Geny.com bloque (429).
 * Depuis le blocage Geny + programmes chargés par LONACI/GenyBet (sans geny_url),
 * `runGenyArriveesSync` ne pouvait plus scraper aucune arrivée → « plus d'arrivée ».
 *
 * La page programme GenyBet (`/reunions/JJ-MM-AAAA`) affiche déjà, pour chaque
 * course COURUE, l'ordre d'arrivée dans la colonne Résultats :
 *   <a href="/courses/resultats/1665355"><span>4-2-7-8-3</span></a>
 * → 1 SEUL fetch ramène l'ordre de toutes les courses du jour, mappé par
 * (réunion, course). Restaure le podium (les rapports PMU sont un enrichissement
 * ultérieur, sur la page résultats détaillée).
 *
 * PUR (fetch global via genybet-programme) → bundlable Node sur GitHub Actions.
 */
import { fetchGenybetHtml, toGenybetDate } from "./genybet-programme";

/**
 * Parse la page programme GenyBet -> map `${reunion}|${course}` -> ordre d'arrivée
 * (numéros de chevaux, vainqueur en tête). PURE (testable sur fixture). Ne garde
 * que les courses ayant un ordre d'au moins 3 chevaux (course réellement courue).
 */
export function parseGenybetArrivees(html: string): Map<string, number[]> {
  const map = new Map<string, number[]>();

  const parts = html.split(/id="reunion-(\d+)"/i);
  for (let i = 1; i < parts.length; i += 2) {
    const reunionNum = parseInt(parts[i], 10);
    const block = parts[i + 1] || "";

    const tbodyM = block.match(/<tbody class="table-body">([\s\S]*?)<\/tbody>/i);
    if (!tbodyM) continue;
    const rows = tbodyM[1].split(/<tr\b/i).slice(1);

    for (const row of rows) {
      const numM = row.match(/<th[^>]*scope="row"[^>]*>\s*(\d+)\s*<\/th>/i);
      if (!numM) continue;
      const courseNum = parseInt(numM[1], 10);

      // Colonne Résultats : /courses/resultats/{id}"> <span>4-2-7-8-3</span>
      const ordM = row.match(/\/courses\/resultats\/\d+">\s*<span>([\d\s-]+)<\/span>/i);
      if (!ordM) continue;

      const order = ordM[1]
        .split("-")
        .map((n) => parseInt(n.trim(), 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 99);

      // Dédoublonne en préservant l'ordre (au cas où).
      const seen = new Set<number>();
      const clean: number[] = [];
      for (const n of order) {
        if (seen.has(n)) continue;
        seen.add(n);
        clean.push(n);
      }
      if (clean.length >= 3) map.set(`${reunionNum}|${courseNum}`, clean);
    }
  }

  return map;
}

/**
 * Récupère les arrivées GenyBet d'une date -> map `${reunion}|${course}` -> ordre.
 * 1 seul fetch (la page programme). Ne throw jamais (map vide si KO).
 * @param dateISO "YYYY-MM-DD"
 */
export async function fetchGenybetArriveesMap(dateISO: string): Promise<Map<string, number[]>> {
  try {
    const html = await fetchGenybetHtml(`https://www.genybet.fr/reunions/${toGenybetDate(dateISO)}`);
    return parseGenybetArrivees(html);
  } catch {
    return new Map();
  }
}
