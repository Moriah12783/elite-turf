/**
 * GET /api/cron/pmu-demain
 *
 * Récupère le programme PMU du LENDEMAIN (préparation J+1 côté abonnés) et
 * sert de filet "overnight" pour le pipeline du matin.
 *
 * 🛡️ Résilience (fix Cause A — 2026-05-31)
 *   Le run planifié à 17:43 UTC échouait TOUS LES JOURS : /api/pmu/sync
 *   renvoyait une page Cloudflare "error code: 522" et l'ancien
 *   `await res.json()` crashait. On parse désormais défensivement + on
 *   RETENTE, et le cron est re-planifié à 20:00 UTC (hors fenêtre 522).
 *
 * Auth : aucune (comportement historique conservé — appelé par le cron-worker).
 */
import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

const CRON_SECRET    = process.env.CRON_SECRET || "";
const APP_URL        = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const MAX_ATTEMPTS   = 3;
const RETRY_DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Formate une date en YYYYMMDD */
function toDateStr(d: Date): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}${mo}${da}`;
}

export async function GET(req: NextRequest) {
  void req;
  const logger = logCronStart("pmu-demain");

  // Calcul du lendemain en UTC — évite le décalage si le cron tourne près de minuit
  const now    = new Date();
  const demain = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const dateStr = toDateStr(demain);

  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${APP_URL}/api/pmu/sync`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${CRON_SECRET}`,
        },
        body: JSON.stringify({ date: dateStr }),
      });

      // Parse défensif : la réponse peut être une page HTML "error code: 522".
      const raw = await res.text();
      let data: Record<string, unknown> | null = null;
      try { data = JSON.parse(raw) as Record<string, unknown>; } catch { /* non-JSON */ }

      if (res.ok && data) {
        await logger.finish("success", { ...data, targetDate: dateStr, attempts: attempt });
        return NextResponse.json({ ok: true, targetDate: dateStr, attempts: attempt, ...data });
      }

      lastError = (data?.error as string) ?? `HTTP ${res.status} (réponse non-JSON): ${raw.slice(0, 120)}`;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }

  await logger.finish("failure", { error: lastError, targetDate: dateStr, attempts: MAX_ATTEMPTS });
  return NextResponse.json({ error: lastError, targetDate: dateStr }, { status: 500 });
}
