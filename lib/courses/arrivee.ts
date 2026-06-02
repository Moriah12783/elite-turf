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
