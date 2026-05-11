/**
 * lib/courses/stats-types.ts
 *
 * Types + constantes partagés entre :
 *   - `lib/courses/getCourseStatsEnrichies.ts` (serveur, imports Supabase)
 *   - `components/courses/TabStatsRich.tsx`     (client, "use client")
 *
 * Pourquoi un fichier séparé : `getCourseStatsEnrichies.ts` importe
 * `createServiceClient` qui dépend de `next/headers` (server-only). Si on
 * importait depuis ce fichier dans un client component, le bundler tirerait
 * tout l'arbre serveur → erreur de build "next/headers in client bundle".
 *
 * Ce fichier ne contient AUCUN import serveur. Il est safe à importer
 * depuis client et serveur indifféremment.
 */

/**
 * Seuil minimal de courses BDD pour considérer un taux historique comme fiable.
 * Sous ce seuil, les pourcentages sont du bruit (1 victoire sur 2 courses = 50%
 * mais signifie rien) ; on les neutralise dans le score et on filtre les
 * acteurs du field affichés dans "Top jockeys/entraineurs".
 */
export const MIN_COURSES_FIABLES = 5;

// ── Types ─────────────────────────────────────────────────────────────────

export interface PartantInput {
  id:          string;
  numero:      number;
  nom_cheval:  string;
  jockey?:     string | null;
  entraineur?: string | null;
  cote?:       number | null;
  musique?:    string | null;
  poids_kg?:   number | null;
}

/** Stats historiques minimales pour un acteur (cheval/jockey/entraineur). */
export interface StatsHistoriques {
  nb_courses:    number;
  nb_victoires:  number;
  nb_places:     number;
  taux_victoire: number | null;   // % (null si nb_courses=0)
  taux_place:    number | null;   // % (null si nb_courses=0)
  slug:          string;          // pour lien interne /chevaux/{slug}
}

/** Partant + ses stats historiques + score composite. */
export interface PartantEnrichi extends PartantInput {
  /** Stats historiques du cheval (null si pas encore en BDD chevaux). */
  stats_cheval:     StatsHistoriques | null;
  /** Stats historiques du jockey (null si pas encore en BDD jockeys). */
  stats_jockey:     StatsHistoriques | null;
  /** Stats historiques de l'entraîneur (null si pas encore en BDD entraineurs). */
  stats_entraineur: StatsHistoriques | null;

  /** Forme récente parsée depuis musique : top-3 sur les N dernières courses. */
  forme_musique: { top3: number; courses: number; ratio: number } | null;

  /**
   * Score composite [0,1] mélangeant cote + taux historique + forme + jockey.
   * Pondération : 0.35 (cote) + 0.30 (vict_hist cheval) + 0.20 (musique) + 0.15 (vict_hist jockey).
   * Composantes manquantes (null) sont traitées comme 0 mais leur poids reste.
   */
  score_composite: number;

  /** Détail du calcul du score (pour tooltip "transparence"). */
  score_breakdown: {
    cote:           number;   // contribution [0,0.35]
    vict_cheval:    number;   // contribution [0,0.30]
    forme_musique:  number;   // contribution [0,0.20]
    vict_jockey:    number;   // contribution [0,0.15]
  };

  /** Labels qualitatifs calculés pour l'UI. */
  badges: {
    vedette:    boolean;  // taux_victoire_cheval ≥ 25% ET nb_courses ≥ 5
    value_bet:  boolean;  // cote ≥ 8 ET taux_victoire_cheval ≥ 15% ET nb_courses ≥ 5
    favori:     boolean;  // rank 1 du field par cote
  };
}

export interface CourseStatsEnrichies {
  partants:        PartantEnrichi[];
  /** Top 5 par score composite (= "quinté probable"). */
  quinte_probable: PartantEnrichi[];
  /** Top 3 chevaux "vedettes" (badges.vedette = true). */
  vedettes:        PartantEnrichi[];
  /** Outsiders intéressants (badges.value_bet = true). */
  value_bets:      PartantEnrichi[];
  /** Top jockeys du field par taux historique. */
  top_jockeys:     Array<StatsHistoriques & { nom: string }>;
  /** Top entraineurs du field par taux historique. */
  top_entraineurs: Array<StatsHistoriques & { nom: string }>;

  /** Métadonnées pour signaler la rigueur du calcul. */
  meta: {
    chevaux_avec_stats:     number;
    jockeys_avec_stats:     number;
    entraineurs_avec_stats: number;
  };
}
