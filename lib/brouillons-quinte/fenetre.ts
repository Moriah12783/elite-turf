/**
 * lib/brouillons-quinte/fenetre.ts — faut-il préparer les brouillons maintenant ?
 * Fenêtre T-95 → T-60 et garde-fous (spec §4 et §10).
 *
 * Le cron passe toutes les 5 min : le premier passage dans la fenêtre prépare
 * (entre T-95 et T-90) ; les suivants réessaient si les données manquaient.
 */

export const FENETRE_MIN = 60;
export const FENETRE_MAX = 95;
/** En dessous : dernier passage de la fenêtre → l'e-mail d'échec part. */
export const DERNIER_PASSAGE_SOUS = 65;

/** Valeur de `pronostics.source` des brouillons (spec §8). */
export const SOURCE_BROUILLON = "AUTO-MARCHE";

/** Un PRO ou un ELITE publié sur le Quinté+ : Steph a déjà fait le travail. */
const NIVEAUX_BLOQUANTS = ["PRO", "ELITE"];

/** PUR : minutes entre maintenant et le départ ; null si départ inconnu. */
export function minutesAvantDepart(depart: Date | null, maintenant: number = Date.now()): number | null {
  if (!depart) return null;
  const t = depart.getTime();
  return Number.isFinite(t) ? (t - maintenant) / 60000 : null;
}

/** PUR : 60 ≤ minutes ≤ 95. */
export function dansFenetre(minutes: number | null): boolean {
  return minutes !== null && minutes >= FENETRE_MIN && minutes <= FENETRE_MAX;
}

/** PUR : dernier passage de la fenêtre (minutes < 65). */
export function dernierPassage(minutes: number | null): boolean {
  return minutes !== null && minutes < DERNIER_PASSAGE_SOUS;
}

export type Moment =
  | { etat: "heure_inconnue" }
  | { etat: "hors_fenetre"; minutes: number }
  | { etat: "dans_fenetre"; minutes: number };

/**
 * PUR : où en est-on par rapport au départ ? Une heure de départ illisible
 * n'est pas une erreur : la route s'arrête sans alerte. Sinon le cron, qui
 * passe toutes les 5 min, laisserait un échec et une alerte Telegram à chaque
 * passage, toute la journée (revue finale du 07/10/2026).
 */
export function situer(depart: Date | null, maintenant: number = Date.now()): Moment {
  const minutes = minutesAvantDepart(depart, maintenant);
  if (minutes === null) return { etat: "heure_inconnue" };
  return dansFenetre(minutes) ? { etat: "dans_fenetre", minutes } : { etat: "hors_fenetre", minutes };
}

export interface PronosticExistant {
  id: string;
  niveau_acces: string;
  publie: boolean;
  source: string | null;
}

export interface EtatDuJour {
  /** Pronostics déjà en base sur le Quinté+ du jour. */
  existants: PronosticExistant[];
  /** L'e-mail « prêts » est parti aujourd'hui (statut SENT). */
  pretsEnvoye: boolean;
  /** L'e-mail d'échec est parti aujourd'hui (statut SENT). */
  echecEnvoye: boolean;
}

export type Garde =
  | { action: "preparer" }
  | { action: "arreter"; raison: "deja_publie" | "brouillons_retires" | "echec_deja_signale" }
  | { action: "deja_prepare"; idPro: string | null; idElite: string | null };

/**
 * PUR : décide du passage. Ordre :
 * 1. un PRO ou un ELITE publié → arrêt (Steph a publié, pas de doublon) ;
 * 2. des brouillons AUTO-MARCHE existent → « déjà préparé » (la route relance
 *    l'e-mail « prêts » s'il n'est pas parti) ;
 * 3. e-mail « prêts » parti mais plus de brouillons → Steph les a supprimés :
 *    on ne les recrée pas ;
 * 4. e-mail d'échec parti → une erreur ne se réessaie pas (spec §10).
 */
export function gardeFous(e: EtatDuJour): Garde {
  if (e.existants.some((p) => p.publie && NIVEAUX_BLOQUANTS.indexOf(p.niveau_acces) !== -1)) {
    return { action: "arreter", raison: "deja_publie" };
  }
  const brouillons = e.existants.filter((p) => p.source === SOURCE_BROUILLON);
  if (brouillons.length > 0) {
    const idDe = (niveau: string): string | null => {
      for (const b of brouillons) if (b.niveau_acces === niveau) return b.id;
      return null;
    };
    return { action: "deja_prepare", idPro: idDe("PRO"), idElite: idDe("ELITE") };
  }
  if (e.pretsEnvoye) return { action: "arreter", raison: "brouillons_retires" };
  if (e.echecEnvoye) return { action: "arreter", raison: "echec_deja_signale" };
  return { action: "preparer" };
}
