/**
 * POST /api/lonaci/sync  (v2)
 *
 * Synchronise le programme LONACI du jour dans Supabase.
 * - Insère les hippodromes manquants
 * - Insère ou met à jour toutes les courses disponibles sur LONACI
 * - Marque les Nationales 1/2/3 avec paris_disponibles correct
 *
 * Header requis : Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  fetchLonaciProgramme,
  normalizeLonaciReunions,
} from "@/lib/lonaci-api";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    // ── 1. Fetch LONACI ───────────────────────────────────────────────
    const reunions = await fetchLonaciProgramme();
    const courses  = normalizeLonaciReunions(reunions);

    if (!courses.length) {
      return NextResponse.json({
        ok: true,
        message: "Aucune course LONACI trouvée",
        inserted: 0,
        updated: 0,
      });
    }

    // ── 2. Hippodromes ────────────────────────────────────────────────
    const hipMap: Record<string, string> = {};
    const hipNoms = [...new Set(courses.map(c => c.hippodrome))];

    for (const nom of hipNoms) {
      const pays = courses.find(c => c.hippodrome === nom)?.pays || "France";

      const { data: existing } = await supabase
        .from("hippodromes")
        .select("id")
        .eq("nom", nom)
        .single();

      if (existing) {
        hipMap[nom] = existing.id;
      } else {
        const { data: inserted } = await supabase
          .from("hippodromes")
          .insert({ nom, pays, ville: nom, fuseau_horaire: "Europe/Paris", actif: true })
          .select("id")
          .single();
        if (inserted) hipMap[nom] = inserted.id;
      }
    }

    // ── 3. Courses ────────────────────────────────────────────────────
    let inserted = 0;
    let updated  = 0;

    for (const c of courses) {
      const hippodromeId = hipMap[c.hippodrome];
      if (!hippodromeId) continue;

      // Chercher la course existante
      const { data: existing } = await supabase
        .from("courses")
        .select("id, paris_disponibles")
        .eq("hippodrome_id", hippodromeId)
        .eq("date_course", c.dateCourse)
        .eq("numero_reunion", c.nReunion)
        .eq("numero_course", c.numeroCourse)
        .single();

      if (existing) {
        // Mettre à jour paris_disponibles + nb_partants
        await supabase
          .from("courses")
          .update({
            paris_disponibles: c.parisDisponibles,
            nb_partants: c.nbPartants || existing.id,
            libelle: c.libelle,
          })
          .eq("id", existing.id);
        updated++;
      } else {
        // Insérer la nouvelle course
        await supabase.from("courses").insert({
          hippodrome_id:    hippodromeId,
          date_course:      c.dateCourse,
          heure_depart:     c.heureDepart,
          numero_reunion:   c.nReunion,
          numero_course:    c.numeroCourse,
          libelle:          c.libelle,
          distance_metres:  c.distance,
          categorie:        "PLAT",   // LONACI ne distingue pas encore
          nb_partants:      c.nbPartants,
          statut:           "PROGRAMME",
          paris_disponibles: c.parisDisponibles,
        });
        inserted++;
      }
    }

    // ── 4. Stats ──────────────────────────────────────────────────────
    const nationales = courses.filter(c => c.nationale > 0);
    console.log(`[LONACI Sync] ${courses.length} courses, ${nationales.length} nationales → ${inserted} insérées, ${updated} màj`);

    return NextResponse.json({
      ok:         true,
      date:       courses[0]?.dateCourse,
      total:      courses.length,
      nationales: nationales.map(c => ({
        nationale:   c.nationale,
        hippodrome:  c.hippodrome,
        reunion:     c.nReunion,
        course:      c.numeroCourse,
        libelle:     c.libelle,
        heure:       c.heureDepart,
      })),
      inserted,
      updated,
    });

  } catch (err: any) {
    console.error("[LONACI Sync] Erreur :", err?.message);
    return NextResponse.json(
      { error: err?.message || "Erreur inconnue" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, message: "LONACI Sync endpoint actif" });
}
