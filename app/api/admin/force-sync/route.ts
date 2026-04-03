/**
 * POST /api/admin/force-sync
 *
 * Permet à l'admin de déclencher manuellement un sync depuis le dashboard.
 * Protégé par le middleware d'auth admin (pas besoin de CRON_SECRET ici).
 *
 * Body: { target: "pmu-today" | "pmu-demain" | "lonaci" | "arrivees" | "resultats" }
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

const TARGETS: Record<string, { url: string; method: string; body?: object }> = {
  "pmu-today":  { url: `${APP_URL}/api/pmu/sync`,           method: "POST", body: {} },
  "pmu-demain": { url: `${APP_URL}/api/cron/pmu-demain`,    method: "GET" },
  "lonaci":     { url: `${APP_URL}/api/lonaci/sync`,         method: "POST" },
  "arrivees":   { url: `${APP_URL}/api/geny/arrivees`,       method: "POST" },
  "resultats":  { url: `${APP_URL}/api/admin/sync-resultats`, method: "POST" },
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

    // Propager le message d'erreur au niveau supérieur pour le CronMonitorPanel
    const errorMsg = res.ok ? undefined : (data?.error ?? `HTTP ${res.status} — ${endpoint.url}`);

    return NextResponse.json({
      ok: res.ok,
      target,
      duration_ms,
      result: data,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }, { status: res.ok ? 200 : 500 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur réseau";
    return NextResponse.json(
      { ok: false, target, error: msg, duration_ms: Date.now() - t0 },
      { status: 500 }
    );
  }
}
