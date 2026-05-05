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
import { runGenyProgrammeSync } from "@/lib/sync/geny-programme";
import { runLonaciSync }        from "@/lib/sync/lonaci";
import { runGenyArriveesSync }  from "@/lib/sync/geny-arrivees";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";
const APP_URL     = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

/**
 * Cibles supportées :
 * - pmu-today, pmu-demain, lonaci, arrivees : appel DIRECT (lib partagée)
 *   pour éviter Cloudflare Worker self-fetch loop (HTTP 522 en 16ms).
 * - resultats : fetch HTTP vers /api/admin/sync-resultats (à migrer si plante)
 */
type DirectTarget = {
  kind:     "direct";
  cronName: string;
  run:      () => Promise<unknown>;
};

type FetchTarget = {
  kind:     "fetch";
  cronName: string;
  url:      string;
  method:   string;
  body?:    object;
};

type Target = DirectTarget | FetchTarget;

const TARGETS: Record<string, Target> = {
  "pmu-today": {
    kind:     "direct",
    cronName: "pmu-sync",
    run:      () => runGenyProgrammeSync("today"),
  },
  "pmu-demain": {
    kind:     "direct",
    cronName: "pmu-demain",
    run:      () => runGenyProgrammeSync("demain"),
  },
  "lonaci": {
    kind:     "direct",
    cronName: "lonaci-sync",
    run:      () => runLonaciSync(),
  },
  "arrivees": {
    kind:     "direct",
    cronName: "geny-arrivees",
    run:      () => runGenyArriveesSync(),
  },
  "resultats": {
    kind:     "fetch",
    cronName: "sync-resultats",
    url:      `${APP_URL}/api/admin/sync-resultats`,
    method:   "POST",
  },
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

  const logger = logCronStart(endpoint.cronName);
  const t0 = Date.now();

  try {
    let data: unknown;

    if (endpoint.kind === "direct") {
      // Appel direct à la fonction → pas de self-fetch loop
      data = await endpoint.run();
    } else {
      // Appel HTTP — peut planter en 522 si self-fetch sur custom domain
      const res = await fetch(endpoint.url, {
        method:  endpoint.method,
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${CRON_SECRET}`,
        },
        body: endpoint.body !== undefined ? JSON.stringify(endpoint.body) : undefined,
      });

      data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const dataObj  = (data ?? {}) as Record<string, unknown>;
        const errorMsg = (dataObj.error as string) ?? `HTTP ${res.status} — ${endpoint.url}`;
        const duration_ms = Date.now() - t0;
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
    }

    const duration_ms = Date.now() - t0;
    const detailsObj  = (typeof data === "object" && data !== null) ? data as Record<string, unknown> : {};
    await logger.finish("success", { ...detailsObj, target, manual: true });
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
