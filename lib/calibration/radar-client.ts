/**
 * lib/calibration/radar-client.ts — lecture des AGRÉGATS de calibration du
 * projet Radar (Supabase kkwfaxxyzttooqhdglgk) via PostgREST.
 *
 * Sécurité (décision Steph, 07/09/2026) : le site n'utilise que la CLÉ
 * PUBLIABLE du projet Radar. Le laboratoire reste fermé (RLS deny-all sur
 * toutes ses tables) ; la seule porte est fn_calibration_tranches, une
 * fonction `security definer` qui ne renvoie que des agrégats (n ≥ 30 par
 * tranche, plage bornée à 400 jours). Aucune clé service ne quitte Supabase.
 *
 * URL et clé sont des valeurs publiques, surchargeables par variables
 * d'environnement (RADAR_SUPABASE_URL / RADAR_SUPABASE_ANON_KEY).
 */

import type { Tranche } from "./semaine";

const RADAR_URL_DEFAUT = "https://kkwfaxxyzttooqhdglgk.supabase.co";
// Clé PUBLIABLE (publique par conception, rôle anon). gitleaks:allow
const RADAR_CLE_PUBLIABLE_DEFAUT = "sb_publishable_1v0OnBCMLawq8VV06TeetA_7uzUuPcS";

export interface LigneCalibration {
  tranche: Tranche;
  n: number;
  annonce_pct: number;
  reel_pct: number;
  marche_pct: number;
  gain_brier: number;
}

export function radarConfig(): { url: string; cle: string } {
  return {
    url: (process.env.RADAR_SUPABASE_URL?.trim() || RADAR_URL_DEFAUT).replace(/\/$/, ""),
    cle: process.env.RADAR_SUPABASE_ANON_KEY?.trim() || RADAR_CLE_PUBLIABLE_DEFAUT,
  };
}

/**
 * Appelle POST /rest/v1/rpc/fn_calibration_tranches(p_debut, p_fin).
 * Lève une erreur explicite si Radar ne répond pas : le cron doit échouer
 * visiblement plutôt que d'écrire des lignes vides ou inventées.
 */
export async function fetchCalibrationTranches(
  debut: string,
  fin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LigneCalibration[]> {
  const { url, cle } = radarConfig();
  const res = await fetchImpl(`${url}/rest/v1/rpc/fn_calibration_tranches`, {
    method: "POST",
    headers: {
      apikey: cle,
      Authorization: `Bearer ${cle}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ p_debut: debut, p_fin: fin }),
    cache: "no-store",
  });
  if (!res.ok) {
    const corps = await res.text().catch(() => "");
    throw new Error(`Radar fn_calibration_tranches HTTP ${res.status} : ${corps.slice(0, 200)}`);
  }
  const brut = (await res.json()) as Record<string, unknown>[];
  if (!Array.isArray(brut)) throw new Error("Radar fn_calibration_tranches : réponse inattendue");
  return brut.map((r) => ({
    tranche: String(r.tranche) as Tranche,
    n: Number(r.n),
    annonce_pct: Number(r.annonce_pct),
    reel_pct: Number(r.reel_pct),
    marche_pct: Number(r.marche_pct),
    gain_brier: Number(r.gain_brier),
  }));
}
