/**
 * GET /api/stats
 * Retourne les statistiques globales crédibles pour la Hero Section.
 *
 * La logique de calcul vit désormais dans lib/stats/home-stats.ts (source
 * unique, aussi consommée par la home en SSR). Ce endpoint reste pour les
 * éventuels consommateurs externes/JS et garde son cache CDN agressif.
 */

import { NextResponse } from "next/server";
import { getHomeStats } from "@/lib/stats/home-stats";

// Pas de force-dynamic : on veut que Cloudflare CDN cache la réponse 30min via
// le header Cache-Control. Évite que le worker soit invoqué à chaque pageview.
export const revalidate = 1800; // 30 min ISR fallback

export async function GET() {
  const stats = await getHomeStats();
  return NextResponse.json(stats, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
