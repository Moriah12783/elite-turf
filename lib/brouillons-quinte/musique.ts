/**
 * lib/brouillons-quinte/musique.ts — lecture de la musique PMU (spec §6.3).
 *
 * Jeton = place + discipline : « 2a », « 0a », « Da », « 4m », « 1p », « Ah »…
 * Lus du plus récent au plus ancien ; seuls les 5 premiers comptent. Place
 * 1 à 9 = rang d'arrivée ; 0 = au-delà du 9e. Fautes : D (disqualifié),
 * A (arrêté), T (tombé). Toute autre lettre : course comptée, ni place ni faute.
 */

export const NB_DERNIERES = 5;
/** Courses montrées dans le tableau des musiques de l'e-mail à Steph. */
export const NB_TABLEAU = 7;
const LETTRES_FAUTE = "DAT";

/** Jetons de la musique, du plus récent au plus ancien ; null si absente ou illisible. */
function jetonsMusique(musique: string | null | undefined): string[] | null {
  const jetons = String(musique == null ? "" : musique).replace(/\(\d+\)/g, "").match(/[0-9A-Z][a-z]/g);
  return jetons && jetons.length > 0 ? jetons : null;
}

/** PUR : D (disqualifié), A (arrêté) ou T (tombé). */
export function estFaute(place: string): boolean {
  return LETTRES_FAUTE.indexOf(place) !== -1;
}

/**
 * PUR : les n dernières places, de la plus récente à la plus ancienne :
 * « 1 » à « 9 », « 0 » (au-delà du 9e) ou une lettre (D, A, T…). null si la
 * musique est absente ou illisible.
 */
export function dernieresPlaces(musique: string | null | undefined, n: number = NB_TABLEAU): string[] | null {
  const jetons = jetonsMusique(musique);
  return jetons ? jetons.slice(0, n).map((j) => j.charAt(0)) : null;
}

export interface BilanMusique {
  /** Résultats lus (au plus 5). */
  courses: number;
  victoires: number;
  top3: number;
  top5: number;
  fautes: number;
  /** La plus récente des courses lues est une victoire. */
  derniereGagnee: boolean;
}

/** PUR. null si la musique est absente ou illisible. */
export function analyserMusique(musique: string | null | undefined): BilanMusique | null {
  const jetons = jetonsMusique(musique);
  if (!jetons) return null;
  const bilan: BilanMusique = { courses: 0, victoires: 0, top3: 0, top5: 0, fautes: 0, derniereGagnee: false };
  const lus = jetons.slice(0, NB_DERNIERES);
  for (let i = 0; i < lus.length; i++) {
    const c = lus[i].charAt(0);
    bilan.courses++;
    if (c >= "1" && c <= "9") {
      const place = Number(c);
      if (place === 1) {
        bilan.victoires++;
        if (i === 0) bilan.derniereGagnee = true;
      }
      if (place <= 3) bilan.top3++;
      if (place <= 5) bilan.top5++;
    } else if (estFaute(c)) {
      bilan.fautes++;
    }
  }
  return bilan;
}
