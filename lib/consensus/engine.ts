/**
 * Moteur de consensus de la presse — module PUR, déterministe, testable.
 *
 * Transforme une table de citations (combien de sources de presse citent chaque
 * cheval + cote probable) en :
 *   - 3 tops : favoris / outsiders / tocards les PLUS cités,
 *   - une proposition de sélection Elite (6) et Pro (8), structurée base / value / coup.
 *
 * 100 % factuel : ne "devine" rien, ne fait que COMPTER et TRIER des données
 * fournies. Aucune promesse de gain. Les seuils sont réglables (calibrés ensuite
 * par le banc de mesure). N'importe AUCUN module serveur → réutilisable partout.
 */

export type CategorieCote = "FAVORI" | "OUTSIDER" | "TOCARD";

/** Une ligne de la table de consensus (fournie par la collecte presse). */
export interface PartantConsensus {
  numero: number;
  nom?: string;
  /** nb de sources de presse qui citent ce cheval dans leur sélection */
  citations: number;
  /** nb de sources qui en font leur base / N°1 (pondération de position) */
  bases?: number;
  /** cote probable décimale (ex. 4.5). null/absent si inconnue. */
  cote?: number | null;
}

export interface ConsensusInput {
  /** nombre total de sources de presse agrégées (ex. 30) */
  nbSources: number;
  partants: PartantConsensus[];
}

export interface PartantScored {
  numero: number;
  nom?: string;
  citations: number;
  bases: number;
  /** citations / nbSources, dans [0,1] */
  tauxCitation: number;
  cote: number | null;
  categorie: CategorieCote;
  /** citations + 0.5 × bases */
  scoreConsensus: number;
}

export interface PlanConsensus {
  base: number[];
  value: number[];
  coup: number[];
  /** sélection finale dédupliquée, dans l'ordre base → value → coup (puis complétée) */
  selection: number[];
}

export interface ConsensusResult {
  nbSources: number;
  partants: PartantScored[]; // tous, triés par scoreConsensus décroissant
  topCites: PartantScored[];
  topFavoris: PartantScored[];
  topOutsiders: PartantScored[];
  topTocards: PartantScored[];
  elite: PlanConsensus; // sélection à 6
  pro: PlanConsensus; // sélection à 8
  /** R01 — citations minimales pour être éligible aux slots « base » auto */
  seuilBase: number;
}

export interface CompositionPlan {
  base: number;
  value: number;
  coup: number;
  total: number;
}

export interface ConsensusOptions {
  topN?: number; // taille des tops (défaut 5)
  coteFavoriMax?: number; // cote < x = FAVORI (défaut 5)
  coteOutsiderMax?: number; // cote <= x = OUTSIDER, sinon TOCARD (défaut 12)
  elite?: CompositionPlan; // défaut { base:3, value:2, coup:1, total:6 }
  pro?: CompositionPlan; // défaut { base:4, value:3, coup:1, total:8 }
}

const DEF_TOP_N = 5;
const DEF_FAVORI_MAX = 5;
const DEF_OUTSIDER_MAX = 12;
const DEF_ELITE: CompositionPlan = { base: 3, value: 2, coup: 1, total: 6 };
const DEF_PRO: CompositionPlan = { base: 4, value: 3, coup: 1, total: 8 };

/**
 * R01 (contrat v2.4) — seuil de citations pour être éligible « base » auto :
 * relatif (30 % des sources) avec plancher absolu 3. 33 sources → 10 ; 7 → 3.
 */
export function seuilBase(nbSources: number): number {
  return Math.max(3, Math.ceil(0.3 * nbSources));
}

function classifyCote(cote: number | null, favMax: number, outMax: number): CategorieCote {
  if (cote == null || !isFinite(cote)) return "OUTSIDER"; // neutre si cote inconnue
  if (cote < favMax) return "FAVORI";
  if (cote <= outMax) return "OUTSIDER";
  return "TOCARD";
}

/** Déduplication d'une liste de numéros en préservant l'ordre (ES5-safe, pas de Set spread). */
function uniqNumeros(arr: number[]): number[] {
  const seen: Record<number, boolean> = {};
  const out: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    if (!seen[arr[i]]) {
      seen[arr[i]] = true;
      out.push(arr[i]);
    }
  }
  return out;
}

