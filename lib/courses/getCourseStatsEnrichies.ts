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
 * Stratégie de matching : par CLÉ d'identité (lib/seo/cles-acteurs.ts) — le
 * partant « M.BARZALONA » (format PMU) trouve la fiche « M. Barzalona » ; le
 * slug renvoyé est celui de la fiche (lien de la page course).
 * Si un cheval n'a pas encore d'entrée en table `chevaux` (course très récente,
 * cron pas encore passé), on retourne null pour ses stats historiques —
 * l'UI handle gracefully avec un fallback "Données en cours de constitution".
 */

import { createServiceClient } from "@/lib/supabase/server";
import { cleActeur, nettoyerNomActeur } from "@/lib/seo/cles-acteurs";
import { parseMusique } from "./musique";
import {
  MIN_COURSES_FIABLES,
  type PartantInput,
  type PartantEnrichi,
  type StatsHistoriques,
  type CourseStatsEnrichies,
} from "./stats-types";

// Ré-exports pour rétro-compat avec les imports existants
// (les nouveaux call-sites devraient importer directement depuis ./stats-types).
export { MIN_COURSES_FIABLES };
export type { PartantInput, PartantEnrichi, StatsHistoriques, CourseStatsEnrichies };

// ── Helpers internes ──────────────────────────────────────────────────────

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

  // ── 1. Extraire les clés uniques pour batch query ───────────────────────
  const chevauxCles    = Array.from(new Set(partants
    .map((p) => cleActeur("chevaux", p.nom_cheval)).filter(Boolean)));
  const jockeysCles    = Array.from(new Set(partants
    .map((p) => cleActeur("jockeys", p.jockey)).filter(Boolean)));
  const entraineursCles = Array.from(new Set(partants
    .map((p) => cleActeur("entraineurs", p.entraineur)).filter(Boolean)));

  // ── 2. 3 queries parallèles ─────────────────────────────────────────────
  const [chevauxRes, jockeysRes, entraineursRes] = await Promise.all([
    chevauxCles.length > 0
      ? supabase.from("chevaux")
          .select("cle, slug, nb_courses, nb_victoires, nb_places")
          .in("cle", chevauxCles)
      : Promise.resolve({ data: [], error: null }),
    jockeysCles.length > 0
      ? supabase.from("jockeys")
          .select("cle, slug, nb_courses, nb_victoires, nb_places, nom")
          .in("cle", jockeysCles)
      : Promise.resolve({ data: [], error: null }),
    entraineursCles.length > 0
      ? supabase.from("entraineurs")
          .select("cle, slug, nb_courses, nb_victoires, nb_places, nom")
          .in("cle", entraineursCles)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const chevauxMap     = new Map<string, any>((chevauxRes.data     ?? []).map((r: any) => [r.cle, r]));
  const jockeysMap     = new Map<string, any>((jockeysRes.data     ?? []).map((r: any) => [r.cle, r]));
  const entraineursMap = new Map<string, any>((entraineursRes.data ?? []).map((r: any) => [r.cle, r]));

  // ── 3. Calculer maxInvCote pour normalisation du score "cote" ─────────
  // Le favori (cote la plus basse) a 1/cote le plus haut → contribution max
  const cotesValides = partants.map((p) => p.cote).filter((c): c is number => c != null && c > 0);
  const maxInvCote = cotesValides.length > 0 ? 1 / Math.min(...cotesValides) : 1;

  // ── 4. Enrichir chaque partant ──────────────────────────────────────────
  const enrichis: PartantEnrichi[] = partants.map((p) => {
    const rowCheval     = chevauxMap.get(cleActeur("chevaux", p.nom_cheval));
    const rowJockey     = jockeysMap.get(cleActeur("jockeys", p.jockey));
    const rowEntraineur = entraineursMap.get(cleActeur("entraineurs", p.entraineur));

    // `slug` = celui de la fiche (lien), pas celui de la graphie du partant.
    const stats_cheval     = toStatsHistoriques(rowCheval);
    const stats_jockey     = toStatsHistoriques(rowJockey);
    const stats_entraineur = toStatsHistoriques(rowEntraineur);

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
    top_jockeys.push({ ...p.stats_jockey, nom: nettoyerNomActeur("jockeys", p.jockey) });
  }
  top_jockeys.sort((a, b) => (b.taux_victoire ?? 0) - (a.taux_victoire ?? 0));

  const entraineursSeen = new Set<string>();
  const top_entraineurs: Array<StatsHistoriques & { nom: string }> = [];
  for (const p of enrichis) {
    if (!p.entraineur || !p.stats_entraineur || p.stats_entraineur.nb_courses < MIN_COURSES_FIABLES) continue;
    if (entraineursSeen.has(p.stats_entraineur.slug)) continue;
    entraineursSeen.add(p.stats_entraineur.slug);
    top_entraineurs.push({ ...p.stats_entraineur, nom: nettoyerNomActeur("entraineurs", p.entraineur) });
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
