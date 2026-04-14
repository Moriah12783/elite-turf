/**
 * POST /api/ingest/pronostic
 *
 * Endpoint d'ingestion Phase 1A — reçoit un pronostic validé depuis le moteur MVP.
 * Spec de référence : docs/mvp_connexion_eliteturf.md §7A, §8, §10, §12, §15, §16
 *
 * Phase 1A : publie forcé à false — publication manuelle via admin uniquement.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkIngestAuth, extractMvpHeaders } from "@/lib/ingest/auth";
import {
  validatePronosticPayload,
  buildPayloadSummary,
  type PronosticPayload,
} from "@/lib/ingest/validator";
import { logIngestEvent } from "@/lib/ingest/logger";
import { revalidatePronosticIngestion } from "@/lib/ingest/revalidate";

export const dynamic = "force-dynamic";

// Phase 1A : mettre à true pour forcer dry_run sur TOUTES les requêtes
// (indépendamment du flag dryRun dans le payload)
const PHASE_1A_FORCE_DRY_RUN = false;

export async function POST(req: NextRequest) {
  const receivedAt = new Date().toISOString();
  const { requestId, timestamp } = extractMvpHeaders(req);

  // 1. Auth
  const auth = checkIngestAuth(req.headers.get("authorization"));
  if (!auth.ok) {
    await logIngestEvent({ objectType: "pronostic", requestId, status: "auth_failed", message: auth.reason, dryRun: false });
    return NextResponse.json({ ok: false, step: "auth", reason: auth.reason, requestId }, { status: 401 });
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await logIngestEvent({ objectType: "pronostic", requestId, status: "payload_invalid", message: "Body JSON invalide", dryRun: false });
    return NextResponse.json({ ok: false, step: "parse", reason: "Body JSON invalide ou manquant", requestId }, { status: 400 });
  }

  // 3. Validation
  const validation = validatePronosticPayload(body);
  if (!validation.ok) {
    const p = body as Record<string, unknown>;
    await logIngestEvent({
      objectType: "pronostic",
      externalId: typeof p.externalId === "string" ? p.externalId : undefined,
      raceExternalId: typeof p.raceExternalId === "string" ? p.raceExternalId : undefined,
      requestId, status: "payload_invalid",
      message: `Payload invalide : ${validation.errors.join(" | ")}`,
      dryRun: false, payloadSummary: { errors: validation.errors },
    });
    return NextResponse.json({ ok: false, step: "validation", errors: validation.errors, requestId }, { status: 422 });
  }

  const payload  = body as PronosticPayload;
  const isDryRun = PHASE_1A_FORCE_DRY_RUN || payload.dryRun === true;
  const summary  = buildPayloadSummary(payload);

  // 4. DRY RUN — simulation pure
  if (isDryRun) {
    await logIngestEvent({
      objectType: "pronostic", externalId: payload.externalId,
      raceExternalId: payload.raceExternalId, requestId,
      status: "dry_run", message: "Simulation — aucune écriture", dryRun: true, payloadSummary: summary,
    });
    return NextResponse.json({
      ok: true, dryRun: true, step: "dry_run", requestId, receivedAt,
      mvpTimestamp: timestamp, authValidated: true, payloadValid: true,
      simulation: {
        action: "upsert", table: "pronostics", idempotenceKey: payload.externalId,
        wouldWrite: {
          external_id: payload.externalId, race_external_id: payload.raceExternalId,
          niveau_acces: payload.niveauAcces, selection: payload.selection,
          confiance: payload.confiance, publie: false, source: "MVP",
        },
        wouldRevalidate: ["/pronostics", "/"],
        note: "Phase 1A — publication réelle non activée",
      },
    }, { status: 200 });
  }

  // 5. Écriture réelle
  try {
    const supabase = createServiceClient();

    // Idempotence — cherche un existant par external_id
    const { data: existing } = await supabase
      .from("pronostics")
      .select("id, external_id")
      .eq("external_id", payload.externalId)
      .maybeSingle();

    const upsertData = {
      external_id:      payload.externalId,
      race_external_id: payload.raceExternalId,
      niveau_acces:     payload.niveauAcces,
      type_pari:        "QUINTE_PLUS",
      selection:        payload.selection,
      confiance:        payload.confiance,
      analyse_courte:   (payload.analysisText ?? `${payload.hippodrome} R${payload.reunion}C${payload.courseNumber}`).slice(0, 300),
      analyse_texte:    payload.analysisText ?? null,
      publie:           false,   // Phase 1A : jamais auto-publié
      resultat:         "EN_ATTENTE",
      source:           "MVP",
      updated_at:       new Date().toISOString(),
    };

    let action: "inserted" | "updated";
    let pronosticId: string | null = null;

    if (existing) {
      const { error } = await supabase.from("pronostics").update(upsertData).eq("id", existing.id);
      if (error) throw new Error(`Supabase update: ${error.message}`);
      action      = "updated";
      pronosticId = existing.id;
    } else {
      const { data: inserted, error } = await supabase
        .from("pronostics")
        .insert({ ...upsertData, nb_vues: 0, nb_likes: 0 })
        .select("id").maybeSingle();
      if (error) throw new Error(`Supabase insert: ${error.message}`);
      action      = "inserted";
      pronosticId = inserted?.id ?? null;
    }

    revalidatePronosticIngestion();

    await logIngestEvent({
      objectType: "pronostic", externalId: payload.externalId,
      raceExternalId: payload.raceExternalId, requestId,
      status: existing ? "duplicate_absorbed" : "success",
      message: `${action} — id: ${pronosticId}`,
      dryRun: false, payloadSummary: summary,
    });

    return NextResponse.json({
      ok: true, dryRun: false, step: "ingested", action, pronosticId, requestId, receivedAt,
      note: "Phase 1A — publie=false forcé, publication manuelle requise côté admin",
    }, { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    await logIngestEvent({
      objectType: "pronostic", externalId: payload.externalId, requestId,
      status: "error", message, dryRun: false, payloadSummary: summary,
    });
    console.error("[POST /api/ingest/pronostic]", message);
    return NextResponse.json({ ok: false, step: "database", reason: message, requestId }, { status: 500 });
  }
}

// GET santé — le MVP peut vérifier que l'endpoint est disponible
export async function GET() {
  return NextResponse.json({
    status: "ok", endpoint: "/api/ingest/pronostic",
    phase: "1A", dryRunForced: PHASE_1A_FORCE_DRY_RUN, version: "1.0.0",
  });
}
