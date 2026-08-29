/**
 * Libellé de date pour les cartes de pronostic.
 *
 * POURQUOI CE MODULE : la carte affichait l'heure de départ (« 15:00 », en doré
 * et en gras, l'accent le plus fort) mais JAMAIS la date. Un pronostic d'il y a
 * trois jours était donc rigoureusement indiscernable de celui du jour — des
 * abonnés ont cru jouer une sélection actuelle. Constaté par Steph, 25/08/2026.
 *
 * 🔴 Aucune dépendance à `Intl` ni au fuseau du serveur : on découpe la chaîne
 * `YYYY-MM-DD` et on calcule le jour de semaine en UTC pur. `toLocaleDateString`
 * aurait décalé la date d'un jour selon le fuseau d'exécution — le site tourne
 * sur Cloudflare (UTC) pour des lecteurs à Abidjan (UTC+0) et à Paris (UTC+2).
 *
 * PUR, ES5-safe, testé.
 */

const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Découpe `YYYY-MM-DD` en [année, mois, jour], ou null si la forme est invalide. */
function decouper(iso: string): [number, number, number] | null {
  if (typeof iso !== "string") return null;
  const p = iso.slice(0, 10).split("-");
  if (p.length !== 3) return null;
  const a = Number(p[0]), m = Number(p[1]), j = Number(p[2]);
  if (!a || !m || !j || m < 1 || m > 12 || j < 1 || j > 31) return null;
  return [a, m, j];
}

/**
 * « jeu. 21 août ». Chaîne d'entrée rendue telle quelle si elle est illisible —
 * mieux vaut une date brute qu'une date fausse ou un libellé vide.
 */
export function libelleDateCourse(iso: string): string {
  const d = decouper(iso);
  if (!d) return typeof iso === "string" ? iso : "";
  const jourSemaine = JOURS[new Date(Date.UTC(d[0], d[1] - 1, d[2])).getUTCDay()];
  return `${jourSemaine} ${d[2]} ${MOIS[d[1] - 1]}`;
}

/**
 * La course a-t-elle lieu aujourd'hui ?
 *
 * `aujourdhui` est injecté (et non lu de l'horloge) pour rester pur et testable.
 * Comparaison de chaînes `YYYY-MM-DD` : sûre car les deux valeurs viennent du
 * même format, et l'ordre lexicographique y coïncide avec l'ordre chronologique.
 */
export function estDuJour(isoCourse: string, aujourdhui: string): boolean {
  if (!isoCourse || !aujourdhui) return false;
  return isoCourse.slice(0, 10) === aujourdhui.slice(0, 10);
}

/** La course est-elle déjà passée ? (strictement avant aujourd'hui) */
export function estPassee(isoCourse: string, aujourdhui: string): boolean {
  if (!isoCourse || !aujourdhui) return false;
  return isoCourse.slice(0, 10) < aujourdhui.slice(0, 10);
}
