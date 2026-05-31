// GET /api/cron/pmu-sync
//
// Synchronise le programme PMU du JOUR. Déclenché par le cron-worker
// Cloudflare TÔT le matin (avant enrichir-partants / source-evidence-collector
// / ia-pronostics-v2) afin de GARANTIR que les courses du jour sont en BDD
// avant le pipeline IA.
//
// 🛡️ Résilience (fix Cause A — 2026-05-31)
//   /api/pmu/sync renvoie parfois une page d'erreur Cloudflare "error code: 522"
//   (timeout/connexion origine) au lieu de JSON → l'ancien `await res.json()`
//   crashait ("Unexpected token 'e'… is not valid JSON"). On parse désormais
//   défensivement (res.text() puis JSON.parse try/catch) et on RETENTE jusqu'à
//   MAX_ATTEMPTS avant d'abandonner.
//
// Auth : Authorization: Bearer CRON_SECRET

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

const CRON_SECRET    = process.env.CRON_SECRET || "";
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL || "https://www.elite-turf.fr";
const MAX_ATTEMPTS   = 3;
const RETRY_DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logger = logCronStart("pmu-sync");
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${APP_URL}/api/pmu/sync`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${CRON_SECRET}`,
        },
        body: JSON.stringify({}),
      });

      // Parse défensif : la réponse peut être une page HTML "error code: 522".
      const raw = await res.text();
      let data: Record<string, unknown> | null = null;
      try { data = JSON.parse(raw) as Record<string, unknown>; } catch { /* non-JSON */ }

      if (res.ok && data) {
        await logger.finish("success", { ...data, attempts: attempt });
        return NextResponse.json({ ok: true, attempts: attempt, ...data });
      }

      lastError = (data?.error as string) ?? `HTTP ${res.status} (réponse non-JSON): ${raw.slice(0, 120)}`;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }

  await logger.finish("failure", { error: lastError, attempts: MAX_ATTEMPTS });
  return NextResponse.json({ error: lastError }, { status: 500 });
}
