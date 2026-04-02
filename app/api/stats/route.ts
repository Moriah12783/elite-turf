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

export const dynamic = "force-dynamic";
export const revalidate = 1800; // 30 min

export async function GET() {
  try {
    const supabase = createServiceClient();

    const [
      { data: allPronostics },
      { data: topRapport },
      { count: totalCourses },
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
    ]);

    const termines     = allPronostics?.length ?? 0;
    const gagnants     = allPronostics?.filter((p) => p.resultat === "GAGNANT").length ?? 0;
    const tauxGlobal   = termines > 0 ? Math.round((gagnants / termines) * 100) : 0;
    const meilleurRapport = topRapport?.[0]?.rapport_gagnant ?? null;

    return NextResponse.json({
      tauxGlobal,                         // ex: 76
      totalPronostics: termines,          // ex: 25
      meilleurRapport,                    // ex: 93.20
      coursesAnalysees: totalCourses ?? 0,// ex: 112
    });
  } catch {
    return NextResponse.json({
      tauxGlobal: 0,
      totalPronostics: 0,
      meilleurRapport: null,
      coursesAnalysees: 0,
    });
  }
}
