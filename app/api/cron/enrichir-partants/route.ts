/**
 * GET /api/cron/enrichir-partants
 *
 * Cron Vercel — déclenché à 9h UTC (10h Paris) chaque jour.
 * Enrichit les partants de toutes les courses du jour (France + Maroc)
 * avec les données PMU : cotes, musique, poids, jockey.
 *
 * Priorité aux courses vedettes (Quinté+) puis les autres.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchPmuPartants } from "@/lib/pmu-api";

export const dynamic  = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  // Auth cron
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase   = createServiceClient();
  const today      = new Date().toISOString().split("T")[0];
  const dateStr    = today.replace(/-/g, "");

  // 1. Récupérer les courses du jour non encore enrichies (pas de partants en DB)
  const { data: courses } = await supabase
    .from("courses")
    .select("id, numero_reunion, numero_course, libelle, statut")
    .eq("date_course", today)
    .neq("statut", "ANNULE");

  if (!courses || courses.length === 0) {
    return NextResponse.json({ ok: true, message: "Aucune course à enrichir", date: today });
  }

  // 2. Identifier les courses déjà enrichies (partants avec musique en DB)
  const { data: enrichies } = await supabase
    .from("partants")
    .select("course_id")
    .in("course_id", courses.map(c => c.id))
    .not("musique", "is", null);

  const enrichieIds = new Set((enrichies ?? []).map(p => p.course_id));

  // 3. Courses à enrichir (non encore traitées)
  const aEnrichir = courses.filter(c => !enrichieIds.has(c.id));

  if (aEnrichir.length === 0) {
    return NextResponse.json({
      ok:      true,
      message: "Toutes les courses sont déjà enrichies",
      date:    today,
      total:   courses.length,
    });
  }

  const results: Array<{ courseId: string; libelle: string; status: string; nb?: number }> = [];

  // 4. Enrichir chaque course
  for (const course of aEnrichir) {
    try {
      const participants = await fetchPmuPartants(
        dateStr,
        course.numero_reunion,
        course.numero_course,
      );

      if (!participants || participants.length === 0) {
        results.push({ courseId: course.id, libelle: course.libelle, status: "no_data" });
        continue;
      }

      const toInsert = participants
        .filter((p) => !p.nom?.toUpperCase().includes("NON_PARTANT"))
        .map((p) => ({
          course_id:   course.id,
          numero:      p.numPmu,
          nom_cheval:  p.nom,
          jockey:      p.jockey?.nom ?? null,
          entraineur:  p.entraineur?.nom ?? null,
          cote:        p.coteDefinitive ?? p.coteProbable ?? p.dernierRapportDirect?.rapport ?? null,
          musique:     p.musique ?? null,
          poids_kg:    p.handicapPoids ?? p.poids ?? null,
          place_corde: p.placeCorde ?? null,
          age:         p.age ?? null,
          sexe:        p.sexe ?? null,
          non_partant: false,
          scraped_at:  new Date().toISOString(),
        }));

      // Supprimer anciens partants sans musique + réinsérer
      await supabase.from("partants").delete().eq("course_id", course.id);
      const { error } = await supabase.from("partants").insert(toInsert);

      if (error) {
        results.push({ courseId: course.id, libelle: course.libelle, status: `error: ${error.message}` });
      } else {
        // Mettre à jour nb_partants
        await supabase
          .from("courses")
          .update({ nb_partants: toInsert.length })
          .eq("id", course.id);

        results.push({ courseId: course.id, libelle: course.libelle, status: "ok", nb: toInsert.length });
      }

      // Petite pause pour ne pas saturer l'API PMU
      await new Promise((r) => setTimeout(r, 200));

    } catch (err: any) {
      results.push({ courseId: course.id, libelle: course.libelle, status: `exception: ${err?.message}` });
    }
  }

  const enrichis  = results.filter(r => r.status === "ok").length;
  const noData    = results.filter(r => r.status === "no_data").length;
  const erreurs   = results.filter(r => r.status.startsWith("error") || r.status.startsWith("exception")).length;

  console.log(`[enrichir-partants] ${today} → ${enrichis} enrichies, ${noData} sans données, ${erreurs} erreurs`);

  return NextResponse.json({
    ok:       true,
    date:     today,
    total:    courses.length,
    enrichis,
    noData,
    erreurs,
    details:  results,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
