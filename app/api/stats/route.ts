/**
 * GET /api/stats
 * Retourne les statistiques globales crédibles pour la Hero Section.
 *
 * Stratégie "smart display" :
 *  - tauxGlobal   : taux sur TOUT l'historique (plus stable et plus élevé que le mois)
 *  - totalPronostics : nombre total de pronostics publiés + terminés
 *  - meilleurRapport : meilleur rapport_gagnant enregistré (le plus impressionnant)
 *  - coursesAnalysees : nombre de courses distinctes analysées
 *
 * Ces 4 métriques sont toujours fortes même pour un site jeune.
 * Cache 30 min côté serveur.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { computeRecentPerf } from "@/lib/stats/recent-perf";

// Pas de force-dynamic : on veut que Cloudflare CDN cache la réponse
// pendant 30min via le header Cache-Control retourné dans NextResponse.
// Évite que le worker soit invoqué à chaque pageview (limite CPU 10ms Free).
export const revalidate = 1800; // 30 min ISR fallback si force-dynamic absent

export async function GET() {
  try {
    const supabase = createServiceClient();

    const [
      { data: allPronostics },
      { data: topRapport },
      { count: totalCourses },
      { data: roiData },
    ] = await Promise.all([
      // Tous les pronostics publiés terminés (pour taux global)
      supabase
        .from("pronostics")
        .select("resultat")
        .eq("publie", true)
        .neq("resultat", "EN_ATTENTE"),

      // Meilleur rapport_gagnant enregistré
      supabase
        .from("pronostics")
        .select("rapport_gagnant")
        .eq("publie", true)
        .eq("resultat", "GAGNANT")
        .not("rapport_gagnant", "is", null)
        .order("rapport_gagnant", { ascending: false })
        .limit(1),

      // Nombre de courses distinctes analysées
      supabase
        .from("courses")
        .select("*", { count: "exact", head: true }),

      // ROI cumulé sur 14 derniers jours (réduit de 30j → 14j pour respecter
      // la limite CPU 10ms Cloudflare Workers Free). Limit 100 rows max.
      // Si on veut plus de fenêtre plus tard, créer une RPC SQL agrégée.
      supabase
        .from("pronostics")
        .select("resultat, gains_theoriques, rapport_gagnant")
        .eq("publie", true)
        .neq("resultat", "EN_ATTENTE")
        .gte("date_publication", new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString())
        .limit(100),
    ]);

    const termines        = allPronostics?.length ?? 0;
    const gagnants        = allPronostics?.filter((p) => p.resultat === "GAGNANT").length ?? 0;
    const tauxGlobal      = termines > 0 ? Math.round((gagnants / termines) * 100) : 0;
    const meilleurRapport = topRapport?.[0]?.rapport_gagnant ?? null;

    // Perfs récentes (14j). `roi` = null si AUCUN rapport connu → on ne montre
    // JAMAIS un ROI faux (ex. −100 % alors que les gagnants existent mais sans
    // dividende enregistré). `gagnants` + `taux` restent vrais en toutes circonstances.
    const perf = computeRecentPerf(
      (roiData ?? []) as { resultat: string; gains_theoriques?: number | null; rapport_gagnant?: number | null }[],
    );

    return NextResponse.json(
      {
        tauxGlobal,
        totalPronostics: termines,
        meilleurRapport,
        coursesAnalysees: totalCourses ?? 0,
        roiCumule30j: perf.roi,
        gainsCumule30j: perf.gains,
        pronosticsCumule30j: perf.nb,
        gagnantsRecents: perf.gagnants,
        tauxRecent: perf.tauxReussite,
      },
      {
        headers: {
          // Cache CDN agressif : 30min côté Cloudflare, 1h SWR.
          // Évite que /api/stats soit appelé à chaque pageview (le hero le
          // fetch côté client → CDN renvoie sans toucher au worker).
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return NextResponse.json({
      tauxGlobal: 0,
      totalPronostics: 0,
      meilleurRapport: null,
      coursesAnalysees: 0,
      roiCumule30j: null,
      gainsCumule30j: 0,
      pronosticsCumule30j: 0,
    });
  }
}
