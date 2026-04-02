/**
 * GET /api/stats
 * Retourne les statistiques globales temps réel depuis Supabase :
 *  - taux de réussite du mois en cours
 *  - nombre de membres actifs
 *  - nombre d'abonnés Premium/VIP
 * Utilisé par HeroSection pour remplacer les valeurs hardcodées.
 * Cache 30 minutes (revalidate).
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 1800; // 30 min

export async function GET() {
  try {
    const supabase = createServiceClient();

    const now = new Date();
    const moisDebut = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      { data: pronosMois },
      { count: totalMembers },
      { count: premiumMembers },
    ] = await Promise.all([
      // Pronostics du mois courant terminés
      supabase
        .from("pronostics")
        .select("resultat")
        .eq("publie", true)
        .neq("resultat", "EN_ATTENTE")
        .gte("date_publication", moisDebut),

      // Membres actifs total
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("actif", true),

      // Abonnés Premium + VIP
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .in("statut_abonnement", ["PREMIUM", "VIP"]),
    ]);

    const termines  = pronosMois?.length ?? 0;
    const gagnants  = pronosMois?.filter((p) => p.resultat === "GAGNANT").length ?? 0;
    const tauxMois  = termines > 0 ? Math.round((gagnants / termines) * 100) : 0;

    return NextResponse.json({
      tauxMois,          // ex: 76
      totalMembers:  totalMembers  ?? 0,
      premiumMembers: premiumMembers ?? 0,
    });
  } catch {
    // Fallback silencieux — le front affichera ses valeurs par défaut
    return NextResponse.json({ tauxMois: 0, totalMembers: 0, premiumMembers: 0 });
  }
}
