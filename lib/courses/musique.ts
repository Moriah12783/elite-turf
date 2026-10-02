/**
 * lib/courses/musique.ts
 *
 * Lecture de la musique PMU : la part de podiums dans les dernières courses.
 *
 * Une entrée = une place (1 à 9, « 0 » = au-delà du 9e) ou un incident (D
 * disqualifié, A arrêté, T tombé, R rétrogradé), suivie de la lettre de la
 * discipline (a, m, p, h, s, c…). Les années « (25) » ne sont pas des courses.
 *
 * AVANT le 02/10/2026, seuls les chiffres 1 à 99 comptaient : « 1mDaDa0a » était
 * lu comme 100 % de podiums (réel : 1 sur 4), et 6 % des chevaux étaient notés
 * « bonne forme » à tort.
 *
 * PUR : testable, utilisable côté serveur comme client.
 */

export interface FormeMusique {
  top3: number;
  courses: number;
  ratio: number;
}

/**
 * PUR : le texte est bien une musique (au moins une entrée « place ou incident +
 * discipline »), ou « Inédit » (cheval qui n'a jamais couru). Jamais un simple
 * nombre : jusqu'au 02/10/2026, l'import GenyBet rangeait la cote de référence
 * en musique au trot et en obstacle.
 */
export function estMusique(texte: string | null | undefined): boolean {
  if (!texte) return false;
  return /[0-9DATR][a-z]/.test(texte) || /^in[eé]dit$/i.test(texte.trim());
}

export function parseMusique(musique: string | null | undefined): FormeMusique | null {
  if (!musique) return null;
  const entrees = musique.replace(/\(\d+\)/g, " ").match(/[0-9DATR](?=[a-z])/g) ?? [];
  if (entrees.length === 0) return null;
  const top3 = entrees.filter((e) => e === "1" || e === "2" || e === "3").length;
  return { top3, courses: entrees.length, ratio: top3 / entrees.length };
}
