/**
 * POST /api/ingest/pronostic
 *
 * Endpoint d'ingestion Phase 1B — reçoit un pronostic validé depuis le moteur MVP.
 * Spec de référence : docs/mvp_connexion_eliteturf.md §7A, §8, §10, §12, §15, §16
 *
 * dryRun: true  → simulation pure, aucune écriture
 * dryRun: false → upsert réel idempotent, publie=false, publication manuelle admin requise
 *
 * Schéma Phase 1B :
 *   - course_id nullable (lien course ouvert en Phase 2)
 *   - auteur_id nullable (pronostic sans auteur humain)
 *   - external_id UNIQUE pour idempotence
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

// Coupe-circuit opérationnel — contrôlé par variable d'environnement.
// Mettre MVP_REAL_WRITE_ENABLED=true dans Vercel pour autoriser l'écriture réelle.
// Toute autre valeur (absent, false, vide) → simulation forcée.
const REAL_WRITE_ENABLED = process.env.MVP_REAL_WRITE_ENABLED === "true";

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
  const isDryRun = !REAL_WRITE_ENABLED || payload.dryRun === true;
  const summary  = buildPayloadSummary(payload);

  // 4. DRY RUN — simulation pure
  //    Deux causes possibles :
  //    A) payload.dryRun=true (choix explicite du MVP)
  //    B) MVP_REAL_WRITE_ENABLED!=true (coupe-circuit site actif)
  if (isDryRun) {
    const blockedByCircuitBreaker = !REAL_WRITE_ENABLED && payload.dryRun !== true;
    const dryRunReason = blockedByCircuitBreaker
      ? "Écriture réelle bloquée — MVP_REAL_WRITE_ENABLED non activé côté site"
      : "Simulation demandée par le payload (dryRun: true)";

    await logIngestEvent({
      objectType: "pronostic", externalId: payload.externalId,
      raceExternalId: payload.raceExternalId, requestId,
      status: "dry_run",
      message: dryRunReason,
      dryRun: true,
      payloadSummary: { ...summary, blockedByCircuitBreaker },
    });
    return NextResponse.json({
      ok: true, dryRun: true, step: "dry_run", requestId, receivedAt,
      mvpTimestamp: timestamp, authValidated: true, payloadValid: true,
      blockedByCircuitBreaker,
      reason: dryRunReason,
      simulation: {
        action: "upsert", table: "pronostics", idempotenceKey: payload.externalId,
        wouldWrite: {
          external_id: payload.externalId, race_external_id: payload.raceExternalId,
          niveau_acces: payload.niveauAcces, selection: payload.selection,
          confiance: payload.confiance, publie: false, source: "MVP",
        },
        wouldRevalidate: ["/pronostics", "/"],
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
      type_pari:        "QUINTE_PLUS",      // Phase 1B : Quinté+ uniquement
      selection:        payload.selection,
      confiance:        payload.confiance,
      analyse_courte:   (payload.analysisText ?? `${payload.hippodrome} R${payload.reunion}C${payload.courseNumber}`).slice(0, 300),
      analyse_texte:    payload.analysisText ?? null,
      publie:           false,              // Phase 1B : publie=false forcé — publication manuelle admin requise
      date_publication: null,               // Défini par l'admin au moment de la publication
      resultat:         "EN_ATTENTE",
      source:           "MVP",
      updated_at:       new Date().toISOString(),
    };

    let action: "inserted" | "updated";
    let pronosticId: string | null = null;

    if (existing) {
      // Idempotence : mise à jour de l'existant, pas de doublon
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

    // Revalidation Next.js après upsert réel
    revalidatePronosticIngestion(pronosticId ?? undefined);

    await logIngestEvent({
      objectType: "pronostic", externalId: payload.externalId,
      raceExternalId: payload.raceExternalId, requestId,
      status: existing ? "duplicate_absorbed" : "success",
      message: `${action} — pronosticId: ${pronosticId} — externalId: ${payload.externalId}`,
      dryRun: false,
      payloadSummary: { ...summary, pronosticId, action, isDuplicate: !!existing },
    });

    return NextResponse.json({
      ok: true,
      dryRun: false,
      step: "ingested",
      action,           // "inserted" | "updated"
      pronosticId,      // UUID Supabase du pronostic créé ou mis à jour
      requestId,
      receivedAt,
      isDuplicate: !!existing,
      note: "Phase 1B — publie=false, publication manuelle requise via interface admin",
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

// GET santé — le MVP peut vérifier l'état de l'endpoint avant d'envoyer
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/ingest/pronostic",
    phase: "1B",
    version: "1.1.0",
    realWriteEnabled: REAL_WRITE_ENABLED,   // true = écriture réelle active
    capabilities: {
      dryRun: true,
      realWrite: REAL_WRITE_ENABLED,
      idempotence: "external_id",
      publie: "always_false_manual_admin_required",
    },
  });
}