/** Tri : score desc, puis citations desc, bases desc, cote asc, numéro asc. */
function compareScored(a: PartantScored, b: PartantScored): number {
  if (b.scoreConsensus !== a.scoreConsensus) return b.scoreConsensus - a.scoreConsensus;
  if (b.citations !== a.citations) return b.citations - a.citations;
  if (b.bases !== a.bases) return b.bases - a.bases;
  const ca = a.cote == null ? Infinity : a.cote;
  const cb = b.cote == null ? Infinity : b.cote;
  if (ca !== cb) return ca - cb;
  return a.numero - b.numero;
}

function buildPlan(
  sortedAll: PartantScored[],
  topOutsiders: PartantScored[],
  topTocards: PartantScored[],
  comp: CompositionPlan,
  seuilBaseVal: number,
): PlanConsensus {
  // R01 (anti-fausse-base, incident du 01/07) : un cheval sous le seuil de
  // citations ne peut JAMAIS occuper un slot « base » automatiquement, quel
  // que soit son score (il reste éligible value/coup/complétion).
  const base = sortedAll
    .filter((p) => p.citations >= seuilBaseVal)
    .slice(0, comp.base)
    .map((p) => p.numero);
  const value = topOutsiders
    .map((p) => p.numero)
    .filter((n) => base.indexOf(n) === -1)
    .slice(0, comp.value);
  const chosen = base.concat(value);
  const coup = topTocards
    .map((p) => p.numero)
    .filter((n) => chosen.indexOf(n) === -1)
    .slice(0, comp.coup);

  let selection = uniqNumeros(base.concat(value).concat(coup));
  // Compléter avec le consensus si on n'atteint pas le total visé.
  if (selection.length < comp.total) {
    const fill = sortedAll.map((p) => p.numero).filter((n) => selection.indexOf(n) === -1);
    selection = uniqNumeros(selection.concat(fill));
  }
  selection = selection.slice(0, comp.total);
  return { base, value, coup, selection };
}

/**
 * Construit le consensus à partir de la table de citations.
 * Pur : mêmes entrées → mêmes sorties.
 */
export function buildConsensus(input: ConsensusInput, options?: ConsensusOptions): ConsensusResult {
  const topN = options && options.topN != null ? options.topN : DEF_TOP_N;
  const favMax = options && options.coteFavoriMax != null ? options.coteFavoriMax : DEF_FAVORI_MAX;
  const outMax = options && options.coteOutsiderMax != null ? options.coteOutsiderMax : DEF_OUTSIDER_MAX;
  const compElite = options && options.elite ? options.elite : DEF_ELITE;
  const compPro = options && options.pro ? options.pro : DEF_PRO;
  const nbSources = Math.max(1, input.nbSources || 0);

  const scored: PartantScored[] = (input.partants || []).map((p) => {
    const citations = Math.max(0, p.citations || 0);
    const bases = Math.max(0, p.bases || 0);
    const cote = p.cote == null ? null : p.cote;
    return {
      numero: p.numero,
      nom: p.nom,
      citations,
      bases,
      tauxCitation: citations / nbSources,
      cote,
      categorie: classifyCote(cote, favMax, outMax),
      scoreConsensus: citations + 0.5 * bases,
    };
  });

  scored.sort(compareScored);

  const topOutsiders = scored.filter((p) => p.categorie === "OUTSIDER").slice(0, topN);
  const topTocards = scored.filter((p) => p.categorie === "TOCARD").slice(0, topN);
  const seuil = seuilBase(nbSources);

  return {
    nbSources,
    partants: scored,
    topCites: scored.slice(0, topN),
    topFavoris: scored.filter((p) => p.categorie === "FAVORI").slice(0, topN),
    topOutsiders,
    topTocards,
    elite: buildPlan(scored, topOutsiders, topTocards, compElite, seuil),
    pro: buildPlan(scored, topOutsiders, topTocards, compPro, seuil),
    seuilBase: seuil,
  };
}
