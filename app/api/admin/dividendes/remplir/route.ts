import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { runBackfillRapportGagnant } from "@/lib/pmu-backfill-rapport-gagnant";

export const dynamic     = "force-dynamic";
export const maxDuration = 120;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const RETOUR  = "/admin/statistiques";

function redirect(path: string) {
  return NextResponse.redirect(`${APP_URL}${path}`, { status: 302 });
}

/**
 * POST /api/admin/dividendes/remplir
 *
 * Propage les dividendes PMU (arrivees.rapports_pmu) → pronostics.rapport_gagnant
 * pour les 90 derniers jours — déclenché depuis le bouton « Remplir les
 * dividendes » de /admin/statistiques. C'est le MÊME cœur que le cron quotidien
 * "40 22 * * *", mais à la demande (sans attendre ce soir, sans CRON_SECRET).
 *
 * Auth = session admin (cookie). Form POST → redirect avec le résumé en query.
 */
export async function POST(req: NextRequest) {
  // ── Auth admin (session) ─────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect(`/connexion?redirect=${RETOUR}`);

  const admin = createServiceClient();
  const { data: profile } = await admin
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") return redirect("/");

  // ── Remplissage (90j, écriture réelle, skip déjà remplis) ────────────────
  const result = await runBackfillRapportGagnant(admin, {
    days: 90,
    dry: false,
    includeAll: false,
  });

  if ("error" in result) {
    console.error(`[Dividendes] ✗ ${result.error}`);
    return redirect(`${RETOUR}?dividendes=erreur`);
  }

  const { filled, sumGains } = result.summary;
  console.log(`[Dividendes] ✓ ${filled} rapport(s) remplis (≈${sumGains}€ cumulés)`);
  return redirect(`${RETOUR}?dividendes=ok&filled=${filled}&gains=${Math.round(sumGains)}`);
}
