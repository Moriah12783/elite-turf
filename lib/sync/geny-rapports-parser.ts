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

/**
 * Geny annote chaque rapport par "X € pour 1€ de mise". Le `1€` n'est PAS
 * un rapport mais l'unité de mise référence — il pollue toutes nos extractions
 * regex. On filtre donc les montants de valeur exactement 1.0 (ils ne sont
 * pratiquement jamais des rapports légitimes côté PMU : même les Simple Placé
 * sur favoris extrêmes plafonnent à 1.10 €). Cette ligne unique élimine ~50 %
 * des bugs de parsing observés en mai 2026.
 */
function isStakeArtifact(n: number): boolean {
  return n === 1 || n === 1.0;
}

/** Cherche un montant € à proximité d'un label. Renvoie le 1er match. */
function findAmountAfter(html: string, labelPattern: RegExp): number | null {
  const labelRe = new RegExp(
    labelPattern.source + `[^\\d€]{0,200}?([\\d\\s.,]+)\\s*(?:€|EUR)?`,
    "i" + (labelPattern.flags.includes("u") ? "u" : ""),
  );
  const m = html.match(labelRe);
  if (!m) return null;
  const amount = parseEuroAmount(m[1]);
  if (amount == null || isStakeArtifact(amount)) return null;
  return amount;
}

// ── Extraction STRUCTURELLE des paris ordonnés (Tiercé / Quarté+ / Quinté+) ──
//
// Pourquoi ce bloc remplace l'ancienne extraction « positionnelle » :
// l'ancienne version ancrait sur le 1er « Quinté+ » du texte stripé, qui est
// le LIEN DE NAVIGATION (« Quinté+/Réunions PMU … ») en haut de CHAQUE page —
// jamais le tableau de rapports. Elle ramassait donc la dotation de la course
// (« 14 600€ » → 600) comme « ordre » et un petit rapport voisin comme
// « désordre », et fabriquait un Quinté+ même sur les courses qui n'en ont pas
// (le mot « Quinté+ » étant le nom de la rubrique du site). D'où une médiane
// de désordre absurde (~5 €).
//
// Geny structure en réalité chaque pari dans sa propre table :
//   <table id="lesTierces"> / "lesQuartos" / "lesQuintos">
// et, à l'intérieur, un bloc par opérateur (GENYBET.FR / PMU / PMU.FR)
// introduit par un bandeau coloré, chaque ligne étant
//   <td class="ncdouble…">Désordre</td><td class="pts…">203,00 €</td>.
// On extrait donc par TABLE + OPÉRATEUR + LIBELLÉ (et non par position).

/**
 * Extrait le HTML interne d'une `<table id="X">` en équilibrant les `<table>`
 * imbriquées (Geny imbrique une sous-table par opérateur). Renvoie null si la
 * table est absente — 1er garde-fou anti-fabrication : pas de table `lesQuintos`
 * ⇒ pas de Quinté+ sur cette course.
 */
function extractTableById(html: string, id: string): string | null {
  const open = html.match(new RegExp(`<table[^>]*id=["']${id}["'][^>]*>`, "i"));
  if (!open || open.index == null) return null;
  const rest = html.slice(open.index + open[0].length);
  let depth = 1;
  // Array.from : ce repo cible ES5 sans downlevelIteration → pas de for..of
  // direct sur un itérateur matchAll (cf. convention du reste du fichier).
  for (const t of Array.from(rest.matchAll(/<(\/?)table\b/gi))) {
    if (t[1] === "/") {
      if (--depth === 0) return rest.slice(0, t.index ?? rest.length);
    } else {
      depth++;
    }
  }
  return rest; // HTML non équilibré : on rend tout le reste (best-effort)
}

interface RapportRow { label: string; amount: number | null; }

/** Parse les lignes `<td libellé><td montant>` d'un bloc de rapports Geny. */
function parseRapportRows(blockHtml: string): RapportRow[] {
  const rowRe =
    /<td[^>]*class=["']ncdouble[^"']*["'][^>]*>([\s\S]*?)<\/td>\s*<td[^>]*class=["']pts[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi;
  return Array.from(blockHtml.matchAll(rowRe)).map((m) => ({
    label:  stripTags(m[1]).trim(),           // ex: "Désordre 3-5-9-11-13" ou "" (PMU n'étiquette pas son ordre)
    amount: parseEuroAmount(stripTags(m[2]).trim()), // null si "Pas de gagnant"
  }));
}

interface OperatorBlock { operator: string; rows: RapportRow[]; }

/**
 * Découpe une table de rapports en blocs par opérateur. Chaque opérateur est
 * introduit par un bandeau coloré `<div style="…background-color…"><b><i>PMU</i></b>`.
 */
function operatorRapportBlocks(tableInner: string): OperatorBlock[] {
  const headRe = /<div[^>]*background-color[^>]*>\s*<b>\s*<i>\s*([^<]+?)\s*<\/i>/gi;
  const heads = Array.from(tableInner.matchAll(headRe)).map((m) => ({
    operator: m[1].trim(),
    idx:      m.index ?? 0,
  }));
  if (heads.length === 0) return [{ operator: "", rows: parseRapportRows(tableInner) }];
  return heads.map((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].idx : tableInner.length;
    return { operator: h.operator, rows: parseRapportRows(tableInner.slice(h.idx, end)) };
  });
}

