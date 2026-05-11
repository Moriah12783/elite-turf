/**
 * POST /api/admin/backfill-rapport-gagnant?days=90&dry=0
 *
 * Calcule et persiste le `rapport_gagnant` (€) pour tous les pronostics
 * GAGNANT / PARTIEL des N derniers jours qui ont une entrée `arrivees`
 * avec `rapports_pmu` rempli, mais dont `pronostics.rapport_gagnant` est null.
 *
 * Utilise lib/pmu-rapports-gagnant.computeRapportGagnant() pour mapper
 * type_pari → clé JSONB → montant.
 *
 * Auth : Bearer CRON_SECRET OU session admin (cookie).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";
import {
  computeRapportGagnant,
  type PronosticResultat,
} from "@/lib/pmu-rapports-gagnant";
import type { RapportsPMU } from "@/lib/sync/geny-rapports-parser";

export const dynamic     = "force-dynamic";
export const maxDuration = 120;

interface ProcessOutcome {
  pronosticId: string;
  libelle:     string | null;
  typePari:    string | null;
  resultat:    string | null;
  rapportNew:  number | null;
  reason?:     string;
  ok:          boolean;
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get("days") ?? "90", 10) || 90));
  const dry  = url.searchParams.get("dry") === "1";
  const includeAll = url.searchParams.get("all") === "1"; // si =1, ne skip pas ceux déjà remplis

  const supabase = createServiceClient();

  const dateFrom = new Date(Date.now() - days * 24 * 3600 * 1000)
    .toISOString().split("T")[0];

  // 1. Pull tous les pronostics GAGNANT/PARTIEL de la fenêtre
  //    avec leurs courses + arrivees JOINT par course_id.
  const { data: pronostics, error: pronoErr } = await supabase
    .from("pronostics")
    .select(`
      id, type_pari, resultat, rapport_gagnant,
      course:courses(
        id, libelle, date_course,
        arrivees(rapports_pmu)
      )
    `)
    .eq("publie", true)
    .in("resultat", ["GAGNANT", "PARTIEL"])
    .gte("date_publication", `${dateFrom}T00:00:00.000Z`);

  if (pronoErr) {
    return NextResponse.json({ error: pronoErr.message }, { status: 500 });
  }

  const outcomes: ProcessOutcome[] = [];

  for (const p of pronostics ?? []) {
    const course = Array.isArray(p.course) ? p.course[0] : p.course;
    const arrivee = course?.arrivees
      ? (Array.isArray(course.arrivees) ? course.arrivees[0] : course.arrivees)
      : null;
    const rapports = (arrivee?.rapports_pmu ?? null) as RapportsPMU | null;

    // Skip ceux déjà remplis sauf si all=1
    if (!includeAll && p.rapport_gagnant != null) {
      outcomes.push({
        pronosticId: p.id,
        libelle:     course?.libelle ?? null,
        typePari:    p.type_pari,
        resultat:    p.resultat,
        rapportNew:  null,
        reason:      "already filled",
        ok:          false,
      });
      continue;
    }

    if (!rapports) {
      outcomes.push({
        pronosticId: p.id,
        libelle:     course?.libelle ?? null,
        typePari:    p.type_pari,
        resultat:    p.resultat,
        rapportNew:  null,
        reason:      "no rapports JSONB",
        ok:          false,
      });
      continue;
    }

    const rapport = computeRapportGagnant(
      p.type_pari,
      p.resultat as PronosticResultat,
      rapports,
    );

    if (rapport == null) {
      outcomes.push({
        pronosticId: p.id,
        libelle:     course?.libelle ?? null,
        typePari:    p.type_pari,
        resultat:    p.resultat,
        rapportNew:  null,
        reason:      "no applicable rapport",
        ok:          false,
      });
      continue;
    }

    if (!dry) {
      const { error: updateErr } = await supabase
        .from("pronostics")
        .update({ rapport_gagnant: rapport })
        .eq("id", p.id);
      if (updateErr) {
        outcomes.push({
          pronosticId: p.id,
          libelle:     course?.libelle ?? null,
          typePari:    p.type_pari,
          resultat:    p.resultat,
          rapportNew:  rapport,
          reason:      `update failed: ${updateErr.message}`,
          ok:          false,
        });
        continue;
      }
    }

    outcomes.push({
      pronosticId: p.id,
      libelle:     course?.libelle ?? null,
      typePari:    p.type_pari,
      resultat:    p.resultat,
      rapportNew:  rapport,
      ok:          true,
    });
  }

  const summary = {
    total:       outcomes.length,
    filled:      outcomes.filter((o) => o.ok).length,
    skipped:     outcomes.filter((o) => !o.ok && o.reason === "already filled").length,
    noRapports:  outcomes.filter((o) => !o.ok && o.reason === "no rapports JSONB").length,
    noMatching:  outcomes.filter((o) => !o.ok && o.reason === "no applicable rapport").length,
    failed:      outcomes.filter((o) => !o.ok && o.reason?.startsWith("update failed")).length,
    sumGains:    outcomes
      .filter((o) => o.ok && typeof o.rapportNew === "number")
      .reduce((acc, o) => acc + (o.rapportNew ?? 0), 0),
  };

  return NextResponse.json({
    ok:        true,
    dry,
    days,
    includeAll,
    dateFrom,
    summary,
    outcomes:  outcomes.slice(0, 50), // limite pour ne pas exploser la réponse
    timestamp: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
