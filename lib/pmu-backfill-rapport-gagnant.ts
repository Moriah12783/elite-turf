/**
 * lib/pmu-backfill-rapport-gagnant.ts
 *
 * Cœur partagé de la propagation des dividendes PMU sur les pronostics :
 * `arrivees.rapports_pmu` (JSONB) → `pronostics.rapport_gagnant` (€).
 *
 * Pourquoi un module dédié ? DEUX appelants utilisent exactement la même
 * logique et ne doivent pas diverger :
 *   1. La route /api/admin/backfill-rapport-gagnant (cron 40 22 UTC + curl)
 *   2. La route /api/admin/dividendes/remplir (bouton admin /admin/statistiques)
 *
 * On sépare :
 *   - `planBackfillRapportGagnant` : décision PURE (testable sans Supabase) —
 *     quelles lignes remplir, lesquelles skipper et pourquoi.
 *   - `runBackfillRapportGagnant`  : la glue IO (fetch + update) qui applique
 *     le plan via Supabase.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeRapportGagnant,
  type PronosticResultat,
} from "@/lib/pmu-rapports-gagnant";
import type { RapportsPMU } from "@/lib/sync/geny-rapports-parser";

// ── Forme des lignes récupérées (le join course→arrivees peut arriver en
//    objet OU en tableau selon le typage Supabase : on normalise à la lecture).
interface BackfillArrivee {
  rapports_pmu: RapportsPMU | null;
}
interface BackfillCourse {
  libelle?: string | null;
  arrivees?: BackfillArrivee | BackfillArrivee[] | null;
}
export interface BackfillRow {
  id: string;
  type_pari: string | null;
  resultat: string | null;
  rapport_gagnant: number | null;
  course: BackfillCourse | BackfillCourse[] | null;
}

export interface BackfillOutcome {
  pronosticId: string;
  libelle: string | null;
  typePari: string | null;
  resultat: string | null;
  rapportNew: number | null;
  reason?: string;
  ok: boolean;
}

export interface BackfillUpdate {
  id: string;
  rapport: number;
  libelle: string | null;
  typePari: string | null;
  resultat: string | null;
}

export interface BackfillPlan {
  /** Lignes à écrire (rapport calculé, non null). */
  toUpdate: BackfillUpdate[];
  /** Lignes ignorées avec la raison (already filled / no rapports / no matching). */
  skipped: BackfillOutcome[];
}

/**
 * Décision PURE : à partir des lignes déjà récupérées, calcule ce qu'il faut
 * écrire et ce qu'on skippe. Aucune dépendance Supabase → testable directement.
 */
export function planBackfillRapportGagnant(
  rows: BackfillRow[],
  includeAll: boolean,
): BackfillPlan {
  const toUpdate: BackfillUpdate[] = [];
  const skipped: BackfillOutcome[] = [];

  for (const p of rows) {
    const course = Array.isArray(p.course) ? p.course[0] : p.course;
    const arrivee = course?.arrivees
      ? Array.isArray(course.arrivees)
        ? course.arrivees[0]
        : course.arrivees
      : null;
    const rapports = (arrivee?.rapports_pmu ?? null) as RapportsPMU | null;
    const libelle = course?.libelle ?? null;
    const base = {
      pronosticId: p.id,
      libelle,
      typePari: p.type_pari,
      resultat: p.resultat,
    };

    // Déjà rempli → skip (sauf includeAll qui force le recalcul).
    if (!includeAll && p.rapport_gagnant != null) {
      skipped.push({ ...base, rapportNew: null, reason: "already filled", ok: false });
      continue;
    }

    if (!rapports) {
      skipped.push({ ...base, rapportNew: null, reason: "no rapports JSONB", ok: false });
      continue;
    }

    const rapport = computeRapportGagnant(
      p.type_pari,
      p.resultat as PronosticResultat,
      rapports,
    );

    if (rapport == null) {
      skipped.push({ ...base, rapportNew: null, reason: "no applicable rapport", ok: false });
      continue;
    }

    toUpdate.push({ id: p.id, rapport, libelle, typePari: p.type_pari, resultat: p.resultat });
  }

  return { toUpdate, skipped };
}

export interface BackfillSummary {
  total: number;
  filled: number;
  skipped: number;
  noRapports: number;
  noMatching: number;
  failed: number;
  sumGains: number;
}

export interface BackfillResult {
  dry: boolean;
  days: number;
  includeAll: boolean;
  dateFrom: string;
  summary: BackfillSummary;
  outcomes: BackfillOutcome[];
}

// Le SELECT partagé : pronostics GAGNANT/PARTIEL + course + arrivée jointe.
const BACKFILL_SELECT = `
  id, type_pari, resultat, rapport_gagnant,
  course:courses(
    id, libelle, date_course,
    arrivees(rapports_pmu)
  )
`;

/**
 * Glue IO : récupère les pronostics GAGNANT/PARTIEL de la fenêtre, applique
 * `planBackfillRapportGagnant`, écrit les `rapport_gagnant` (sauf dry-run) et
 * renvoie un résumé. Renvoie `{ error }` si le fetch échoue.
 */
export async function runBackfillRapportGagnant(
  supabase: SupabaseClient,
  opts: { days: number; dry: boolean; includeAll: boolean },
): Promise<BackfillResult | { error: string }> {
  const { days, dry, includeAll } = opts;

  const dateFrom = new Date(Date.now() - days * 24 * 3600 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: rows, error: fetchErr } = await supabase
    .from("pronostics")
    .select(BACKFILL_SELECT)
    .eq("publie", true)
    .in("resultat", ["GAGNANT", "PARTIEL"])
    .gte("date_publication", `${dateFrom}T00:00:00.000Z`);

  if (fetchErr) return { error: fetchErr.message };

  const { toUpdate, skipped } = planBackfillRapportGagnant(
    (rows ?? []) as unknown as BackfillRow[],
    includeAll,
  );

  const outcomes: BackfillOutcome[] = [...skipped];
  let filled = 0;
  let failed = 0;
  let sumGains = 0;

  for (const u of toUpdate) {
    if (!dry) {
      const { error: updateErr } = await supabase
        .from("pronostics")
        .update({ rapport_gagnant: u.rapport })
        .eq("id", u.id);
      if (updateErr) {
        outcomes.push({
          pronosticId: u.id,
          libelle: u.libelle,
          typePari: u.typePari,
          resultat: u.resultat,
          rapportNew: u.rapport,
          reason: `update failed: ${updateErr.message}`,
          ok: false,
        });
        failed++;
        continue;
      }
    }
    outcomes.push({
      pronosticId: u.id,
      libelle: u.libelle,
      typePari: u.typePari,
      resultat: u.resultat,
      rapportNew: u.rapport,
      ok: true,
    });
    filled++;
    sumGains += u.rapport;
  }

  const summary: BackfillSummary = {
    total: outcomes.length,
    filled,
    skipped: skipped.filter((o) => o.reason === "already filled").length,
    noRapports: skipped.filter((o) => o.reason === "no rapports JSONB").length,
    noMatching: skipped.filter((o) => o.reason === "no applicable rapport").length,
    failed,
    sumGains: Math.round(sumGains),
  };

  return { dry, days, includeAll, dateFrom, summary, outcomes };
}
