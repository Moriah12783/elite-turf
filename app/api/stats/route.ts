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

      // ROI cumulé sur 30 derniers jours : gains théoriques d'un parieur
      // qui aurait suivi tous nos pronostics publiés (mise unitaire 1€)
      supabase
        .from("pronostics")
        .select("resultat, gains_theoriques, rapport_gagnant, date_publication")
        .eq("publie", true)
        .neq("resultat", "EN_ATTENTE")
        .gte("date_publication", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
        .limit(500),
    ]);

    const termines        = allPronostics?.length ?? 0;
    const gagnants        = allPronostics?.filter((p) => p.resultat === "GAGNANT").length ?? 0;
    const tauxGlobal      = termines > 0 ? Math.round((gagnants / termines) * 100) : 0;
    const meilleurRapport = topRapport?.[0]?.rapport_gagnant ?? null;

    // ROI cumulé 30j : somme(gains_theoriques) - somme(mises 1€).
    // Si gains_theoriques absent, fallback sur rapport_gagnant pour les GAGNANT.
    const list30j   = roiData ?? [];
    const nb30j     = list30j.length;
    const totalGains = list30j.reduce((acc: number, p: any) => {
      if (p.resultat === "GAGNANT") {
        const gain = p.gains_theoriques ?? p.rapport_gagnant ?? 0;
        return acc + (typeof gain === "number" ? gain : 0);
      }
      if (p.resultat === "PARTIEL") {
        // Estimation 30 % du rapport gagnant pour partiels
        const gain = (p.gains_theoriques ?? p.rapport_gagnant ?? 0) * 0.3;
        return acc + (typeof gain === "number" ? gain : 0);
      }
      return acc;
    }, 0);
    // ROI = (gains - mises) / mises * 100, avec mise de 1€/pronostic
    const totalMises = nb30j;
    const roiCumule30j = totalMises > 0
      ? Math.round(((totalGains - totalMises) / totalMises) * 100)
      : null;

    return NextResponse.json({
      tauxGlobal,                          // ex: 76
      totalPronostics: termines,           // ex: 25
      meilleurRapport,                     // ex: 93.20
      coursesAnalysees: totalCourses ?? 0, // ex: 112
      // Nouveaux champs : ROI 30j pour hero "ROI cumulé live"
      roiCumule30j,                        // ex: +156 (pourcentage) ou null si <5 pronostics
      gainsCumule30j: Math.round(totalGains * 100) / 100, // ex: 280.50
      pronosticsCumule30j: nb30j,          // ex: 18
    });
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
