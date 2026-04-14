/**
 * GET /api/cron/pronostic-gratuit
 *
 * Cron Vercel — déclenché à 7h UTC (≈ 8h Paris) chaque matin.
 *
 * Algorithme :
 * 1. Vérifie qu'aucun pronostic GRATUIT n'est déjà publié aujourd'hui.
 * 2. Sélectionne la meilleure course du jour (Tiercé, 8-12 partants, après-midi).
 * 3. Choisit les 5 chevaux favoris selon la cote PMU.
 * 4. Génère une brève analyse automatique.
 * 5. Publie le pronostic (niveau_acces = GRATUIT, publie = true).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logCronStart } from "@/lib/cron-logger";
import { scoreCourse, buildSelection, generateAnalyse } from "@/lib/pronostic-gratuit";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || "https://www.elite-turf.fr";

function getTodayParis(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()).split("/").reverse().join("-");
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logger = logCronStart("pronostic-gratuit");

  try {
    const supabase = createServiceClient();
    const today    = getTodayParis();

    // ── 1. Déjà publié aujourd'hui ? ────────────────────────────────
    const { data: existing } = await supabase
      .from("pronostics")
      .select("id")
      .eq("niveau_acces", "GRATUIT")
      .eq("publie", true)
      .gte("date_publication", today)
      .maybeSingle();

    if (existing) {
      await logger.finish("skip", { reason: "Pronostic gratuit déjà publié aujourd'hui", id: existing.id });
      return NextResponse.json({ ok: true, skipped: true, reason: "already_published" });
    }

    // ── 2. Courses du jour éligibles ─────────────────────────────────
    const { data: courses } = await supabase
      .from("courses")
      .select(`
        id, libelle, date_course, heure_depart,
        numero_reunion, numero_course,
        nb_partants, paris_disponibles,
        categorie, terrain, distance_metres,
        hippodrome:hippodromes(id, nom, pays)
      `)
      .eq("date_course", today)
      .in("statut", ["PROGRAMME", "EN_COURS"])
      .not("paris_disponibles", "is", null);

    if (!courses?.length) {
      await logger.finish("skip", { reason: "Aucune course aujourd'hui" });
      return NextResponse.json({ ok: true, skipped: true, reason: "no_courses" });
    }

    // ── 3. Filtrer celles avec Tiercé ────────────────────────────────
    const eligible = courses.filter((c: any) => {
      const paris: string[] = c.paris_disponibles || [];
      return paris.includes("TIERCE") || paris.includes("TIERCE_ORDRE");
    });

    if (!eligible.length) {
      await logger.finish("skip", { reason: "Aucune course Tiercé disponible", total: courses.length });
      return NextResponse.json({ ok: true, skipped: true, reason: "no_tierce" });
    }

    // ── 4. Scorer et choisir la meilleure ────────────────────────────
    const scored = eligible
      .map((c: any) => ({ course: c, score: scoreCourse(c) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0].course;

    // ── 5. Partants de la course choisie ─────────────────────────────
    const { data: partants } = await supabase
      .from("partants")
      .select("id, numero, nom_cheval, jockey, cote, non_partant")
      .eq("course_id", best.id)
      .eq("non_partant", false)
      .order("numero", { ascending: true });

    if (!partants?.length) {
      await logger.finish("skip", { reason: "Aucun partant pour la course sélectionnée", course_id: best.id });
      return NextResponse.json({ ok: true, skipped: true, reason: "no_partants" });
    }

    // ── 6. Sélection des 5 chevaux ───────────────────────────────────
    const selection = buildSelection(partants);

    if (selection.length < 3) {
      await logger.finish("skip", { reason: "Pas assez de partants", count: selection.length });
      return NextResponse.json({ ok: true, skipped: true, reason: "not_enough_partants" });
    }

    // ── 7. Analyse automatique ───────────────────────────────────────
    const analyse_courte = generateAnalyse(best, partants, selection);

    // ── 8. Publier via l'API admin ───────────────────────────────────
    const res = await fetch(`${APP_URL}/api/admin/pronostic-gratuit`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({
        course_id:     best.id,
        selection,
        analyse_courte,
        confiance:     3,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      await logger.finish("failure", { error: data?.error ?? `HTTP ${res.status}`, course: best.libelle });
      return NextResponse.json({ error: data?.error }, { status: 500 });
    }

    await logger.finish("success", {
      pronostic_id: data.pronostic_id,
      course:       best.libelle,
      hippodrome:   (best as any).hippodrome?.nom,
      selection,
      score:        scored[0].score,
    });

    return NextResponse.json({ ok: true, pronostic_id: data.pronostic_id, course: best.libelle });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    await logger.finish("failure", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
