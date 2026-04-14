/**
 * lib/ingest/logger.ts
 * Écriture dans la table ingestion_events.
 */

import { createServiceClient } from "@/lib/supabase/server";

export type IngestStatus =
  | "success"
  | "dry_run"
  | "auth_failed"
  | "payload_invalid"
  | "duplicate_absorbed"
  | "error";

export type ObjectType = "pronostic" | "course" | "resultat";

export interface IngestLogEntry {
  objectType:      ObjectType;
  externalId?:     string;
  raceExternalId?: string;
  requestId:       string;
  source?:         string;
  status:          IngestStatus;
  message?:        string;
  dryRun:          boolean;
  payloadSummary?: Record<string, unknown>;
}

/**
 * Écrit un événement dans ingestion_events (best-effort — ne bloque jamais la réponse HTTP).
 */
export async function logIngestEvent(entry: IngestLogEntry): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("ingestion_events").insert({
      object_type:      entry.objectType,
      external_id:      entry.externalId      ?? null,
      race_external_id: entry.raceExternalId  ?? null,
      request_id:       entry.requestId,
      source:           entry.source          ?? "MVP",
      status:           entry.status,
      message:          entry.message         ?? null,
      dry_run:          entry.dryRun,
      payload_summary:  entry.payloadSummary  ?? null,
      received_at:      new Date().toISOString(),
      processed_at:     new Date().toISOString(),
    });
    if (error) console.error("[IngestLogger] Erreur:", error.message);
  } catch (err) {
    console.error("[IngestLogger] Exception:", err);
  }
}
