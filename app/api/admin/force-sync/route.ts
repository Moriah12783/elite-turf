/**
 * POST /api/admin/force-sync
 *
 * Permet à l'admin de déclencher manuellement un sync depuis le dashboard.
 * Protégé par le middleware d'auth admin (pas besoin de CRON_SECRET ici).
 *
 * Body: { target: "pmu-today" | "pmu-demain" | "lonaci" | "arrivees" | "resultats" }
 */

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || "https://www.elite-turf.fr";

interface Target {
  url:      string;
  method:   string;
  body?:    object;
  cronName: string;  // Nom utilisé dans cron_logs — doit matcher KNOWN_CRONS de cron-status
}

const TARGETS: Record<string, Target> = {
  // PMU sync → tente d'abord l'API PMU, fallback automatique sur Geny
  "pmu-today":  { url: `${APP_URL}/api/geny/programme`,      method: "POST", body: { date: "today" },  cronName: "pmu-sync" },
  "pmu-demain": { url: `${APP_URL}/api/geny/programme`,      method: "POST", body: { date: "demain" }, cronName: "pmu-demain" },
  "lonaci":     { url: `${APP_URL}/api/lonaci/sync`,         method: "POST",                          cronName: "lonaci-sync" },
  "arrivees":   { url: `${APP_URL}/api/geny/arrivees`,       method: "POST",                          cronName: "geny-arrivees" },
  "resultats":  { url: `${APP_URL}/api/admin/sync-resultats`, method: "POST",                          cronName: "sync-resultats" },
};

export async function POST(req: NextRequest) {
  const { target } = await req.json().catch(() => ({ target: "" }));

  const endpoint = TARGETS[target];
  if (!endpoint) {
    return NextResponse.json(
      { error: `Cible inconnue: "${target}". Valeurs: ${Object.keys(TARGETS).join(", ")}` },
      { status: 400 }
    );
  }

  // Log dans cron_logs pour que le dashboard se mette à jour immédiatement
  const logger = logCronStart(endpoint.cronName);
  const t0 = Date.now();

  try {
    const res = await fetch(endpoint.url, {
      method:  endpoint.method,
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${CRON_SECRET}`,
      },
      body: endpoint.body !== undefined ? JSON.stringify(endpoint.body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    const duration_ms = Date.now() - t0;

    if (!res.ok) {
      const errorMsg = data?.error ?? `HTTP ${res.status} — ${endpoint.url}`;
      await logger.finish("failure", { error: errorMsg, target, manual: true });
      return NextResponse.json({
        ok: false,
        target,
        duration_ms,
        result: data,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    await logger.finish("success", { ...data, target, manual: true });
    return NextResponse.json({
      ok: true,
      target,
      duration_ms,
      result: data,
      timestamp: new Date().toISOString(),
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur réseau";
    await logger.finish("failure", { error: msg, target, manual: true });
    return NextResponse.json(
      { ok: false, target, error: msg, duration_ms: Date.now() - t0 },
      { status: 500 }
    );
  }
}
