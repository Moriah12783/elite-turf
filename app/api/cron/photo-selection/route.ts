/**
 * GET /api/cron/photo-selection
 *
 * Toutes les 5 min (elite-turf-crons, minutes 2, 7, … 57). Pour chaque course du
 * jour qui part dans 5 à 15 minutes et n'a pas encore de photo : fige la
 * « Sélection stats » telle qu'un visiteur la voit (lib/selection/preparer.ts,
 * cotes du moment comprises) dans `selection_photos`. Le bilan
 * (/admin/bilan-selection) se calcule sur ces photos, jamais sur des cotes
 * relevées après coup.
 *
 * Coût Cloudflare : 3 requêtes communes + 3 par course (stats enrichies), au plus
 * MAX_COURSES courses par passage → bien sous la limite de 50 sous-requêtes.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logCronStart } from "@/lib/cron-logger";
import { todayParisISO, parisVersUtc } from "@/lib/paris-date";
import { fetchPmuCotesMap } from "@/lib/cotes/pmu-csv";
import { preparerSelection } from "@/lib/selection/preparer";
import { fenetrePhoto, cotesMarche } from "@/lib/selection/photo";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const VERSION     = "v2";
const MAX_COURSES = 8;

function estFrance(c: any): boolean {
  const h = Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome;
  return !h?.pays || h.pays === "France";
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret || (req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronLog    = logCronStart("photo-selection");
  const supabase   = createServiceClient();
  const maintenant = Date.now();
  const jour       = todayParisISO();

  try {
    const { data: courses, error } = await supabase
      .from("courses")
      .select("id, date_course, heure_depart, numero_reunion, numero_course, hippodrome:hippodromes(pays)")
      .eq("date_course", jour)
      .not("heure_depart", "is", null);
    if (error) throw new Error(`courses : ${error.message}`);

    const cibles = (courses ?? [])
      .map((c: any) => ({ ...c, depart: parisVersUtc(c.date_course, c.heure_depart) }))
      .filter((c: any) => fenetrePhoto(c.depart, maintenant));
    if (cibles.length === 0) {
      await cronLog.finish("skip", { reason: "aucune course dans 5 à 15 min", jour });
      return NextResponse.json({ ok: true, photos: 0 });
    }

    const { data: deja, error: dejaErr } = await supabase
      .from("selection_photos")
      .select("course_id")
      .eq("version", VERSION)
      .in("course_id", cibles.map((c: any) => c.id));
    if (dejaErr) throw new Error(`photos existantes : ${dejaErr.message}`);
    const dejaIds  = new Set((deja ?? []).map((d: any) => d.course_id));
    const restantes = cibles.filter((c: any) => !dejaIds.has(c.id)).slice(0, MAX_COURSES);
    if (restantes.length === 0) {
      await cronLog.finish("skip", { reason: "courses déjà photographiées", jour, cibles: cibles.length });
      return NextResponse.json({ ok: true, photos: 0 });
    }

    const { data: partants, error: pErr } = await supabase
      .from("partants")
      .select("id, course_id, numero, nom_cheval, jockey, entraineur, cote, musique, poids_kg, non_partant")
      .in("course_id", restantes.map((c: any) => c.id));
    if (pErr) throw new Error(`partants : ${pErr.message}`);

    // Cotes du moment : le CSV PMU de l'Apps Script, rafraîchi chaque minute avant le départ.
    const csv = restantes.some(estFrance) ? await fetchPmuCotesMap(jour, 10_000) : null;

    const lignes: Array<Record<string, unknown>> = [];
    let sansSelection = 0;
    for (const c of restantes) {
      const prep = await preparerSelection(
        (partants ?? []).filter((p: any) => p.course_id === c.id),
        c,
        estFrance(c) ? csv : null,
      );
      if (prep.selection.length === 0) { sansSelection++; continue; }
      lignes.push({
        course_id:    c.id,
        version:      VERSION,
        depart_prevu: c.depart ? c.depart.toISOString() : null,
        numeros:      prep.selection.map((s) => s.numero),
        cotes_marche: cotesMarche(prep.partants),
        source_cotes: prep.sourceCotes,
        nb_partants:  prep.partants.length,
      });
    }

    if (lignes.length > 0) {
      const { error: insErr } = await supabase
        .from("selection_photos")
        .upsert(lignes, { onConflict: "course_id,version", ignoreDuplicates: true });
      if (insErr) throw new Error(`insertion : ${insErr.message}`);
    }

    await cronLog.finish("success", { jour, photos: lignes.length, sans_selection: sansSelection, cotes_csv: csv ? csv.size : 0 });
    return NextResponse.json({ ok: true, photos: lignes.length, sansSelection });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await cronLog.finish("failure", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
