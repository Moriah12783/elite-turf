/**
 * Archive du Radar de la presse — calculs PURS pour la page /admin/radar.
 *
 * Source = `radar_snapshots` (scellement quotidien write-once, PR #304) : ce qui
 * a réellement été montré au public, PAS un recalcul. On confronte chaque
 * sélection scellée à l'arrivée officielle et on compte les placés (top 5),
 * bloc par bloc (base / value / coup) — la lecture que Steph utilise pour ses
 * recherches.
 *
 * Le point de comparaison « hasard » = espérance hypergéométrique d'une
 * sélection aléatoire de même taille : 5 × taille / nb_partants. C'est lui qui
 * donne son sens à la moyenne de placés (3,6/5 ne veut rien dire seul ; face à
 * 2,6 attendu par le hasard, si).
 *
 * Module PUR : aucune I/O, ES5-safe (tsconfig sans target — pas de Set/Map
 * itérés, pas de spread d'itérable).
 */

/** Une ligne de `radar_snapshots` + son arrivée officielle (vide si non courue). */
export interface SnapshotArchiveInput {
  date_course:    string;
  origine:        string;               // 'live' | 'reconstitution'
  reunion_course: string | null;
  hippodrome:     string | null;
  type_pari:      string | null;
  nb_partants:    number | null;
  nb_sources:     number;
  base:           number[];
  value:          number[];
  coup:           number[];
  selection:      number[];
  favori_presse:  { numero: number } | null;
  favori_marche:  { numero: number } | null;
  arrivee:        number[];
}

export interface ArchiveRow extends SnapshotArchiveInput {
  /** Les 5 premiers de l'arrivée (vide si course non jugée). */
  top5:             number[];
  /** null = pas d'arrivée → non jugeable. */
  placesTop5:       number | null;
  basePlaces:       number | null;
  valuePlaces:      number | null;
  coupPlaces:       number | null;
  /** Le 1er de l'arrivée est dans la sélection. */
  vainqueurCouvert: boolean | null;
  /** Espérance hasard : 5 × taille sélection / nb_partants (null si inconnue). */
  hasardAttendu:    number | null;
}

export interface BlocAgg {
  /** placés cumulés du bloc sur les courses jugées */
  places: number;
  /** slots cumulés du bloc (taille réelle du bloc, pas la taille théorique) */
  slots:  number;
}

export interface ArchiveAgg {
  nTotal:             number;
  nJugees:            number;
  placesTotal:        number;
  /** moyenne de placés par course jugée (null si aucune) */
  placesMoyenne:      number | null;
  /** moyenne de l'espérance hasard sur les courses jugées où nb_partants est connu */
  hasardMoyen:        number | null;
  pctVainqueurCouvert: number | null;
  nCinqSurCinq:       number;
  base:               BlocAgg;
  value:              BlocAgg;
  coup:               BlocAgg;
}

/** Combien de numéros de `nums` figurent dans `top5`. ES5-safe. */
function dansTop5(nums: number[], top5: number[]): number {
  let n = 0;
  for (let i = 0; i < nums.length; i++) {
    if (top5.indexOf(nums[i]) !== -1) n++;
  }
  return n;
}

/** Enrichit une ligne scellée avec ses compteurs de placés. PUR. */
export function computeArchiveRow(input: SnapshotArchiveInput): ArchiveRow {
  const top5 = (input.arrivee || []).slice(0, 5);
  // On ne juge QUE si le top 5 est complet. Une arrivée partielle (saisie en
  // cours, podium tronqué, disqualifications au trot laissant < 5 classés)
  // plafonne mécaniquement les placés à sa longueur : la compter « x/5 »
  // tirerait la moyenne vers le bas contre un hasard calculé, lui, pour 5
  // places. Mieux vaut « pas encore jugée » qu'un chiffre faussement pessimiste.
  const jugeable = top5.length >= 5;

  const taille = (input.selection || []).length;
  // Espérance hypergéométrique du nombre de placés d'un tirage aléatoire de
  // `taille` chevaux : taille × (places / partants), avec places = min(5,
  // partants). Le min borne le cas — rarissime ici — d'un champ de moins de 5.
  const hasardAttendu =
    input.nb_partants != null && input.nb_partants > 0 && taille > 0
      ? (taille * Math.min(5, input.nb_partants)) / input.nb_partants
      : null;

  return {
    ...input,
    top5,
    placesTop5:       jugeable ? dansTop5(input.selection || [], top5) : null,
    basePlaces:       jugeable ? dansTop5(input.base || [], top5) : null,
    valuePlaces:      jugeable ? dansTop5(input.value || [], top5) : null,
    coupPlaces:       jugeable ? dansTop5(input.coup || [], top5) : null,
    vainqueurCouvert: jugeable ? (input.selection || []).indexOf(top5[0]) !== -1 : null,
    hasardAttendu,
  };
}

/** Agrège les lignes jugées. PUR. */
export function aggregateArchive(rows: ArchiveRow[]): ArchiveAgg {
  const agg: ArchiveAgg = {
    nTotal: rows.length,
    nJugees: 0,
    placesTotal: 0,
    placesMoyenne: null,
    hasardMoyen: null,
    pctVainqueurCouvert: null,
    nCinqSurCinq: 0,
    base:  { places: 0, slots: 0 },
    value: { places: 0, slots: 0 },
    coup:  { places: 0, slots: 0 },
  };

  let hasardSomme = 0;
  let hasardN = 0;
  let vainqueurs = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.placesTop5 == null) continue;
    agg.nJugees++;
    agg.placesTotal += r.placesTop5;
    if (r.placesTop5 >= 5) agg.nCinqSurCinq++;
    if (r.vainqueurCouvert) vainqueurs++;
    agg.base.places  += r.basePlaces  || 0;
    agg.base.slots   += (r.base  || []).length;
    agg.value.places += r.valuePlaces || 0;
    agg.value.slots  += (r.value || []).length;
    agg.coup.places  += r.coupPlaces  || 0;
    agg.coup.slots   += (r.coup  || []).length;
    if (r.hasardAttendu != null) { hasardSomme += r.hasardAttendu; hasardN++; }
  }

  if (agg.nJugees > 0) {
    agg.placesMoyenne = agg.placesTotal / agg.nJugees;
    agg.pctVainqueurCouvert = Math.round((vainqueurs / agg.nJugees) * 100);
  }
  if (hasardN > 0) agg.hasardMoyen = hasardSomme / hasardN;

  return agg;
}
