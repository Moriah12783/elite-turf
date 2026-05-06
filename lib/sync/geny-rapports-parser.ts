/**
 * lib/sync/geny-rapports-parser.ts
 *
 * Parser HTML pour extraire les rapports PMU complets depuis une page
 * /resultats-pmu/... de Geny. Volontairement défensif : multi-patterns
 * pour résister aux variations de templating Geny (galop / trot / obstacle).
 *
 * Stratégie :
 *  - On normalise d'abord le HTML (whitespace, entités).
 *  - On essaye plusieurs regex par type de pari (tableaux structurés ou
 *    notation inline "Tiercé : 45,00€ / 12,00€").
 *  - Si aucun pattern ne match, le champ retourne undefined (pas null) →
 *    sera omis du JSON final.
 *
 * Note : on stocke les rapports comme NUMBERS en EUR (45.00 = 45 €) et non
 * en centimes — c'est plus lisible pour l'affichage front et les sommes
 * stat. La précision .toFixed(2) est gardée à l'affichage.
 */

export interface RapportsPMU {
  tierce?:           { ordre?: number; desordre?: number };
  quarte_plus?:      { ordre?: number; desordre?: number; bonus?: number };
  quinte_plus?:      { ordre?: number; desordre?: number; bonus4?: number; bonus3?: number };
  couple_gagnant?:   number;
  couple_place?:     number[];      // [1-2, 1-3, 2-3]
  trio?:             number;
  simple_gagnant?:   number;
  simple_place?:     number[];      // [1er, 2e, 3e]
  deux_sur_quatre?:  number;
  multi?:            { en_4?: number; en_5?: number; en_6?: number; en_7?: number };
}

/**
 * Convertit "1 234,56" ou "1.234,56" ou "45.00" → 1234.56
 * Retourne null si parsing échoue ou valeur incohérente.
 */
function parseEuroAmount(s: string | undefined): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[\s ]/g, "").replace(/€|EUR/gi, "");
  // Format français "1234,56" → "1234.56"
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const n = parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0 || n > 9_999_999) return null;
  return Math.round(n * 100) / 100;
}

/** Cherche un montant € à proximité d'un label. Renvoie le 1er match. */
function findAmountAfter(html: string, labelPattern: RegExp): number | null {
  const labelRe = new RegExp(
    labelPattern.source + `[^\\d€]{0,200}?([\\d\\s.,]+)\\s*(?:€|EUR)?`,
    "i" + (labelPattern.flags.includes("u") ? "u" : ""),
  );
  const m = html.match(labelRe);
  if (!m) return null;
  return parseEuroAmount(m[1]);
}

/** Cherche un duo de montants après un label (ordre, désordre). */
function findOrdreEtDesordre(html: string, label: string): { ordre?: number; desordre?: number } | undefined {
  // Pattern : <Label> ... <ordre> ... <désordre>
  const labelRe = new RegExp(label + "[^<]{0,50}", "i");
  const m = html.match(labelRe);
  if (!m) return undefined;

  const startIdx = (m.index ?? 0) + m[0].length;
  const slice = html.slice(startIdx, startIdx + 2000);

  // 2 montants successifs dans la fenêtre
  const amounts = Array.from(slice.matchAll(/([\d]+(?:[.,]\d+)?)\s*€/g))
    .map((m) => parseEuroAmount(m[1]))
    .filter((n): n is number => n !== null);

  if (amounts.length === 0) return undefined;
  return {
    ordre:    amounts[0],
    desordre: amounts[1],
  };
}

/** Extrait une liste de N montants après un label. */
function findAmountsAfter(html: string, labelPattern: RegExp, count = 3): number[] | undefined {
  const m = html.match(labelPattern);
  if (!m) return undefined;
  const startIdx = (m.index ?? 0) + m[0].length;
  const slice = html.slice(startIdx, startIdx + 800);
  const amounts = Array.from(slice.matchAll(/([\d]+(?:[.,]\d+)?)\s*€/g))
    .map((m) => parseEuroAmount(m[1]))
    .filter((n): n is number => n !== null);
  if (amounts.length === 0) return undefined;
  return amounts.slice(0, count);
}

/** Strip basique des tags HTML pour les patterns text-only. */
function stripTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&euro;/g, "€")
    .replace(/&#8364;/g, "€")
    .replace(/\s+/g, " ");
}

