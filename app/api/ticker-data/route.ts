// GET /api/ticker-data
// Retourne les arrivées PMU du jour pour le TickerBar.
// Priorise les données réelles depuis Supabase, fallback sur pronostics publiés.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 900; // 15 min

export async function GET() {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  try {
    // 1. Chercher les arrivées réelles du jour
    const { data: arrivees } = await supabase
      .from("arrivees")
      .select(`
        ordre_arrivee,
        course:course_id(
          numero_reunion, numero_course,
          hippodrome:hippodromes(nom)
        )
      `)
      .gte("horodatage", `${today}T00:00:00`)
      .order("horodatage", { ascending: false })
      .limit(10);

    if (arrivees?.length) {
      return NextResponse.json(
        arrivees.map((a: any) => ({
          label:  `R${a.course?.numero_reunion} ${a.course?.hippodrome?.nom || "PMU"}`,
          result: `Arrivée : ${(a.ordre_arrivee as number[]).slice(0, 5).join(" - ")}`,
          status: "win",
        }))
      );
    }

    // 2. Fallback : pronostics gagnants récents
    const { data: pronostics } = await supabase
      .from("pronostics")
      .select(`
        type_pari, arrivee_reelle, selection, resultat,
        course:courses(
          numero_reunion,
          hippodrome:hippodromes(nom)
        )
      `)
      .eq("publie", true)
      .neq("resultat", "EN_ATTENTE")
      .order("date_publication", { ascending: false })
      .limit(8);

    if (pronostics?.length) {
      const BET_LABELS: Record<string, string> = {
        QUINTE_PLUS: "Quinté+",
        QUARTE:      "Quarté+",
        TIERCE:      "Tiercé",
        SIMPLE:      "Simple",
        COUPLE:      "Couplé",
        TRIO:        "Trio",
      };
      return NextResponse.json(
        pronostics.map((p: any) => {
          const arrivee = Array.isArray(p.arrivee_reelle) ? p.arrivee_reelle.join(" - ") : null;
          const sel = Array.isArray(p.selection) ? p.selection.join(" - ") : "—";
          return {
            label:  `R${p.course?.numero_reunion || "?"} ${p.course?.hippodrome?.nom || "PMU"}`,
            result: arrivee
              ? `${BET_LABELS[p.type_pari] || p.type_pari} : ${arrivee}`
              : `${BET_LABELS[p.type_pari] || p.type_pari} : Sélection ${sel}`,
            status: p.resultat === "GAGNANT" ? "win" : p.resultat === "PARTIEL" ? "partial" : "pending",
          };
        })
      );
    }

    // 3. Aucune donnée disponible
    return NextResponse.json([]);

  } catch {
    return NextResponse.json([]);
  }
}
