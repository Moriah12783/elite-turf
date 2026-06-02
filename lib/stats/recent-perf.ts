/**
 * lib/stats/recent-perf.ts
 *
 * Calcul PUR des performances récentes pour le badge hero. Point clé : `roi`
 * vaut `null` quand AUCUN rapport gagnant n'est connu — sinon le calcul
 * afficherait un ROI faux (ex. −100 % alors que les gagnants existent mais que
 * leur dividende n'est pas encore enregistré). On expose aussi le nombre de
 * gagnants + le taux, indépendants des rapports, pour un badge toujours vrai.
 */
export interface RecentPerfInput {
  resultat: string;
  gains_theoriques?: number | null;
  rapport_gagnant?: number | null;
}

export interface RecentPerf {
  nb: number;
  gagnants: number;
  tauxReussite: number | null; // % gagnants / nb (null si liste vide)
  roi: number | null;          // null si AUCUN rapport connu (donnée incomplète)
  gains: number;
}

export function computeRecentPerf(list: RecentPerfInput[]): RecentPerf {
  const nb = list.length;
  if (nb === 0) return { nb: 0, gagnants: 0, tauxReussite: null, roi: null, gains: 0 };

  let gains = 0;
  let rapportsConnus = 0;
  let gagnants = 0;

  for (const p of list) {
    if (p.resultat === "GAGNANT") gagnants++;
    const r = p.gains_theoriques ?? p.rapport_gagnant ?? null;
    if (r != null) rapportsConnus++;
    const rr = r ?? 0;
    if (p.resultat === "GAGNANT") gains += rr;
    else if (p.resultat === "PARTIEL") gains += rr * 0.3;
  }

  return {
    nb,
    gagnants,
    tauxReussite: Math.round((gagnants / nb) * 100),
    // ROI fiable UNIQUEMENT si au moins un rapport est enregistré.
    roi: rapportsConnus > 0 ? Math.round(((gains - nb) / nb) * 100) : null,
    gains: Math.round(gains),
  };
}
