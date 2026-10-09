// GET /api/ticker-data
// Bandeau défilant : données RÉELLES du jour (arrivées, prochains départs,
// pronostics publiés) puis messages Elite Turf exacts. Construction pure et
// testée : lib/ticker/bandeau.ts (brief SEO du 01/10/2026, B4).
//
// Avant : les requêtes « courses du jour » demandaient des colonnes qui
// n'existent pas (`nom_course`, `nombre_partants`) et échouaient en silence ;
// les pronostics Elite et Pro d'une même course apparaissaient en double.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { todayParis } from "@/lib/seo/dates";
import { construireBandeau, MESSAGES_ELITE_TURF, type CourseBandeau } from "@/lib/ticker/bandeau";

export const dynamic = "force-dynamic";

/** Minutes écoulées depuis minuit, heure de Paris (heures de course en base). */
function minutesParis(): number {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const val = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return (val("hour") % 24) * 60 + val("minute");
}

export async function GET() {
  try {
    const supabase = createServiceClient();
    const today = todayParis();

    const [coursesRes, pronosRes] = await Promise.all([
      supabase
        .from("courses")
        .select("id, numero_reunion, numero_course, heure_depart, statut, arrivee_officielle, arrivee_rangs, nb_partants, hippodrome:hippodromes(nom)")
        .eq("date_course", today)
        .neq("statut", "ANNULE"),
      supabase
        .from("pronostics")
        .select("course_id, type_pari, resultat, date_publication")
        .eq("publie", true)
        .gte("date_publication", `${today}T00:00:00`)
        .order("date_publication", { ascending: false })
        .limit(20),
    ]);

    const courses: CourseBandeau[] = ((coursesRes.data ?? []) as any[]).map((c) => ({
      ...c,
      hippodrome: Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome,
    }));
    const items = construireBandeau({
      courses,
      pronostics: (pronosRes.data ?? []) as any[],
      maintenantMinutesParis: minutesParis(),
    });

    return NextResponse.json([...items, ...MESSAGES_ELITE_TURF]);
  } catch {
    return NextResponse.json(MESSAGES_ELITE_TURF);
  }
}
