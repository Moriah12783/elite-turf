/**
 * lib/courses/arrivee.ts
 *
 * Transforme une arrivée officielle (ordre des n° de chevaux) en liste de
 * places enrichies du nom du cheval (null si le partant est introuvable).
 * Pur, sans I/O — consommé par le composant ArriveePodium.
 */

export interface PodiumPlace {
  rank: number;
  numero: number;
  nom: string | null;
}

export function buildArriveePodium(
  arrivee: number[] | null | undefined,
  partants: { numero: number; nom_cheval?: string | null }[] | null | undefined,
): PodiumPlace[] {
  if (!arrivee || arrivee.length === 0) return [];
  const byNum = new Map<number, string | null>();
  for (const p of partants ?? []) byNum.set(p.numero, p.nom_cheval ?? null);
  return arrivee.map((numero, i) => ({
    rank: i + 1,
    numero,
    nom: byNum.get(numero) ?? null,
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
 */
export function estPlace(numero: number, arrivee: number[] | null | undefined): boolean {
  return Array.isArray(arrivee) && arrivee.slice(0, NB_PLACES).indexOf(numero) !== -1;
}
