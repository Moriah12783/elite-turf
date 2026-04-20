/**
 * GET /api/cron/ia-auto-publish
 *
 * Cron Vercel — 07h30 Paris (05h30 UTC) chaque jour
 *
 * Vérifie que les pronostics du jour sont publiés.
 * Si des pronostics sont en brouillon (publie=false), les publie automatiquement.
 * Utilisé comme filet de sécurité après ia-pronostics ou pour les brouillons manuels.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logCronStart } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  const logger = logCronStart("ia-auto-publish");

  // Auth
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today    = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).split(" ")[0];

  try {
    // ── 1. Trouver les pronostics en brouillon avec une course aujourd'hui ─
    const { data: drafts, error: fetchErr } = await supabase
      .from("pronostics")
      .select(`
        id,
        course:courses ( date_course )
      `)
      .eq("publie", false);

    if (fetchErr) throw new Error(`Fetch drafts: ${fetchErr.message}`);

    // Filtrer ceux dont la course est aujourd'hui
    const todayDrafts = (drafts ?? []).filter((p) => {
      const courseRaw = Array.isArray(p.course) ? p.course[0] : p.course;
      return (courseRaw as { date_course: string } | null)?.date_course === today;
    });

    const stats = { total_drafts: todayDrafts.length, published: 0, errors: 0 };

    if (todayDrafts.length === 0) {
      await logger.finish("skip", { reason: "Aucun brouillon à publier", date: today });
      return NextResponse.json({ ok: true, skipped: true, ...stats });
    }

    // ── 2. Publier chaque brouillon ────────────────────────────────────────
    const now = new Date().toISOString();

    for (const draft of todayDrafts) {
      const { error: updateErr } = await supabase
        .from("pronostics")
        .update({
          publie:           true,
          date_publication: now,
          updated_at:       now,
        })
        .eq("id", draft.id);

      if (updateErr) {
        console.error(`[ia-auto-publish] Update error ${draft.id}: ${updateErr.message}`);
        stats.errors++;
      } else {
        stats.published++;
      }
    }

    await logger.finish("success", { ...stats, date: today });

    return NextResponse.json({ ok: true, ...stats });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ia-auto-publish] Erreur:", msg);
    await logger.finish("failure", { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