/** Point d'entrée : parse les rapports depuis le HTML brut Geny. */
export function parseRapportsPMU(html: string): RapportsPMU {
  const result: RapportsPMU = {};
  const text = stripTags(html);

  // ── Tiercé ──────────────────────────────────────────────────────
  const tierce = findOrdreEtDesordre(text, "Tierc[ée]\\+?");
  if (tierce && (tierce.ordre || tierce.desordre)) result.tierce = tierce;

  // ── Quarté+ ─────────────────────────────────────────────────────
  // 3 montants : ordre, désordre, bonus
  const quarteMatch = text.match(/Quart[ée]\s*\+/i);
  if (quarteMatch) {
    const startIdx = (quarteMatch.index ?? 0) + quarteMatch[0].length;
    const slice = text.slice(startIdx, startIdx + 1000);
    const amounts = Array.from(slice.matchAll(/([\d]+(?:[.,]\d+)?)\s*€/g))
      .map((m) => parseEuroAmount(m[1]))
      .filter((n): n is number => n !== null);
    if (amounts.length > 0) {
      result.quarte_plus = {
        ordre:    amounts[0],
        desordre: amounts[1],
        bonus:    amounts[2],
      };
    }
  }

  // ── Quinté+ ─────────────────────────────────────────────────────
  // 4 montants potentiels : ordre, désordre, bonus 4, bonus 3
  const quinteMatch = text.match(/Quint[ée]\s*\+/i);
  if (quinteMatch) {
    const startIdx = (quinteMatch.index ?? 0) + quinteMatch[0].length;
    const slice = text.slice(startIdx, startIdx + 1500);
    const amounts = Array.from(slice.matchAll(/([\d]+(?:[.,]\d+)?)\s*€/g))
      .map((m) => parseEuroAmount(m[1]))
      .filter((n): n is number => n !== null);
    if (amounts.length > 0) {
      result.quinte_plus = {
        ordre:    amounts[0],
        desordre: amounts[1],
        bonus4:   amounts[2],
        bonus3:   amounts[3],
      };
    }
  }

  // ── Couplé Gagnant (1 montant) ──────────────────────────────────
  const cg = findAmountAfter(text, /Coupl[ée]\s*Gagnant/i);
  if (cg) result.couple_gagnant = cg;

  // ── Couplé Placé (3 montants : 1-2, 1-3, 2-3) ───────────────────
  const cp = findAmountsAfter(text, /Coupl[ée]\s*Plac[ée]/i, 3);
  if (cp && cp.length > 0) result.couple_place = cp;

  // ── Trio (1 montant) ────────────────────────────────────────────
  const trio = findAmountAfter(text, /\bTrio\b/i);
  if (trio) result.trio = trio;

  // ── Simple Gagnant (1 montant) ──────────────────────────────────
  const sg = findAmountAfter(text, /Simple\s*Gagnant/i);
  if (sg) result.simple_gagnant = sg;

  // ── Simple Placé (3 montants : 1er, 2e, 3e) ─────────────────────
  const sp = findAmountsAfter(text, /Simple\s*Plac[ée]/i, 3);
  if (sp && sp.length > 0) result.simple_place = sp;

  // ── 2sur4 (1 montant) ───────────────────────────────────────────
  const ds4 = findAmountAfter(text, /(?:2|Deux)\s*[Ss]ur\s*4/i);
  if (ds4) result.deux_sur_quatre = ds4;

  // ── Multi (4 montants : en 4, 5, 6, 7) ──────────────────────────
  const multiMatch = text.match(/\bMulti\b/i);
  if (multiMatch) {
    const startIdx = (multiMatch.index ?? 0) + multiMatch[0].length;
    const slice = text.slice(startIdx, startIdx + 1500);
    const amounts = Array.from(slice.matchAll(/([\d]+(?:[.,]\d+)?)\s*€/g))
      .map((m) => parseEuroAmount(m[1]))
      .filter((n): n is number => n !== null);
    if (amounts.length >= 1) {
      result.multi = {
        en_4: amounts[0],
        en_5: amounts[1],
        en_6: amounts[2],
        en_7: amounts[3],
      };
    }
  }

  return result;
}

/**
 * Extrait un commentaire d'arrivée Geny (récit course optionnel).
 * Pattern : section après <h2>Commentaire</h2> ou <strong>Compte rendu</strong>.
 */
export function parseCommentaire(html: string): string | null {
  const patterns: RegExp[] = [
    /<h[1-3][^>]*>\s*Commentaire[^<]*<\/h[1-3]>\s*<(?:p|div)[^>]*>([\s\S]{50,2000}?)<\//i,
    /<(?:strong|b)[^>]*>\s*Compte\s*rendu\s*<\/(?:strong|b)>\s*[^<]*<(?:p|div)[^>]*>([\s\S]{50,2000}?)<\//i,
    /class="[^"]*commentaire[^"]*"[^>]*>([\s\S]{50,2000}?)<\//i,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      const text = stripTags(m[1]).trim();
      if (text.length >= 50 && text.length <= 2000) return text;
    }
  }
  return null;
}
