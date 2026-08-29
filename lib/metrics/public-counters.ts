/**
 * lib/metrics/public-counters.ts
 *
 * Compteurs publics RÉELS (preuve sociale) — SOURCE UNIQUE.
 * Voir docs/audit-sprint1.md P5 : le placeholder « 847 » était dupliqué sur
 * 5 surfaces (abonnés, téléchargements, parieurs formés, turfistes…).
 *
 * Décision Sprint 1 : brancher au réel —
 *   - guideDownloads : COUNT(leads, source='guide-gratuit')
 *   - membresInscrits: COUNT(profiles)
 *   - communaute     : inscrits + lecteurs du guide (métrique « turfistes »)
 *
 * Requêtes head/count (très légères) ; les pages appelantes sont en ISR.
 * Fallbacks chiffrés conservateurs si la requête échoue (jamais de « … »).
 */

import { createServiceClient } from "@/lib/supabase/server";

export interface PublicCounters {
  /** Téléchargements du guide gratuit (table leads). */
  guideDownloads: number;
  /** Profils inscrits sur le site. */
  membresInscrits: number;
  /** Communauté = inscrits + lecteurs du guide. */
  communaute: number;
  /**
   * Pronostics GAGNANTS, en % des pronostics publiés et résultés.
   * `null` sous 20 pronostics résultés : on n'annonce pas un taux sur un
   * échantillon trop mince — mieux vaut ne rien dire que dire du fragile.
   */
  tauxGagnant: number | null;
  /** Nombre de pronostics résultés sur lequel `tauxGagnant` est calculé. */
  pronosticsResultes: number;
}

const FALLBACK: PublicCounters = {
  guideDownloads: 75, membresInscrits: 55, communaute: 130,
  // Pas de repli chiffré sur la performance : inventer un taux de réussite
  // serait exactement ce que la ligne anti-fabrication interdit. En cas
  // d'échec de la requête, on n'affiche AUCUN chiffre.
  tauxGagnant: null, pronosticsResultes: 0,
};

export async function getPublicCounters(): Promise<PublicCounters> {
  try {
    const supabase = createServiceClient();
    const [{ count: leads }, { count: profils }, { data: resultats }] = await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("source", "guide-gratuit"),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      // Même définition que le titre de /pronostics : publiés ET résultés.
      supabase.from("pronostics").select("resultat").eq("publie", true).neq("resultat", "EN_ATTENTE"),
    ]);
    const guideDownloads  = leads   ?? FALLBACK.guideDownloads;
    const membresInscrits = profils ?? FALLBACK.membresInscrits;

    const lignes = resultats || [];
    const pronosticsResultes = lignes.length;
    let gagnants = 0;
    for (let i = 0; i < lignes.length; i++) {
      if ((lignes[i] as { resultat?: string }).resultat === "GAGNANT") gagnants++;
    }
    const tauxGagnant = pronosticsResultes >= 20
      ? Math.round((gagnants / pronosticsResultes) * 100)
      : null;

    return { guideDownloads, membresInscrits, communaute: guideDownloads + membresInscrits, tauxGagnant, pronosticsResultes };
  } catch {
    return FALLBACK;
  }
}

/** Arrondi marketing bas à la dizaine : 137 → "130+" (plancher 10). */
export function roundTenPlus(n: number): string {
  return `${Math.max(10, Math.floor(n / 10) * 10)}+`;
}
