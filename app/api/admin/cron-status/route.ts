/**
 * GET /api/admin/cron-status
 * Retourne le dernier statut de chaque cron job depuis la table cron_logs.
 * Si la table n'existe pas encore, retourne tous les crons avec status "never".
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// `githubWorkflow` : ces syncs tournent sur GitHub Actions (IP propre) car Geny
// renvoie 403/429 à l'IP du Worker Cloudflare. Ils ne journalisent donc PAS dans
// cron_logs → sans ce marqueur, ils s'affichaient « JAMAIS » à tort, et leur
// bouton « Forcer » (fetch direct depuis le Worker) échouait toujours (429).
const KNOWN_CRONS: Array<{
  cronName: string; label: string; schedule: string; githubWorkflow?: string;
}> = [
  { cronName: "pmu-sync",             label: "Sync PMU Aujourd'hui",    schedule: "6h–7h30 Paris", githubWorkflow: "pmu-sync.yml" },
  { cronName: "pmu-demain",           label: "Sync PMU Lendemain (J+1)", schedule: "20h UTC",       githubWorkflow: "pmu-demain.yml" },
  { cronName: "lonaci-sync",          label: "Sync LONACI",             schedule: "7h30 Paris" },
  { cronName: "geny-arrivees",        label: "Arrivées Geny",           schedule: "13h–19h / 1h",  githubWorkflow: "geny-arrivees.yml" },
  { cronName: "sync-resultats",       label: "Résultats pronostics",    schedule: "21h Paris" },
  { cronName: "expire-abonnements",   label: "Expiration abonnements",  schedule: "2h Paris" },
  { cronName: "rappel-expiration",    label: "Rappels expiration",      schedule: "10h Paris" },
  { cronName: "source-evidence-collector", label: "Preuves Afrique (collecte)", schedule: "≈8h15 Paris" },
  { cronName: "ia-pronostics-v2",          label: "Génération pronostics IA",   schedule: "≈8h45 Paris" },
];

export interface CronJobStatus {
  cronName:       string;
  label:          string;
  schedule:       string;
  lastStatus:     "success" | "failure" | "skip" | "never";
  lastRun:        string | null;
  lastDuration:   number | null;
  lastDetails:    Record<string, unknown> | null;
  /** si présent : le job tourne sur GitHub Actions, pas via le Worker/cron_logs */
  githubWorkflow: string | null;
}

export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data: logs, error } = await supabase
      .from("cron_logs")
      .select("cron_name, status, executed_at, duration_ms, details")
      .order("executed_at", { ascending: false })
      .limit(200);

    // Table doesn't exist yet → return all as "never"
    if (error) {
      return NextResponse.json(
        KNOWN_CRONS.map((c) => ({
          ...c,
          lastStatus:   "never" as const,
          lastRun:      null,
          lastDuration: null,
          lastDetails:  null,
        }))
      );
    }

    // Regrouper par cron_name, garder uniquement le plus récent
    const latestByName = new Map<string, typeof logs[0]>();
    for (const log of logs ?? []) {
      if (!latestByName.has(log.cron_name)) {
        latestByName.set(log.cron_name, log);
      }
    }

    const result: CronJobStatus[] = KNOWN_CRONS.map((c) => {
      const latest = latestByName.get(c.cronName);
      return {
        cronName:       c.cronName,
        label:          c.label,
        schedule:       c.schedule,
        lastStatus:     (latest?.status as "success" | "failure" | "skip") ?? "never",
        lastRun:        latest?.executed_at ?? null,
        lastDuration:   latest?.duration_ms ?? null,
        lastDetails:    (latest?.details as Record<string, unknown>) ?? null,
        githubWorkflow: c.githubWorkflow ?? null,
      };
    });

    return NextResponse.json(result);

  } catch {
    return NextResponse.json(
      KNOWN_CRONS.map((c) => ({
        ...c,
        lastStatus:   "never" as const,
        lastRun:      null,
        lastDuration: null,
        lastDetails:  null,
      }))
    );
  }
}
