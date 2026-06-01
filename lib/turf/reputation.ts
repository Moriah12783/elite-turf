/**
 * lib/turf/reputation.ts
 *
 * Listes curées de réputation des acteurs (drivers/jockeys d'élite + entraîneurs
 * reconnus). « Notre sélection » s'en sert pour valoriser les grands noms que
 * les stats BDD (jeunes, incomplètes) ne captent pas encore.
 *
 * Match par sous-chaîne, insensible à la casse : les noms en BDD sont du type
 * "J.M. BAZIRE", "M. Abrivard", "A. Fabre" — on cherche le patronyme.
 *
 * Aucune dépendance : ce module est pur et importable côté serveur comme client.
 */

export const ELITE_DRIVERS: readonly string[] = [
  // Trot (drivers)
  "bazire", "nivard", "raffin", "abrivard", "gelormini", "lebourgeois",
  "lagadeuc", "thomain", "mottier", "duvaldestin", "ploquin", "barrier", "gosselin",
  // Plat (jockeys)
  "soumillon", "buick", "murphy", "moore", "demuro", "guyon", "lemaire",
  "barzalona", "peslier", "boudot", "doyle", "marquand", "pasquier",
  "mendizabal", "loughnane", "lordan", "lemaitre",
  // Obstacle
  "reveley", "chevillard", "lestrade", "giles", "frost", "zuliani",
];

export const RECOGNIZED_TRAINERS: readonly string[] = [
  // Trot
  "bazire", "roussel", "cuoq", "baudron", "leveque", "desaunette", "guarato", "donio",
  // Plat / Obstacle
  "fabre", "head", "graffard", "rouget", "clement", "martinon", "chappet",
  "delzangles", "botti", "pantall", "bary", "fouin", "collet", "seror", "wattel",
];

function matches(name: string | null | undefined, list: readonly string[]): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return list.some((needle) => n.includes(needle));
}

export const isEliteDriver = (name: string | null | undefined): boolean =>
  matches(name, ELITE_DRIVERS);

export const isRecognizedTrainer = (name: string | null | undefined): boolean =>
  matches(name, RECOGNIZED_TRAINERS);
