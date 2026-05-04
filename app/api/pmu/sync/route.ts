/**
 * POST /api/pmu/sync
 *
 * Synchronise le programme PMU du jour (ou d'une date) dans Supabase.
 * Appelé par :
 *  - /api/cron/pmu-sync  (cron Vercel — protégé par CRON_SECRET côté cron)
 *  - /api/admin/force-sync (admin dashboard — protégé par middleware admin)
 *
 * Body JSON optionnel : { date: "YYYYMMDD" }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchPmuProgramme, normalizePmuReunions, toDateStr } from "@/lib/pmu-api";

/** Normalise un nom d'hippodrome : sans accents, majuscules, sans espaces superflus */
function normalizeHipName(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {

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

    // ── 2. Hippodromes ── 1 SELECT bulk + 1 INSERT bulk (vs. 2N) ──────
    const hipNoms = Array.from(new Set(courses.map(c => c.hippodromeName)));
    const paysNeeded = Array.from(new Set(courses.map(c => c.hippodromePays || "France")));
    const hipMap: Record<string, string> = {};

    // a) Récupère TOUS les hippodromes des pays concernés en 1 appel
    const { data: allHip } = await supabase
      .from("hippodromes")
      .select("id, nom, pays")
      .in("pays", paysNeeded);

    // Match par nom normalisé (case + accents)
    for (const nom of hipNoms) {
      const pays = courses.find(c => c.hippodromeName === nom)?.hippodromePays || "France";
      const found = allHip?.find(h => h.pays === pays && normalizeHipName(h.nom) === normalizeHipName(nom));
      if (found) hipMap[nom] = found.id;
    }

    // b) Insère les manquants en bulk
    const missingHips = hipNoms
      .filter((nom) => !hipMap[nom])
      .map((nom) => ({
        nom,
        pays:           courses.find(c => c.hippodromeName === nom)?.hippodromePays || "France",
        ville:          nom,
        fuseau_horaire: "Europe/Paris",
        actif:          true,
      }));

    if (missingHips.length > 0) {
      const { data: insertedHips } = await supabase
        .from("hippodromes")
        .insert(missingHips)
        .select("id, nom");
      for (const hip of insertedHips ?? []) {
        hipMap[hip.nom] = hip.id;
      }
    }

    // ── 3. Courses ── 1 SELECT bulk + 1 INSERT bulk + 1 UPSERT bulk ──
    const dates  = Array.from(new Set(courses.map(c => c.dateCourse)));
    const hipIds = Object.values(hipMap);

    type ExistingCourse = {
      id: string;
      hippodrome_id:  string;
      date_course:    string;
      numero_reunion: number;
      numero_course:  number;
    };

    let existingCourses: ExistingCourse[] = [];
    if (hipIds.length > 0 && dates.length > 0) {
      const { data } = await supabase
        .from("courses")
        .select("id, hippodrome_id, date_course, numero_reunion, numero_course")
        .in("hippodrome_id", hipIds)
        .in("date_course", dates);
      existingCourses = (data as ExistingCourse[]) ?? [];
    }

    const courseKey = (hipId: string, date: string, reunion: number, course: number) =>
      `${hipId}|${date}|${reunion}|${course}`;

    const existingCourseMap = new Map<string, string>();
    for (const c of existingCourses) {
      existingCourseMap.set(
        courseKey(c.hippodrome_id, c.date_course, c.numero_reunion, c.numero_course),
        c.id
      );
    }

    const toInsert: Record<string, unknown>[] = [];
    const toUpsert: Record<string, unknown>[] = [];

    for (const c of courses) {
      const hippodromeId = hipMap[c.hippodromeName];
      if (!hippodromeId) continue;

      const existingId = existingCourseMap.get(
        courseKey(hippodromeId, c.dateCourse, c.numeroReunion, c.numeroCourse)
      );

      if (existingId) {
        toUpsert.push({
          id:                existingId,
          nb_partants:       c.nbPartants,
          libelle:           c.libelle,
          paris_disponibles: c.parisDisponibles,
        });
      } else {
        toInsert.push({
          hippodrome_id:     hippodromeId,
          date_course:       c.dateCourse,
          heure_depart:      c.heureDepart,
          numero_reunion:    c.numeroReunion,
          numero_course:     c.numeroCourse,
          libelle:           c.libelle,
          distance_metres:   c.distanceMetres,
          categorie:         c.categorie,
          nb_partants:       c.nbPartants,
          statut:            "PROGRAMME",
          paris_disponibles: c.parisDisponibles,
        });
      }
    }

    if (toInsert.length > 0) {
      await supabase.from("courses").insert(toInsert);
    }
    if (toUpsert.length > 0) {
      await supabase.from("courses").upsert(toUpsert);
    }

    const inserted = toInsert.length;
    const updated  = toUpsert.length;

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
  return NextResponse.json({ ok: true, message: "PMU Sync endpoint actif" });
}
