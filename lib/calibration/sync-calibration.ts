/**
 * lib/calibration/sync-calibration.ts — scellé hebdomadaire de la calibration.
 *
 * Chaque lundi 09h40 UTC (cron Cloudflare → /api/cron/calibration-hebdo) :
 *   1. semaine = lundi de la dernière semaine complète ;
 *   2. lecture des agrégats Radar pour SEMAINE (lundi → dimanche) et CUMUL
 *      (DEBUT_JOURNAL → dimanche) ;
 *   3. insertion WRITE-ONCE dans calibration_hebdo (ignoreDuplicates sur la
 *      contrainte unique semaine/perimetre/tranche) : une semaine déjà
 *      scellée n'est jamais réécrite, bonne ou mauvaise.
 *
 * Si Radar ne renvoie aucune tranche pour la semaine (journal vide, panne),
 * on n'écrit RIEN et on le dit (CALIBRATION_VIDE) : jamais de ligne fausse.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { DEBUT_JOURNAL, dimancheDeLaSemaine, estUnLundi, lundiSemainePrecedente } from "./semaine";
import { fetchCalibrationTranches, type LigneCalibration } from "./radar-client";

export type Perimetre = "SEMAINE" | "CUMUL";

export interface LigneCalibrationHebdo extends LigneCalibration {
  semaine: string;
  perimetre: Perimetre;
}

export interface ResultatSync {
  semaine: string;
  statut: "OK" | "CALIBRATION_VIDE";
  inseres: number;
  ignores: number;
  tranches_semaine: number;
  tranches_cumul: number;
}

/** Pur : assemble les lignes à insérer (testé sans réseau ni base). */
export function buildRows(semaine: string, lignesSemaine: LigneCalibration[], lignesCumul: LigneCalibration[]): LigneCalibrationHebdo[] {
  const tag = (perimetre: Perimetre) => (l: LigneCalibration): LigneCalibrationHebdo => ({ ...l, semaine, perimetre });
  return [...lignesSemaine.map(tag("SEMAINE")), ...lignesCumul.map(tag("CUMUL"))];
}

export interface SyncDeps {
  now?: Date;
  semaine?: string;
  fetchTranches?: (debut: string, fin: string) => Promise<LigneCalibration[]>;
  insererWriteOnce?: (rows: LigneCalibrationHebdo[]) => Promise<number>;
}

async function insererWriteOnceSupabase(rows: LigneCalibrationHebdo[]): Promise<number> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("calibration_hebdo")
    .upsert(rows, { onConflict: "semaine,perimetre,tranche", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`calibration_hebdo insert : ${error.message}`);
  return data?.length ?? 0;
}

export async function runCalibrationSync(deps: SyncDeps = {}): Promise<ResultatSync> {
  const semaine = deps.semaine && estUnLundi(deps.semaine) ? deps.semaine : lundiSemainePrecedente(deps.now ?? new Date());
  const dimanche = dimancheDeLaSemaine(semaine);
  const fetchTranches = deps.fetchTranches ?? fetchCalibrationTranches;
  const inserer = deps.insererWriteOnce ?? insererWriteOnceSupabase;

  const [lignesSemaine, lignesCumul] = await Promise.all([
    fetchTranches(semaine, dimanche),
    fetchTranches(DEBUT_JOURNAL, dimanche),
  ]);

  if (lignesSemaine.length === 0) {
    console.warn(`CALIBRATION_VIDE ${JSON.stringify({ semaine, dimanche })}`);
    return { semaine, statut: "CALIBRATION_VIDE", inseres: 0, ignores: 0, tranches_semaine: 0, tranches_cumul: lignesCumul.length };
  }

  const rows = buildRows(semaine, lignesSemaine, lignesCumul);
  const inseres = await inserer(rows);
  return {
    semaine,
    statut: "OK",
    inseres,
    ignores: rows.length - inseres,
    tranches_semaine: lignesSemaine.length,
    tranches_cumul: lignesCumul.length,
  };
}
