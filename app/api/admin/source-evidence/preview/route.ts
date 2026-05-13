/**
 * GET /api/admin/source-evidence/preview
 *
 * Endpoint admin pour PRÉVISUALISER la collecte de preuves source sans
 * écrire en BDD. Utile pour :
 *   - Tester le matching LONACI avant le 1er run prod
 *   - Diagnostiquer pourquoi une course est MISSING dans LONACI
 *   - Comparer programme BDD vs programme LONACI
 *
 * 🔐 Auth : Bearer CRON_SECRET OU session admin
 *
 * 📊 Query params :
 *   - date=YYYY-MM-DD    (défaut = aujourd'hui Paris)
 *   - apply=1            → exécute réellement (équivalent au cron)
 *
 * 📦 Response : identique à `collectSourceEvidenceForDate` mais en JSON pretty.
 *
 * 🚨 IMPORTANT : sans `apply=1`, cette route NE FAIT AUCUNE ÉCRITURE BDD.
 *   C'est le mode "dry-run" pour debug.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";
import { todayParisISO } from "@/lib/paris-date";
import {
  collectSourceEvidenceForDate,
  fetchLonaciActiveGames,
} from "@/lib/ai-pronostics/source-crawlers";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  const url       = new URL(req.url);
  const apply     = url.searchParams.get("apply") === "1";
  const dateParam = url.searchParams.get("date");
  const dateISO   = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : todayParisISO();

  // Mode "ping LONACI uniquement" pour diagnostic rapide
  if (url.searchParams.get("lonaci_only") === "1") {
    const t0 = Date.now();
    const reunions = await fetchLonaciActiveGames();
    return NextResponse.json({
      ok: reunions !== null,
      lonaci_available: reunions !== null,
      reunions_count:   reunions?.length ?? 0,
      reunions_summary: reunions?.map((r) => ({
        nReunion: r.nReunion,
        libelle:  r.libelle,
        races:    r.races.length,
      })) ?? [],
      duration_ms: Date.now() - t0,
    });
  }

  const result = await collectSourceEvidenceForDate({
    date:   dateISO,
    dryRun: !apply,
  });

  return NextResponse.json({
    ok:    result.errors.length === 0,
    mode:  apply ? "APPLIED" : "DRY-RUN (aucune écriture BDD)",
    ...result,
  });
}
