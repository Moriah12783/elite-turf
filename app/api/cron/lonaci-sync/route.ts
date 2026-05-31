// GET /api/cron/lonaci-sync
//
// Cron job — déclenché par le worker Cloudflare `elite-turf-crons`
// (Authorization: Bearer CRON_SECRET). Lance le sync LONACI pour récupérer
// les courses du jour disponibles pour les parieurs africains
// (LONACI-CI, LONASE-SN, PMU-MA…).
//
// ⚠️ Appel DIRECT à runLonaciSync() (lib partagée) — PAS de self-fetch HTTP.
//    Un Worker Cloudflare ne peut pas fetch son propre domaine custom : la
//    boucle renvoie HTTP 522 (~16ms). En prime, l'ancienne construction
//    `${NEXT_PUBLIC_APP_URL}/api/lonaci/sync` cassait dès que la valeur d'env
//    contenait un espace en trop → "Invalid URL". Le même pattern « appel
//    direct » est déjà utilisé par /api/admin/force-sync.

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";
import { runLonaciSync } from "@/lib/sync/lonaci";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logger = logCronStart("lonaci-sync");

  try {
    // Appel direct à la fonction de sync — aucune requête HTTP self-fetch,
    // donc plus de risque "Invalid URL" ni de boucle 522.
    const data = await runLonaciSync();          // { ok: true, total, nationales, inserted, updated, … }
    await logger.finish("success", { ...data });
    return NextResponse.json(data);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    await logger.finish("failure", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
