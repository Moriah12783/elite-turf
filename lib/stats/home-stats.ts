/**
 * lib/stats/home-stats.ts
 *
 * Source UNIQUE des stats globales de la home (taux, courses, meilleur rapport,
 * perfs récentes). Consommée par /api/stats ET par la home en SSR (props), pour
 * que le bloc hero ne dépende plus d'un fetch client (qui échouait silencieusement
 * sur Cloudflare → affichait « … » indéfiniment). Voir docs/audit-sprint1.md P1.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { computeRecentPerf } from "@/lib/stats/recent-perf";

export interface HomeStats {
  tauxGlobal:          number;        // ex: 76
  totalPronostics:     number;        // pronostics publiés + terminés
  meilleurRapport:     number | null; // meilleur rapport_gagnant enregistré
  coursesAnalysees:    number;        // courses distinctes analysées
  roiCumule30j:        number | null; // null si aucun rapport connu
  gainsCumule30j:      number;
  pronosticsCumule30j: number;
  gagnantsRecents:     number;        // gagnants des 14 derniers jours
  tauxRecent:          number | null;
}

/** Valeurs neutres si la requête échoue (jamais d'exception remontée). */
const EMPTY: HomeStats = {
  tauxGlobal: 0, totalPronostics: 0, meilleurRapport: null, coursesAnalysees: 0,
  roiCumule30j: null, gainsCumule30j: 0, pronosticsCumule30j: 0,
  gagnantsRecents: 0, tauxRecent: null,
};

export async function getHomeStats(): Promise<HomeStats> {
  try {
    const supabase = createServiceClient();

    const [
      { data: allPronostics },
      { data: topRapport },
      { count: totalCourses },
      { data: roiData },
    ] = await Promise.all([
      supabase.from("pronostics").select("resultat").eq("publie", true).neq("resultat", "EN_ATTENTE"),
      supabase.from("pronostics").select("rapport_gagnant").eq("publie", true).eq("resultat", "GAGNANT")
        .not("rapport_gagnant", "is", null).order("rapport_gagnant", { ascending: false }).limit(1),
      supabase.from("courses").select("*", { count: "exact", head: true }),
      supabase.from("pronostics").select("resultat, gains_theoriques, rapport_gagnant")
        .eq("publie", true).neq("resultat", "EN_ATTENTE")
        .gte("date_publication", new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString())
        .limit(100),
    ]);

    const termines        = allPronostics?.length ?? 0;
    const gagnants        = allPronostics?.filter((p) => p.resultat === "GAGNANT").length ?? 0;
    const tauxGlobal      = termines > 0 ? Math.round((gagnants / termines) * 100) : 0;
    const meilleurRapport = topRapport?.[0]?.rapport_gagnant ?? null;

    const perf = computeRecentPerf(
      (roiData ?? []) as { resultat: string; gains_theoriques?: number | null; rapport_gagnant?: number | null }[],
    );

    return {
      tauxGlobal,
      totalPronostics:     termines,
      meilleurRapport,
      coursesAnalysees:    totalCourses ?? 0,
      roiCumule30j:        perf.roi,
      gainsCumule30j:      perf.gains,
      pronosticsCumule30j: perf.nb,
      gagnantsRecents:     perf.gagnants,
      tauxRecent:          perf.tauxReussite,
    };
  } catch {
    return EMPTY;
  }
}
