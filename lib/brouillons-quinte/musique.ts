/**
 * lib/brouillons-quinte/musique.ts — lecture de la musique PMU (spec §6.3).
 *
 * Jeton = place + discipline : « 2a », « 0a », « Da », « 4m », « 1p », « Ah »…
 * Lus du plus récent au plus ancien ; seuls les 5 premiers comptent. Place
 * 1 à 9 = rang d'arrivée ; 0 = au-delà du 9e. Fautes : D (disqualifié),
 * A (arrêté), T (tombé). Toute autre lettre : course comptée, ni place ni faute.
 */

export const NB_DERNIERES = 5;
const LETTRES_FAUTE = "DAT";

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
  const sansAnnees = String(musique == null ? "" : musique).replace(/\(\d+\)/g, "");
  const jetons = sansAnnees.match(/[0-9A-Z][a-z]/g);
  if (!jetons || jetons.length === 0) return null;
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
    } else if (LETTRES_FAUTE.indexOf(c) !== -1) {
      bilan.fautes++;
    }
  }
  return bilan;
}
