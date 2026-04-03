/**
 * GET /api/admin/cron-status
 * Retourne le dernier statut de chaque cron job depuis la table cron_logs.
 * Si la table n'existe pas encore, retourne tous les crons avec status "never".
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const KNOWN_CRONS = [
  { cronName: "pmu-sync",             label: "Sync PMU Aujourd'hui",    schedule: "6h–7h30 Paris" },
  { cronName: "pmu-demain",           label: "Sync PMU Lendemain (J+1)", schedule: "19h Paris" },
  { cronName: "lonaci-sync",          label: "Sync LONACI",             schedule: "7h30 Paris" },
  { cronName: "geny-arrivees",        label: "Arrivées Geny",           schedule: "13h–19h / 15min" },
  { cronName: "sync-resultats",       label: "Résultats pronostics",    schedule: "21h Paris" },
  { cronName: "expire-abonnements",   label: "Expiration abonnements",  schedule: "2h Paris" },
  { cronName: "rappel-expiration",    label: "Rappels expiration",      schedule: "10h Paris" },
] as const;

export interface CronJobStatus {
  cronName:     string;
  label:        string;
  schedule:     string;
  lastStatus:   "success" | "failure" | "skip" | "never";
  lastRun:      string | null;
  lastDuration: number | null;
  lastDetails:  Record<string, unknown> | null;
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
        cronName:     c.cronName,
        label:        c.label,
        schedule:     c.schedule,
        lastStatus:   (latest?.status as "success" | "failure" | "skip") ?? "never",
        lastRun:      latest?.executed_at ?? null,
        lastDuration: latest?.duration_ms ?? null,
        lastDetails:  (latest?.details as Record<string, unknown>) ?? null,
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
