/**
 * Banc de mesure — CONSENSUS PRESSE.
 *
 * Mesure la performance de la SÉLECTION du consensus presse (celle affichée par
 * le Radar : base+value+coup) + du FAVORI PRESSE (le plus cité) + du FAVORI
 * MARCHÉ (plus basse cote PMU) VS l'arrivée officielle. But : accumuler jour
 * après jour pour « harmoniser » le choix des chevaux sur des données réelles.
 *
 * PUR, déterministe, testable. Réutilise `betLengthFor` du banc existant.
 */
import { betLengthFor } from "./metrics";

export interface ConsensusDayInput {
  /** sélection consensus (base + value + coup, dédupliquée) */
  selection:    number[];
  /** cheval le plus cité (favori presse), ou null si inconnu */
  favoriPresse: number | null;
  /** plus basse cote PMU réelle (favori marché), ou null si inconnu */
  favoriMarche: number | null;
  /** arrivée officielle ordonnée (arrivee[0] = vainqueur) */
  arrivee:      number[];
  typePari?:    string | null;
}

export interface ConsensusDayHits {
  vainqueurHit:   boolean;  // le vainqueur est dans la sélection
  couverture:     number;   // nb des N premiers présents dans la sélection
  quinteTrouve:   boolean;  // les N premiers sont TOUS dans la sélection
  favPresseWin:   boolean;  // le favori presse gagne
  favPressePlace: boolean;  // le favori presse est dans le top N
  favMarcheWin:   boolean;  // le favori marché gagne
  favMarchePlace: boolean;  // le favori marché est dans le top N
  convergence:    boolean;  // favori presse === favori marché (les 2 connus)
  convergenceWin: boolean;  // convergence ET ce cheval gagne
}

export function computeConsensusHits(d: ConsensusDayInput): ConsensusDayHits {
  const arr = Array.isArray(d.arrivee) ? d.arrivee : [];
  const sel = Array.isArray(d.selection) ? d.selection : [];
  const N = betLengthFor(d.typePari);
  const topN = arr.slice(0, N);
  const inSel = (n: number | null) => n != null && sel.indexOf(n) !== -1;
  const inTop = (n: number | null) => n != null && topN.indexOf(n) !== -1;

  let couverture = 0;
  for (let i = 0; i < topN.length; i++) if (sel.indexOf(topN[i]) !== -1) couverture++;

  const vainqueur = arr.length > 0 ? arr[0] : null;
  const fp = d.favoriPresse, fm = d.favoriMarche;
  const convergence = fp != null && fm != null && fp === fm;

  return {
    vainqueurHit:   inSel(vainqueur),
    couverture,
    quinteTrouve:   topN.length >= N && couverture >= N,
    favPresseWin:   fp != null && vainqueur === fp,
    favPressePlace: inTop(fp),
    favMarcheWin:   fm != null && vainqueur === fm,
    favMarchePlace: inTop(fm),
    convergence,
    convergenceWin: convergence && vainqueur === fp,
  };
}

export interface ConsensusAggregate {
  n:                 number;
  pctVainqueur:      number;  // % où le vainqueur est dans la sélection
  couvertureMoy:    number;  // couverture moyenne sur N (0..1 × N), arrondi 2 déc /N
  pctQuinte:         number;  // % couverture complète (les N trouvés)
  nFavPresse:        number;  // nb de jours où le favori presse est connu
  pctFavPresseWin:   number;
  pctFavPressePlace: number;
  nFavMarche:        number;  // nb de jours où le favori marché est connu
  pctFavMarcheWin:   number;
  pctFavMarchePlace: number;
  nConvergence:      number;  // nb de jours où presse === marché
  pctConvergenceWin: number;  // parmi ces jours, % où le cheval gagne
}

export function aggregateConsensus(days: ConsensusDayInput[]): ConsensusAggregate {
  const empty: ConsensusAggregate = {
    n: 0, pctVainqueur: 0, couvertureMoy: 0, pctQuinte: 0,
    nFavPresse: 0, pctFavPresseWin: 0, pctFavPressePlace: 0,
    nFavMarche: 0, pctFavMarcheWin: 0, pctFavMarchePlace: 0,
    nConvergence: 0, pctConvergenceWin: 0,
  };
  const n = days.length;
  if (n === 0) return empty;

  let vainq = 0, couvSum = 0, quinte = 0;
  let nFP = 0, fpWin = 0, fpPlace = 0;
  let nFM = 0, fmWin = 0, fmPlace = 0;
  let nConv = 0, convWin = 0;

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const N = betLengthFor(d.typePari);
    const h = computeConsensusHits(d);
    if (h.vainqueurHit) vainq++;
    couvSum += N > 0 ? h.couverture / N : 0;
    if (h.quinteTrouve) quinte++;
    if (d.favoriPresse != null) { nFP++; if (h.favPresseWin) fpWin++; if (h.favPressePlace) fpPlace++; }
    if (d.favoriMarche != null) { nFM++; if (h.favMarcheWin) fmWin++; if (h.favMarchePlace) fmPlace++; }
    if (h.convergence) { nConv++; if (h.convergenceWin) convWin++; }
  }

  const pct = (x: number, den: number) => (den > 0 ? Math.round((x / den) * 100) : 0);
  return {
    n,
    pctVainqueur:      pct(vainq, n),
    couvertureMoy:     Math.round((couvSum / n) * 100) / 100,
    pctQuinte:         pct(quinte, n),
    nFavPresse:        nFP,
    pctFavPresseWin:   pct(fpWin, nFP),
    pctFavPressePlace: pct(fpPlace, nFP),
    nFavMarche:        nFM,
    pctFavMarcheWin:   pct(fmWin, nFM),
    pctFavMarchePlace: pct(fmPlace, nFM),
    nConvergence:      nConv,
    pctConvergenceWin: pct(convWin, nConv),
  };
}
