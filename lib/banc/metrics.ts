/**
 * Banc de mesure — métriques de performance d'une sélection vs l'arrivée.
 * Module PUR, déterministe, testable. Le KPI clé = le ROI "champ réduit",
 * pas la simple couverture (couvrir des favoris peut être une perte nette).
 */

export interface MetricsInput {
  /** chevaux de la sélection (numéros) */
  selection: number[];
  /** ordre d'arrivée officiel (arrivee[0] = vainqueur) */
  arrivee: number[];
  /** nombre de chevaux à trouver (5 Quinté+, 4 Quarté+, 3 Tiercé) */
  betLength: number;
  /** rapport désordre pour 1 unité de mise (ex. arrivees.rapport_quinte) ; null si inconnu */
  rapport?: number | null;
  /** mise par combinaison (défaut 1) */
  uniteMise?: number;
}

export type CategorieResultat = "GAGNANT" | "PARTIEL" | "PERDANT";

export interface MetricsResult {
  vainqueurHit: boolean;
  /** nb des N premiers de l'arrivée présents dans la sélection */
  couverture: number;
  /** les N premiers sont TOUS dans la sélection (Quinté désordre touché) */
  couvertureComplete: boolean;
  categorie: CategorieResultat;
  /** C(taille_sélection, N) — nb de combinaisons d'un champ réduit en désordre */
  combinaisons: number;
  /** coût du ticket = combinaisons × unité */
  cout: number;
  /** gain = rapport × unité si couverture complète, sinon 0 (hors Bonus 4/3) */
  gain: number;
  /** (gain − coût) / coût ; null si rapport inconnu ou coût nul */
  roi: number | null;
}

/** C(n, k) en entier, ES5-safe. */
export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const kk = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < kk; i++) {
    r = (r * (n - i)) / (i + 1);
  }
  return Math.round(r);
}

/** Nombre de chevaux à trouver selon le type de pari. */
export function betLengthFor(typePari: string | null | undefined): number {
  switch (typePari) {
    case "QUINTE_PLUS": return 5;
    case "QUARTE": return 4;
    case "TIERCE": return 3;
    default: return 5;
  }
}

export function computeMetrics(input: MetricsInput): MetricsResult {
  const sel = input.selection || [];
  const arr = input.arrivee || [];
  const N = input.betLength;
  const unite = input.uniteMise && input.uniteMise > 0 ? input.uniteMise : 1;

  const topN = arr.slice(0, N);
  let couverture = 0;
  for (let i = 0; i < topN.length; i++) {
    if (sel.indexOf(topN[i]) !== -1) couverture++;
  }
  const couvertureComplete = topN.length >= N && couverture >= N;
  const vainqueurHit = arr.length > 0 && sel.indexOf(arr[0]) !== -1;

  let categorie: CategorieResultat;
  if (couvertureComplete) categorie = "GAGNANT";
  else if (couverture >= N - 2) categorie = "PARTIEL"; // Bonus 4/3
  else categorie = "PERDANT";

  const combinaisons = sel.length >= N ? combinations(sel.length, N) : 0;
  const cout = combinaisons * unite;
  const rapport = input.rapport == null ? null : input.rapport;
  const gain = couvertureComplete && rapport != null && rapport > 0 ? rapport * unite : 0;
  const roi = rapport == null || cout === 0 ? null : (gain - cout) / cout;

  return { vainqueurHit, couverture, couvertureComplete, categorie, combinaisons, cout, gain, roi };
}

export interface AggregateInput {
  selection: number[];
  arrivee: number[];
  typePari: string | null;
  rapport?: number | null;
}

export interface Aggregate {
  n: number;
  nAvecRapport: number;
  pctVainqueur: number;     // % où le vainqueur est dans la sélection
  couvertureMoy: number;    // couverture moyenne (sur N)
  pctGagnant: number;
  pctPartiel: number;
  pctPerdant: number;
  /** ROI global = (Σ gains − Σ coûts) / Σ coûts, sur les courses avec rapport connu */
  roiGlobal: number | null;
  tailleSelMoy: number;
}

/** Agrège une liste de pronostics (d'une même méthode) en stats comparables. */
export function aggregate(rows: AggregateInput[]): Aggregate {
  const n = rows.length;
  if (n === 0) {
    return { n: 0, nAvecRapport: 0, pctVainqueur: 0, couvertureMoy: 0, pctGagnant: 0, pctPartiel: 0, pctPerdant: 0, roiGlobal: null, tailleSelMoy: 0 };
  }
  let vainq = 0, couvSum = 0, gag = 0, part = 0, perd = 0, selSum = 0;
  let sumGain = 0, sumCout = 0, nRapport = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const N = betLengthFor(r.typePari);
    const m = computeMetrics({ selection: r.selection, arrivee: r.arrivee, betLength: N, rapport: r.rapport });
    if (m.vainqueurHit) vainq++;
    couvSum += N > 0 ? m.couverture / N : 0;
    if (m.categorie === "GAGNANT") gag++;
    else if (m.categorie === "PARTIEL") part++;
    else perd++;
    selSum += (r.selection || []).length;
    if (r.rapport != null && m.cout > 0) {
      sumGain += m.gain;
      sumCout += m.cout;
      nRapport++;
    }
  }
  const pct = (x: number) => Math.round((x / n) * 100);
  return {
    n,
    nAvecRapport: nRapport,
    pctVainqueur: pct(vainq),
    couvertureMoy: Math.round((couvSum / n) * 100) / 100,
    pctGagnant: pct(gag),
    pctPartiel: pct(part),
    pctPerdant: pct(perd),
    roiGlobal: sumCout > 0 ? Math.round(((sumGain - sumCout) / sumCout) * 1000) / 1000 : null,
    tailleSelMoy: Math.round((selSum / n) * 10) / 10,
  };
}
