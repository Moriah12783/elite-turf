/**
 * lib/courses/arrivee.ts
 *
 * Transforme une arrivée officielle (ordre des n° de chevaux) en liste de
 * places enrichies du nom du cheval (null si le partant est introuvable).
 * Pur, sans I/O — consommé par le composant ArriveePodium.
 */

import { estExAequo, rangDe, rangsEffectifs } from "./rangs";

export interface PodiumPlace {
  rank: number;
  numero: number;
  nom: string | null;
  /** Rang partagé avec un autre cheval (dead heat) : afficher « 5ᵉ ex æquo ». */
  exAequo: boolean;
}

export function buildArriveePodium(
  arrivee: number[] | null | undefined,
  partants: { numero: number; nom_cheval?: string | null }[] | null | undefined,
  rangs?: number[] | null,
): PodiumPlace[] {
  if (!arrivee || arrivee.length === 0) return [];
  const byNum = new Map<number, string | null>();
  for (const p of partants ?? []) byNum.set(p.numero, p.nom_cheval ?? null);
  const r = rangsEffectifs(arrivee, rangs);
  return arrivee.map((numero, i) => ({
    rank: r[i],
    numero,
    nom: byNum.get(numero) ?? null,
    exAequo: estExAequo(numero, arrivee, rangs),
  }));
}

/** Places qui comptent pour « placé » : les 3 premiers, sens PMU du simple placé. */
export const NB_PLACES = 3;

/**
 * Le cheval est-il « placé » ? Règle UNIQUE du badge « ✓ Placé » (fiche course,
 * fiche d'un pronostic).
 *
 * Avant le 06/10/2026, la fiche d'un pronostic marquait placé tout cheval
 * présent dans `arrivee_officielle`. Or cette liste compte le plus souvent 6
 * chevaux, parfois 7 (80 % des courses à 6 depuis le 01/09/2026) : un 4e, un
 * 5e, un 6e, voire un 7e s'affichait « ✓ Placé ». Décision de Steph : les 3
 * premiers, comme sur la fiche course.
 *
 * Ex æquo (`rangs`) : un 3e ex æquo est placé — le PMU paie alors quatre
 * placés. C'est le RANG qui compte, pas la position dans la liste.
 */
export function estPlace(
  numero: number,
  arrivee: number[] | null | undefined,
  rangs?: number[] | null,
): boolean {
  const rang = rangDe(numero, arrivee, rangs);
  return rang !== null && rang <= NB_PLACES;
}

export interface ResultatPartant {
  /** Rang officiel (deux 5es ex æquo sont 5es tous les deux). */
  rang: number;
  exAequo: boolean;
  victoire: boolean;
  /** Dans les 3 premiers RANGS (sens PMU du placé). */
  place: boolean;
}

/**
 * Résultat d'un partant d'après l'arrivée et ses rangs (ex æquo compris) :
 * règle UNIQUE des stats chevaux, jockeys, entraîneurs (fiches publiques, ETL,
 * blog). null si le partant n'est pas dans l'arrivée enregistrée. Avant le
 * 09/10/2026, la position dans la liste servait de rang : un co-vainqueur
 * perdait sa victoire, un 3e ex æquo sa place.
 */
export function resultatPartant(
  numero: number,
  arrivee: number[] | null | undefined,
  rangs?: number[] | null,
): ResultatPartant | null {
  const rang = rangDe(numero, arrivee, rangs);
  if (rang === null) return null;
  return { rang, exAequo: estExAequo(numero, arrivee, rangs), victoire: rang === 1, place: rang <= NB_PLACES };
}
