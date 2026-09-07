/**
 * lib/calibration/get-calibration.ts — lecture SSR du tableau de bord.
 *
 * Source unique pour la page /calibration : lit calibration_hebdo (prod,
 * client de service, RLS deny-all) et renvoie null si aucune semaine n'est
 * scellée ou si la base ne répond pas — la page affiche alors un état
 * « en cours de constitution », jamais « … » (règle 3 du CLAUDE.md).
 */

import { createServiceClient } from "@/lib/supabase/server";
import { TRANCHES, estUnLundi } from "./semaine";
import type { LigneCalibrationHebdo, Perimetre } from "./sync-calibration";

export interface CalibrationHebdo {
  semaine: string;
  calculeLe: string | null;
  semaine_lignes: LigneCalibrationHebdo[];
  cumul_lignes: LigneCalibrationHebdo[];
  semainesDisponibles: string[];
}

function trier(lignes: LigneCalibrationHebdo[]): LigneCalibrationHebdo[] {
  const ordre = new Map<string, number>(TRANCHES.map((t, i) => [t, i]));
  return [...lignes].sort((a, b) => (ordre.get(a.tranche) ?? 99) - (ordre.get(b.tranche) ?? 99));
}

export async function getCalibration(semaineDemandee?: string): Promise<CalibrationHebdo | null> {
  try {
    const supabase = createServiceClient();

    const { data: semaines } = await supabase
      .from("calibration_hebdo")
      .select("semaine")
      .eq("perimetre", "SEMAINE")
      .order("semaine", { ascending: false })
      .limit(600);
    const disponibles = Array.from(new Set((semaines ?? []).map((s) => String(s.semaine))));
    if (disponibles.length === 0) return null;

    const semaine = estUnLundi(semaineDemandee) && disponibles.includes(semaineDemandee) ? semaineDemandee : disponibles[0];

    const { data: lignes } = await supabase
      .from("calibration_hebdo")
      .select("semaine, perimetre, tranche, n, annonce_pct, reel_pct, marche_pct, gain_brier, calcule_le")
      .eq("semaine", semaine);

    const typed = (lignes ?? []).map((l) => ({
      semaine: String(l.semaine),
      perimetre: l.perimetre as Perimetre,
      tranche: l.tranche as LigneCalibrationHebdo["tranche"],
      n: Number(l.n),
      annonce_pct: Number(l.annonce_pct),
      reel_pct: Number(l.reel_pct),
      marche_pct: Number(l.marche_pct),
      gain_brier: Number(l.gain_brier),
      calcule_le: l.calcule_le as string | null,
    }));

    return {
      semaine,
      calculeLe: typed[0]?.calcule_le ?? null,
      semaine_lignes: trier(typed.filter((l) => l.perimetre === "SEMAINE")),
      cumul_lignes: trier(typed.filter((l) => l.perimetre === "CUMUL")),
      semainesDisponibles: disponibles,
    };
  } catch (err) {
    console.error("[calibration] lecture impossible :", err instanceof Error ? err.message : err);
    return null;
  }
}
