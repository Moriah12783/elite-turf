/**
 * lib/ingest/validator.ts
 * Validation du payload pronostic envoyé par le MVP.
 * Contrat de données Phase 1A — spec §13A
 */

export type NiveauAcces = "GRATUIT" | "STARTER" | "PRO" | "ELITE";
export type Confiance   = "FAIBLE"  | "MOYEN"   | "ELEVE" | "TRES_ELEVE";

export interface PronosticPayload {
  externalId:      string;
  raceExternalId:  string;
  dateCourse:      string;
  hippodrome:      string;
  reunion:         number;
  courseNumber:    number;
  heureDepart:     string;
  niveauAcces:     NiveauAcces;
  selection:       number[];
  base?:           number[];
  outsider?:       number[];
  speculative?:    number[];
  confiance:       Confiance;
  analysisText?:   string;
  cautionText?:    string;
  approvalStatus?: string;
  publie:          boolean;
  publishedAt?:    string;
  source:          "MVP";
  dryRun?:         boolean;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const VALID_NIVEAU_ACCES: NiveauAcces[] = ["GRATUIT", "STARTER", "PRO", "ELITE"];
const VALID_CONFIANCE: Confiance[]       = ["FAIBLE", "MOYEN", "ELEVE", "TRES_ELEVE"];

export function validatePronosticPayload(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { ok: false, errors: ["Le body doit être un objet JSON"] };
  }

  const p = body as Record<string, unknown>;

  if (!p.externalId     || typeof p.externalId     !== "string") errors.push("externalId : requis (string)");
  if (!p.raceExternalId || typeof p.raceExternalId !== "string") errors.push("raceExternalId : requis (string)");

  if (!p.dateCourse || typeof p.dateCourse !== "string") {
    errors.push("dateCourse : requis (string ISO YYYY-MM-DD)");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dateCourse as string)) {
    errors.push("dateCourse : format attendu YYYY-MM-DD");
  }

  if (!p.hippodrome    || typeof p.hippodrome    !== "string") errors.push("hippodrome : requis (string)");
  if (typeof p.reunion !== "number" || p.reunion < 1)          errors.push("reunion : requis (number >= 1)");
  if (typeof p.courseNumber !== "number" || p.courseNumber < 1) errors.push("courseNumber : requis (number >= 1)");
  if (!p.heureDepart   || typeof p.heureDepart   !== "string") errors.push("heureDepart : requis (string HH:MM)");

  if (!p.niveauAcces || !VALID_NIVEAU_ACCES.includes(p.niveauAcces as NiveauAcces)) {
    errors.push(`niveauAcces : requis, valeurs : ${VALID_NIVEAU_ACCES.join(", ")}`);
  }

  if (!Array.isArray(p.selection) || (p.selection as unknown[]).length === 0) {
    errors.push("selection : requis (array non vide)");
  } else {
    const sel = p.selection as unknown[];
    if (sel.some((n) => typeof n !== "number" || n < 1)) {
      errors.push("selection : tous les éléments doivent être des nombres >= 1");
    }
  }

  if (!p.confiance || !VALID_CONFIANCE.includes(p.confiance as Confiance)) {
    errors.push(`confiance : requis, valeurs : ${VALID_CONFIANCE.join(", ")}`);
  }

  if (typeof p.publie !== "boolean") errors.push("publie : requis (boolean)");
  if (p.source !== "MVP")            errors.push('source : doit être "MVP"');

  return { ok: errors.length === 0, errors };
}

export function buildPayloadSummary(p: PronosticPayload): Record<string, unknown> {
  return {
    externalId:     p.externalId,
    raceExternalId: p.raceExternalId,
    dateCourse:     p.dateCourse,
    hippodrome:     p.hippodrome,
    reunion:        p.reunion,
    courseNumber:   p.courseNumber,
    niveauAcces:    p.niveauAcces,
    confiance:      p.confiance,
    selectionCount: p.selection?.length ?? 0,
    publie:         p.publie,
    source:         p.source,
    dryRun:         p.dryRun ?? false,
  };
}
