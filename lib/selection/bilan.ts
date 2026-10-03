/**
 * lib/selection/bilan.ts
 *
 * Bilan de la « Sélection stats » sur les photos prises AVANT le départ (cf.
 * photo.ts), comparé au hasard (même nombre de chevaux), et comparaison du
 * pronostic payant au marché de la même heure (favoris de la photo, à nombre
 * de chevaux égal). PUR : testable, sans I/O.
 *
 * Toujours lire un taux de réussite face au hasard : avec 8 chevaux sur 12, le
 * gagnant est déjà dans la sélection 2 fois sur 3 sans rien savoir.
 */

export interface LigneBilan {
  /** Sélection photographiée, dans l'ordre. */
  numeros: number[];
  nbPartants: number;
  /** Marché au moment de la photo : numéro → cote. */
  cotesMarche: Record<string, number>;
  /** Arrivée officielle. */
  arrivee: number[];
  /** Sélection du pronostic payant publié sur la course, s'il existe. */
  pronoPayant?: number[] | null;
}

export interface Taux {
  /** Courses comptées pour le gagnant et les 3 premiers. */
  n: number;
  gagnant: number;
  troisPremiers: number;
  /** Courses dont l'arrivée compte au moins 5 chevaux. */
  nCinq: number;
  cinqPremiers: number;
}

export interface BilanSelection {
  courses: number;
  selection: Taux;
  hasard: Taux;
  payant: { courses: number; prono: Taux; marche: Taux };
}

interface Somme { n: number; g: number; t: number; nCinq: number; c: number }

const vide = (): Somme => ({ n: 0, g: 0, t: 0, nCinq: 0, c: 0 });

function contient(selection: number[], numeros: number[]): boolean {
  return numeros.every((n) => selection.indexOf(n) !== -1);
}

/** k chevaux tirés au hasard parmi n : chance que les m premiers y soient tous. */
function chanceHasard(k: number, n: number, m: number): number {
  if (k < m || n < m) return 0;
  let p = 1;
  for (let i = 0; i < m; i++) p *= (k - i) / (n - i);
  return p;
}

function compter(s: Somme, selection: number[], arrivee: number[]): void {
  s.n++;
  if (selection.indexOf(arrivee[0]) !== -1) s.g++;
  if (contient(selection, arrivee.slice(0, 3))) s.t++;
  if (arrivee.length >= 5) {
    s.nCinq++;
    if (contient(selection, arrivee.slice(0, 5))) s.c++;
  }
}

function compterHasard(s: Somme, k: number, n: number, arrivee: number[]): void {
  s.n++;
  s.g += n > 0 ? Math.min(1, k / n) : 0;
  s.t += chanceHasard(k, n, 3);
  if (arrivee.length >= 5) {
    s.nCinq++;
    s.c += chanceHasard(k, n, 5);
  }
}

function taux(s: Somme): Taux {
  return {
    n: s.n,
    gagnant: s.n ? s.g / s.n : 0,
    troisPremiers: s.n ? s.t / s.n : 0,
    nCinq: s.nCinq,
    cinqPremiers: s.nCinq ? s.c / s.nCinq : 0,
  };
}

/** Les k plus petites cotes de la photo (à cote égale : numéro croissant). */
export function favoris(cotes: Record<string, number>, k: number): number[] {
  return Object.keys(cotes)
    .map((num) => ({ num: Number(num), cote: cotes[num] }))
    .sort((a, b) => a.cote - b.cote || a.num - b.num)
    .slice(0, k)
    .map((x) => x.num);
}

export function calculerBilan(lignes: LigneBilan[]): BilanSelection {
  const sel = vide(), hasard = vide(), prono = vide(), marche = vide();
  for (const l of lignes) {
    // Il faut au moins les 3 premiers de l'arrivée et une sélection pour juger.
    if (l.arrivee.length < 3 || l.numeros.length === 0) continue;
    compter(sel, l.numeros, l.arrivee);
    compterHasard(hasard, l.numeros.length, l.nbPartants, l.arrivee);
    const k = l.pronoPayant?.length ?? 0;
    if (k > 0 && Object.keys(l.cotesMarche).length >= k) {
      compter(prono, l.pronoPayant as number[], l.arrivee);
      compter(marche, favoris(l.cotesMarche, k), l.arrivee);
    }
  }
  return {
    courses: sel.n,
    selection: taux(sel),
    hasard: taux(hasard),
    payant: { courses: prono.n, prono: taux(prono), marche: taux(marche) },
  };
}
