/**
 * POST /api/pmu/sync
 *
 * Synchronise le programme PMU.fr du jour (ou d'une date) dans Supabase.
 * Délègue à `runPmuProgrammeSync` (lib/sync/pmu-programme) — exactement la même
 * logique que le fallback PMU.fr de la voie Geny (une seule source de vérité).
 *
 * Body JSON optionnel : { date: "YYYYMMDD" }
 */
import { NextRequest, NextResponse } from "next/server";
import { runPmuProgrammeSync } from "@/lib/sync/pmu-programme";
import { toDateStr } from "@/lib/pmu-api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let dateStr: string;
  try {
    const body = await req.json().catch(() => ({}));
    dateStr = body?.date || toDateStr();
  } catch {
    dateStr = toDateStr();
  }

  try {
    const r = await runPmuProgrammeSync(dateStr);
    if (r.courses === 0) {
      return NextResponse.json({
        ok: true,
        message: `Aucune course PMU trouvée pour le ${dateStr}`,
        inserted: 0,
      });
    }
    return NextResponse.json({
      ok:       true,
      date:     dateStr,
      reunions: r.reunions,
      courses:  r.courses,
      inserted: r.inserted,
      updated:  r.updated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[PMU Sync] Erreur :", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET pour vérification rapide (ex: cron ping) */
export async function GET() {
  return NextResponse.json({ ok: true, message: "PMU Sync endpoint actif" });
}