const hasDesordreRow = (b: OperatorBlock): boolean => b.rows.some((r) => /sordre/i.test(r.label));

/**
 * Choisit le bloc opérateur de RÉFÉRENCE. Priorité PMU (rapport officiel relayé
 * par la LONACI en Afrique) > PMU.FR > GENYBET.FR > 1er bloc contenant un
 * « Désordre ». Source homogène ⇒ ROI du banc de mesure cohérent.
 */
function pickReferenceBlock(blocks: OperatorBlock[]): OperatorBlock | null {
  for (const name of ["PMU", "PMU.FR", "GENYBET.FR"]) {
    const b = blocks.find((bl) => bl.operator.toUpperCase() === name && hasDesordreRow(bl));
    if (b) return b;
  }
  return blocks.find(hasDesordreRow) ?? null;
}

/** 1er montant dont le libellé matche `re` (« Pas de gagnant » → ignoré). */
function amountForLabel(rows: RapportRow[], re: RegExp): number | undefined {
  const row = rows.find((r) => re.test(r.label) && r.amount != null);
  return row ? (row.amount as number) : undefined;
}

/**
 * Montant « ordre » d'un pari ordonné : ligne explicitement « Ordre » (hors
 * « Désordre » et « Ordre sans Tirelire »), sinon 1ère ligne neutre avec montant
 * — car le bloc PMU n'étiquette PAS sa ligne d'ordre (juste le montant).
 */
function pickOrdre(rows: RapportRow[]): number | undefined {
  const labelled = rows.find(
    (r) => /\bordre\b/i.test(r.label) && !/sordre|tirelire/i.test(r.label) && r.amount != null,
  );
  if (labelled) return labelled.amount as number;
  const plain = rows.find((r) => !/sordre|bonus/i.test(r.label) && r.amount != null);
  return plain ? (plain.amount as number) : undefined;
}

interface OrderedBet { ordre?: number; desordre?: number; bonus?: number; bonus4?: number; bonus3?: number }

/**
 * Extrait un pari ordonné depuis sa table Geny dédiée, par LIBELLÉ. Renvoie
 * undefined si :
 *   - la table est absente (course sans ce pari), OU
 *   - le bloc de référence n'a pas de ligne « Désordre » (ex : la table
 *     `lesQuartos` peut contenir un bet « Super 4 », pas un vrai Quarté+).
 * Ce double garde-fou élimine les rapports fabriqués.
 */
function extractOrderedBet(
  html: string,
  tableId: string,
  opts: { bonus?: boolean; bonus4et3?: boolean } = {},
): OrderedBet | undefined {
  const inner = extractTableById(html, tableId);
  if (inner == null) return undefined; // table absente

  const block = pickReferenceBlock(operatorRapportBlocks(inner));
  if (!block) return undefined;

  const desordre = amountForLabel(block.rows, /sordre/i);
  if (desordre == null) return undefined; // pas un vrai pari ordonné (ex : Super 4)

  const out: OrderedBet = { desordre };
  const ordre = pickOrdre(block.rows);
  if (ordre != null) out.ordre = ordre;
  if (opts.bonus) {
    const b = amountForLabel(block.rows, /bonus/i);
    if (b != null) out.bonus = b;
  }
  if (opts.bonus4et3) {
    const b4 = amountForLabel(block.rows, /bonus\s*4/i);
    const b3 = amountForLabel(block.rows, /bonus\s*3/i);
    if (b4 != null) out.bonus4 = b4;
    if (b3 != null) out.bonus3 = b3;
  }
  return out;
}

/** Extrait une liste de N montants après un label. */
function findAmountsAfter(html: string, labelPattern: RegExp, count = 3): number[] | undefined {
  const m = html.match(labelPattern);
  if (!m) return undefined;
  const startIdx = (m.index ?? 0) + m[0].length;
  const slice = html.slice(startIdx, startIdx + 800);
  const amounts = Array.from(slice.matchAll(/([\d]+(?:[.,]\d+)?)\s*€/g))
    .map((m) => parseEuroAmount(m[1]))
    .filter((n): n is number => n !== null && !isStakeArtifact(n));
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

  // ── Paris ordonnés : Tiercé / Quarté+ / Quinté+ ─────────────────
  // Extraction STRUCTURELLE (table dédiée + opérateur PMU + libellé), sur le
  // HTML BRUT et non le texte stripé. Voir extractOrderedBet : garde-fous
  // anti-fabrication (table absente OU pas de ligne « Désordre » ⇒ undefined).
  const tierce = extractOrderedBet(html, "lesTierces");
  if (tierce) result.tierce = tierce;

  const quartePlus = extractOrderedBet(html, "lesQuartos", { bonus: true });
  if (quartePlus) result.quarte_plus = quartePlus;

  const quintePlus = extractOrderedBet(html, "lesQuintos", { bonus4et3: true });
  if (quintePlus) result.quinte_plus = quintePlus;

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
      .filter((n): n is number => n !== null && !isStakeArtifact(n));
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
