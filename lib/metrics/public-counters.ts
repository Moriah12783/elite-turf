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
}

const FALLBACK: PublicCounters = { guideDownloads: 75, membresInscrits: 55, communaute: 130 };

export async function getPublicCounters(): Promise<PublicCounters> {
  try {
    const supabase = createServiceClient();
    const [{ count: leads }, { count: profils }] = await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("source", "guide-gratuit"),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);
    const guideDownloads  = leads   ?? FALLBACK.guideDownloads;
    const membresInscrits = profils ?? FALLBACK.membresInscrits;
    return { guideDownloads, membresInscrits, communaute: guideDownloads + membresInscrits };
  } catch {
    return FALLBACK;
  }
}

/** Arrondi marketing bas à la dizaine : 137 → "130+" (plancher 10). */
export function roundTenPlus(n: number): string {
  return `${Math.max(10, Math.floor(n / 10) * 10)}+`;
}
