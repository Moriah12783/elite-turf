/**
 * lib/courses/rangs.ts
 *
 * Rangs officiels d'une arrivée, ex æquo compris. PUR, sans I/O.
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * L'arrivée est stockée à plat (`courses.arrivee_officielle`,
 * `arrivees.ordre_arrivee`) : la position dans la liste servait de rang. Or le
 * PMU classe les ex æquo (dead heat) au même rang. Prix de Versailles, Quinté+
 * du 08/10/2026 : `[[1],[5],[8],[4],[15,16],[10]]` → 15 et 16 sont 5es tous
 * les deux (le PMU paie 1-5-8-4-15 ET 1-5-8-4-16), le suivant est 7e. À plat,
 * le 16 passait 6e.
 *
 * Les rangs sont donc stockés à part, en parallèle de l'arrivée
 * (`courses.arrivee_rangs`, `arrivees.rangs`) : `[1,2,3,4,5,5,7]`. NULL veut
 * dire « ordre strict » — le cas de 98 % des courses et de tout l'historique.
 * Des rangs incohérents avec l'arrivée sont ignorés : on retombe sur la
 * position, c'est-à-dire le comportement historique, jamais sur un rang faux.
 */

/** Position dans la liste (1, 2, 3…) : le rang quand il n'y a pas d'ex æquo. */
function positions(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i + 1);
  return out;
}

/**
 * Les rangs suivent le classement du PMU : le premier vaut 1, chaque rang
 * suivant reprend celui d'avant (ex æquo) ou vaut sa position (5, 5, 7).
 */
export function rangsValides(
  arrivee: number[] | null | undefined,
  rangs: number[] | null | undefined,
): boolean {
  if (!Array.isArray(arrivee) || !Array.isArray(rangs)) return false;
  if (arrivee.length === 0 || rangs.length !== arrivee.length) return false;
  if (rangs[0] !== 1) return false;
  for (let i = 1; i < rangs.length; i++) {
    if (rangs[i] !== rangs[i - 1] && rangs[i] !== i + 1) return false;
  }
  return true;
}

/** Rang de chaque position : les rangs stockés s'ils sont cohérents, sinon la position. */
export function rangsEffectifs(
  arrivee: number[] | null | undefined,
  rangs?: number[] | null,
): number[] {
  const arr = Array.isArray(arrivee) ? arrivee : [];
  return rangsValides(arr, rangs) ? (rangs as number[]).slice() : positions(arr.length);
}

/** Ce qu'il faut écrire en base : NULL sans ex æquo (ordre strict). */
export function rangsAStocker(rangs: number[]): number[] | null {
  for (let i = 0; i < rangs.length; i++) if (rangs[i] !== i + 1) return rangs.slice();
  return null;
}

export interface GroupeArrivee {
  rang: number;
  numeros: number[];
}

/** L'arrivée par rang : `[{ rang: 5, numeros: [15, 16] }, { rang: 7, numeros: [10] }]`. */
export function groupesArrivee(
  arrivee: number[] | null | undefined,
  rangs?: number[] | null,
): GroupeArrivee[] {
  const arr = Array.isArray(arrivee) ? arrivee : [];
  const r = rangsEffectifs(arr, rangs);
  const out: GroupeArrivee[] = [];
  for (let i = 0; i < arr.length; i++) {
    const dernier = out[out.length - 1];
    if (dernier && dernier.rang === r[i]) dernier.numeros.push(arr[i]);
    else out.push({ rang: r[i], numeros: [arr[i]] });
  }
  return out;
}

/** Rang officiel d'un cheval ; null s'il n'est pas dans l'arrivée. */
export function rangDe(
  numero: number,
  arrivee: number[] | null | undefined,
  rangs?: number[] | null,
): number | null {
  const arr = Array.isArray(arrivee) ? arrivee : [];
  const i = arr.indexOf(numero);
  return i === -1 ? null : rangsEffectifs(arr, rangs)[i];
}

/** Le cheval partage-t-il son rang avec un autre ? */
export function estExAequo(
  numero: number,
  arrivee: number[] | null | undefined,
  rangs?: number[] | null,
): boolean {
  const arr = Array.isArray(arrivee) ? arrivee : [];
  const i = arr.indexOf(numero);
  if (i === -1) return false;
  const r = rangsEffectifs(arr, rangs);
  return (i > 0 && r[i - 1] === r[i]) || (i + 1 < r.length && r[i + 1] === r[i]);
}

/**
 * Garde les chevaux classés jusqu'au rang `cap` inclus. Un ex æquo au rang du
 * cap est gardé en entier : couper au nombre de chevaux en perdrait un.
 */
export function couperParRang(
  arrivee: number[],
  rangs: number[],
  cap: number,
): { arrivee: number[]; rangs: number[] } {
  const r = rangsEffectifs(arrivee, rangs);
  const out = { arrivee: [] as number[], rangs: [] as number[] };
  for (let i = 0; i < arrivee.length && r[i] <= cap; i++) {
    out.arrivee.push(arrivee[i]);
    out.rangs.push(r[i]);
  }
  return out;
}

/** « 1er », « 2e »… « 5e ex æquo » : libellé d'une place à l'arrivée. */
export function libelleRang(rang: number, exAequo: boolean): string {
  return `${rang === 1 ? "1er" : `${rang}e`}${exAequo ? " ex æquo" : ""}`;
}

/**
 * Les `n` premiers rangs en texte : « 8 - 2 - 7 - 3 - 15 », et avec un ex
 * æquo « 1 - 5 - 8 - 4 - 15 / 16 (ex æquo) » — le 16 n'est plus masqué.
 */
export function arriveeEnTexte(
  arrivee: number[] | null | undefined,
  rangs: number[] | null | undefined,
  n: number,
): string {
  const parts: string[] = [];
  let exAequo = false;
  for (const g of groupesArrivee(arrivee, rangs)) {
    if (g.rang > n) break;
    if (g.numeros.length > 1) exAequo = true;
    parts.push(g.numeros.join(" / "));
  }
  return parts.join(" - ") + (exAequo ? " (ex æquo)" : "");
}
