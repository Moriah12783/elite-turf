/**
 * lib/courses/getCourseStatsEnrichies.ts
 *
 * Helper serveur qui enrichit les partants d'une course avec leurs stats
 * HISTORIQUES (chevaux + jockeys + entraineurs) issues des tables SEO
 * peuplées par le cron ETL (lib/sync/seo-etl.ts).
 *
 * Pourquoi : la section "Statistiques" de la page course ne consommait
 * jusqu'ici QUE les données locales du field (cote, musique). Or on a en BDD
 * les nb_courses / nb_victoires / nb_places de chaque cheval/jockey/entraineur,
 * mises à jour par le cron quotidien. On les croise ici pour montrer du vrai
 * data analytics au visiteur (objectif : conversion abonnement).
 *
 * Pattern : 3 queries Supabase parallèles (chevaux/jockeys/entraineurs)
 * avec filtre `.in("slug", [...])`. ZÉRO N+1. ~50-150ms total.
 *
 * Stratégie de matching : slug-based (déterministe via slugify(nom)).
 * Si un cheval n'a pas encore d'entrée en table `chevaux` (course très récente,
 * cron pas encore passé), on retourne null pour ses stats historiques —
 * l'UI handle gracefully avec un fallback "Données en cours de constitution".
 */

import { createServiceClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/seo/slugs";

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

// ── Helpers internes ──────────────────────────────────────────────────────

/**
 * Parse la musique PMU pour extraire forme récente (top-3 ratio).
 * Format musique : `1p2p3h0a5m...` où chiffre = position, lettre = discipline.
 * Note : 0 = non placé. On compte uniquement les chiffres ≥ 1 comme courses
 * valides ; les "0" sont des non-classés (peut être Da, Tb, etc.).
 */
function parseMusique(musique: string | null | undefined): { top3: number; courses: number; ratio: number } | null {
  if (!musique) return null;
  const nums = (musique.match(/\d+/g) ?? [])
    .map(Number)
    .filter((n) => n > 0 && n < 100); // garde-fou pattern réaliste
  if (nums.length === 0) return null;
  const top3 = nums.filter((n) => n <= 3).length;
  return { top3, courses: nums.length, ratio: top3 / nums.length };
}

/** Mappe row Supabase → StatsHistoriques. */
function toStatsHistoriques(row: {
  nb_courses?:   number | null;
  nb_victoires?: number | null;
  nb_places?:    number | null;
  slug?:         string | null;
} | null | undefined): StatsHistoriques | null {
  if (!row) return null;
  const nb_courses   = row.nb_courses   ?? 0;
  const nb_victoires = row.nb_victoires ?? 0;
  const nb_places    = row.nb_places    ?? 0;
  return {
    nb_courses,
    nb_victoires,
    nb_places,
    taux_victoire: nb_courses > 0 ? (nb_victoires / nb_courses) * 100 : null,
    taux_place:    nb_courses > 0 ? (nb_places    / nb_courses) * 100 : null,
    slug:          row.slug ?? "",
  };
}

// ── Helper public principal ───────────────────────────────────────────────

/**
 * Enrichit la liste des partants avec leurs stats historiques + scores.
 * Une seule fonction, 3 queries Supabase en parallèle, garanti sans N+1.
 *
 * Renvoie un objet riche avec partants enrichis + classements pré-calculés
 * (quinté probable, vedettes, value bets, top acteurs) pour que la UI n'ait
 * plus qu'à itérer et afficher.
 */
export async function getCourseStatsEnrichies(
  partants: PartantInput[],
): Promise<CourseStatsEnrichies> {
  if (!partants || partants.length === 0) {
    return {
      partants: [], quinte_probable: [], vedettes: [], value_bets: [],
      top_jockeys: [], top_entraineurs: [],
      meta: { chevaux_avec_stats: 0, jockeys_avec_stats: 0, entraineurs_avec_stats: 0 },
    };
  }

  const supabase = createServiceClient();

  // ── 1. Extraire slugs uniques pour batch query ──────────────────────────
  const chevauxSlugs    = Array.from(new Set(partants
    .map((p) => slugify(p.nom_cheval)).filter(Boolean)));
  const jockeysSlugs    = Array.from(new Set(partants
    .map((p) => slugify(p.jockey ?? "")).filter(Boolean)));
  const entraineursSlugs = Array.from(new Set(partants
    .map((p) => slugify(p.entraineur ?? "")).filter(Boolean)));

  // ── 2. 3 queries parallèles ─────────────────────────────────────────────
  const [chevauxRes, jockeysRes, entraineursRes] = await Promise.all([
    chevauxSlugs.length > 0
      ? supabase.from("chevaux")
          .select("slug, nb_courses, nb_victoires, nb_places")
          .in("slug", chevauxSlugs)
      : Promise.resolve({ data: [], error: null }),
    jockeysSlugs.length > 0
      ? supabase.from("jockeys")
          .select("slug, nb_courses, nb_victoires, nb_places, nom")
          .in("slug", jockeysSlugs)
      : Promise.resolve({ data: [], error: null }),
    entraineursSlugs.length > 0
      ? supabase.from("entraineurs")
          .select("slug, nb_courses, nb_victoires, nb_places, nom")
          .in("slug", entraineursSlugs)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const chevauxMap     = new Map<string, any>((chevauxRes.data     ?? []).map((r: any) => [r.slug, r]));
  const jockeysMap     = new Map<string, any>((jockeysRes.data     ?? []).map((r: any) => [r.slug, r]));
  const entraineursMap = new Map<string, any>((entraineursRes.data ?? []).map((r: any) => [r.slug, r]));

  // ── 3. Calculer maxInvCote pour normalisation du score "cote" ─────────
  // Le favori (cote la plus basse) a 1/cote le plus haut → contribution max
  const cotesValides = partants.map((p) => p.cote).filter((c): c is number => c != null && c > 0);
  const maxInvCote = cotesValides.length > 0 ? 1 / Math.min(...cotesValides) : 1;

  // ── 4. Enrichir chaque partant ──────────────────────────────────────────
  const enrichis: PartantEnrichi[] = partants.map((p) => {
    const slugCheval     = slugify(p.nom_cheval);
    const slugJockey     = slugify(p.jockey ?? "");
    const slugEntraineur = slugify(p.entraineur ?? "");

    const rowCheval     = chevauxMap.get(slugCheval);
    const rowJockey     = jockeysMap.get(slugJockey);
    const rowEntraineur = entraineursMap.get(slugEntraineur);

    const stats_cheval     = toStatsHistoriques(rowCheval     ? { ...rowCheval,     slug: slugCheval     } : null);
    const stats_jockey     = toStatsHistoriques(rowJockey     ? { ...rowJockey,     slug: slugJockey     } : null);
    const stats_entraineur = toStatsHistoriques(rowEntraineur ? { ...rowEntraineur, slug: slugEntraineur } : null);

    const forme_musique = parseMusique(p.musique);

    // ── Calcul score composite ───────────────────────────────────────────
    const W_COTE          = 0.35;
    const W_VICT_CHEVAL   = 0.30;
    const W_FORME_MUSIQUE = 0.20;
    const W_VICT_JOCKEY   = 0.15;

    const contrib_cote = p.cote && p.cote > 0 && maxInvCote > 0
      ? W_COTE * ((1 / p.cote) / maxInvCote)
      : 0;
    const contrib_vict_cheval = stats_cheval && stats_cheval.nb_courses >= MIN_COURSES_FIABLES && stats_cheval.taux_victoire !== null
      ? W_VICT_CHEVAL * Math.min(1, stats_cheval.taux_victoire / 30) // 30%+ = max
      : 0;
    const contrib_forme = forme_musique
      ? W_FORME_MUSIQUE * forme_musique.ratio
      : 0;
    const contrib_vict_jockey = stats_jockey && stats_jockey.nb_courses >= MIN_COURSES_FIABLES && stats_jockey.taux_victoire !== null
      ? W_VICT_JOCKEY * Math.min(1, stats_jockey.taux_victoire / 25) // 25%+ = max
      : 0;

    const score_composite = contrib_cote + contrib_vict_cheval + contrib_forme + contrib_vict_jockey;

    // ── Badges qualitatifs ────────────────────────────────────────────────
    const vedette = !!(stats_cheval
      && stats_cheval.nb_courses >= MIN_COURSES_FIABLES
      && (stats_cheval.taux_victoire ?? 0) >= 25);
    const value_bet = !!(p.cote && p.cote >= 8
      && stats_cheval
      && stats_cheval.nb_courses >= MIN_COURSES_FIABLES
      && (stats_cheval.taux_victoire ?? 0) >= 15);

    return {
      ...p,
      stats_cheval,
      stats_jockey,
      stats_entraineur,
      forme_musique,
      score_composite,
      score_breakdown: {
        cote:          contrib_cote,
        vict_cheval:   contrib_vict_cheval,
        forme_musique: contrib_forme,
        vict_jockey:   contrib_vict_jockey,
      },
      badges: {
        vedette,
        value_bet,
        favori: false, // sera fixé après tri
      },
    };
  });

  // ── 5. Tagger le favori (rang 1 par cote ASC) ───────────────────────────
  const byCote = [...enrichis]
    .filter((p) => p.cote != null && p.cote > 0)
    .sort((a, b) => (a.cote! - b.cote!));
  if (byCote.length > 0) {
    const favoriId = byCote[0].id;
    const fav = enrichis.find((e) => e.id === favoriId);
    if (fav) fav.badges.favori = true;
  }

  // ── 6. Classements pré-calculés ─────────────────────────────────────────
  const quinte_probable = [...enrichis]
    .sort((a, b) => b.score_composite - a.score_composite)
    .slice(0, 5);

  const vedettes = enrichis
    .filter((p) => p.badges.vedette)
    .sort((a, b) => (b.stats_cheval?.taux_victoire ?? 0) - (a.stats_cheval?.taux_victoire ?? 0))
    .slice(0, 3);

  const value_bets = enrichis
    .filter((p) => p.badges.value_bet && !p.badges.favori)
    .sort((a, b) => (b.stats_cheval?.taux_victoire ?? 0) - (a.stats_cheval?.taux_victoire ?? 0))
    .slice(0, 3);

  // ── 7. Top jockeys/entraineurs du field ────────────────────────────────
  // On déduplique par slug (un jockey peut monter 2 chevaux dans la course)
  const jockeysSeen = new Set<string>();
  const top_jockeys: Array<StatsHistoriques & { nom: string }> = [];
  for (const p of enrichis) {
    if (!p.jockey || !p.stats_jockey || p.stats_jockey.nb_courses < MIN_COURSES_FIABLES) continue;
    if (jockeysSeen.has(p.stats_jockey.slug)) continue;
    jockeysSeen.add(p.stats_jockey.slug);
    top_jockeys.push({ ...p.stats_jockey, nom: p.jockey });
  }
  top_jockeys.sort((a, b) => (b.taux_victoire ?? 0) - (a.taux_victoire ?? 0));

  const entraineursSeen = new Set<string>();
  const top_entraineurs: Array<StatsHistoriques & { nom: string }> = [];
  for (const p of enrichis) {
    if (!p.entraineur || !p.stats_entraineur || p.stats_entraineur.nb_courses < MIN_COURSES_FIABLES) continue;
    if (entraineursSeen.has(p.stats_entraineur.slug)) continue;
    entraineursSeen.add(p.stats_entraineur.slug);
    top_entraineurs.push({ ...p.stats_entraineur, nom: p.entraineur });
  }
  top_entraineurs.sort((a, b) => (b.taux_victoire ?? 0) - (a.taux_victoire ?? 0));

  return {
    partants:        enrichis,
    quinte_probable,
    vedettes,
    value_bets,
    top_jockeys:     top_jockeys.slice(0, 3),
    top_entraineurs: top_entraineurs.slice(0, 3),
    meta: {
      chevaux_avec_stats:     enrichis.filter((p) => p.stats_cheval).length,
      jockeys_avec_stats:     enrichis.filter((p) => p.stats_jockey).length,
      entraineurs_avec_stats: enrichis.filter((p) => p.stats_entraineur).length,
    },
  };
}

// MIN_COURSES_FIABLES est exportée en haut du fichier (sert avant la fonction).
