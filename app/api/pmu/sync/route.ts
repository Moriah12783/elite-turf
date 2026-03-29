/**
 * POST /api/pmu/sync
 *
 * Synchronise le programme PMU du jour (ou d'une date) dans Supabase.
 * Appelé automatiquement par le cron job à 06h00 et toutes les 30 min.
 *
 * Body JSON optionnel : { date: "YYYYMMDD" }
 * Header requis       : Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchPmuProgramme, normalizePmuReunions, toDateStr } from "@/lib/pmu-api";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Date cible ──────────────────────────────────────────────────────
  let dateStr: string;
  try {
    const body = await req.json().catch(() => ({}));
    dateStr = body?.date || toDateStr();
  } catch {
    dateStr = toDateStr();
  }

  const supabase = createServiceClient();

  try {
    // ── 1. Fetch PMU ──────────────────────────────────────────────────
    const reunions = await fetchPmuProgramme(dateStr);
    const courses  = normalizePmuReunions(reunions);

    if (!courses.length) {
      return NextResponse.json({
        ok: true,
        message: `Aucune course PMU trouvée pour le ${dateStr}`,
        inserted: 0,
      });
    }

    // ── 2. Hippodromes ────────────────────────────────────────────────
    const hipNoms = Array.from(new Set(courses.map(c => c.hippodromeName)));
    const hipMap: Record<string, string> = {};

    for (const nom of hipNoms) {
      const pays = courses.find(c => c.hippodromeName === nom)?.hippodromePays || "France";

      // Upsert hippodrome (chercher par nom)
      const { data: existing } = await supabase
        .from("hippodromes")
        .select("id, nom")
        .eq("nom", nom)
        .single();

      if (existing) {
        hipMap[nom] = existing.id;
      } else {
        const { data: inserted } = await supabase
          .from("hippodromes")
          .insert({
            nom,
            pays,
            ville:          nom,
            fuseau_horaire: "Europe/Paris",
            actif:          true,
          })
          .select("id")
          .single();
        if (inserted) hipMap[nom] = inserted.id;
      }
    }

    // ── 3. Courses ────────────────────────────────────────────────────
    let inserted = 0;
    let updated  = 0;

    for (const c of courses) {
      const hippodromeId = hipMap[c.hippodromeName];
      if (!hippodromeId) continue;

      // Vérifier si la course existe déjà
      const { data: existing } = await supabase
        .from("courses")
        .select("id")
        .eq("hippodrome_id", hippodromeId)
        .eq("date_course", c.dateCourse)
        .eq("numero_reunion", c.numeroReunion)
        .eq("numero_course", c.numeroCourse)
        .single();

      if (existing) {
        // Mettre à jour nb_partants, libelle et paris_disponibles
        await supabase
          .from("courses")
          .update({
            nb_partants:       c.nbPartants,
            libelle:           c.libelle,
            paris_disponibles: c.parisDisponibles,
          })
          .eq("id", existing.id);
        updated++;
      } else {
        await supabase.from("courses").insert({
          hippodrome_id:    hippodromeId,
          date_course:      c.dateCourse,
          heure_depart:     c.heureDepart,
          numero_reunion:   c.numeroReunion,
          numero_course:    c.numeroCourse,
          libelle:          c.libelle,
          distance_metres:  c.distanceMetres,
          categorie:        c.categorie,
          nb_partants:      c.nbPartants,
          statut:           "PROGRAMME",
          paris_disponibles: c.parisDisponibles,
        });
        inserted++;
      }
    }

    // ── 4. Log ────────────────────────────────────────────────────────
    console.log(`[PMU Sync] ${dateStr} → ${inserted} insérées, ${updated} mises à jour`);

    return NextResponse.json({
      ok:       true,
      date:     dateStr,
      reunions: reunions.length,
      courses:  courses.length,
      inserted,
      updated,
    });

  } catch (err: any) {
    console.error("[PMU Sync] Erreur :", err?.message);
    return NextResponse.json(
      { error: err?.message || "Erreur inconnue" },
      { status: 500 }
    );
  }
}

/** GET pour vérification rapide (ex: cron ping) */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, message: "PMU Sync endpoint actif" });
}
