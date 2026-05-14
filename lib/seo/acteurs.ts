/**
 * Helpers shared par /chevaux/[slug], /jockeys/[slug], /entraineurs/[slug].
 *
 * Stratégie de query :
 *   - Charger l'entité depuis sa table de référence (1 row par slug)
 *   - JOIN partants WHERE nom_cheval/jockey/entraineur = entité.nom
 *     Triplet (course → date, hippodrome, arrivee_officielle) en 1 query.
 *   - Calculer dernières courses + stats avancées (taux victoire, ROI, etc.)
 *
 * Phase 1 (mai 2026) — refonte fiches acteurs premium :
 *   - computeRichStats() : calculs avancés à la volée depuis l'historique
 *     (fixe le bug "0 victoires partout" en attendant le job sync nightly)
 *   - Interface Entite : champs Phase 2 optionnels (pedigree, propriétaire,
 *     gains, robe, etc.) → quand les colonnes seront peuplées, le UI suit.
 */

import { createServiceClient } from "@/lib/supabase/server";

export type EntiteType = "chevaux" | "jockeys" | "entraineurs";

export const COL_MAP: Record<EntiteType, "nom_cheval" | "jockey" | "entraineur"> = {
  chevaux:     "nom_cheval",
  jockeys:     "jockey",
  entraineurs: "entraineur",
};

export const ENTITE_LABEL: Record<EntiteType, { singular: string; plural: string }> = {
  chevaux:     { singular: "Cheval",     plural: "Chevaux"     },
  jockeys:     { singular: "Jockey",     plural: "Jockeys"     },
  entraineurs: { singular: "Entraîneur", plural: "Entraîneurs" },
};

/**
 * Entité référentiel + champs optionnels Phase 2.
 *
 * Les champs `pere_nom`, `mere_nom`, `proprietaire`, etc. seront peuplés
 * par le scraper Geny en Phase 2. Le UI les affiche conditionnellement
 * (rendu null-safe), donc cette interface reste rétro-compatible.
 */
export interface Entite {
  id:        string;
  nom:       string;
  slug:      string;
  nb_courses:         number | null;
  nb_victoires:       number | null;
  nb_places:          number | null;
  derniere_course_at: string | null;
  age?:               number | null;
  sexe?:              string | null;

  // ── Phase 2 (Geny scraper) — peuplés quand les colonnes BDD seront ajoutées
  pere_nom?:         string | null;
  mere_nom?:         string | null;
  mere_pere_nom?:    string | null;
  proprietaire?:     string | null;
  eleveur?:          string | null;
  ecurie?:           string | null;
  robe?:             string | null;
  date_naissance?:   string | null;
  pays_origine?:     string | null;
  gains_totaux_eur?: number | null;
  discipline?:       string | null;
  geny_url?:         string | null;
  photo_url?:        string | null;
}

export interface CourseLine {
  course_id:        string;
  date_course:      string;
  hippodrome_nom:   string | null;
  course_libelle:   string;
  numero_reunion:   number;
  numero_course:    number;
  numero:           number;       // numéro du partant
  cote:             number | null;
  jockey:           string | null;
  entraineur:       string | null;
  nom_cheval:       string | null;
  arrivee:          number | null; // position en arrivée (1, 2, 3, …) ou null
  statut:           string;
}

/**
 * Statistiques riches calculées à la volée depuis l'historique des courses.
 * Évite de dépendre des colonnes BDD `nb_victoires`/`nb_places` qui sont
 * actuellement à 0 (job de sync absent) — bug détecté GSC du 14/05/2026.
 */
export interface RichStats {
  /** Nombre total de courses dans notre historique (terminées + à venir). */
  nb_courses: number;
  /** Courses terminées avec arrivée connue (base de calcul des taux). */
  nb_courses_terminees: number;
  /** Victoires (arrivée = 1). */
  nb_victoires: number;
  /** Places (top 3 : arrivée ∈ {1,2,3}). */
  nb_places: number;
  /** Top 5 (arrivée ∈ {1..5}) — élargit pour les chevaux/jockeys constants. */
  nb_top5: number;
  /** Pourcentages, null si pas de courses terminées. */
  taux_victoire: number | null;
  taux_place:    number | null;
  taux_top5:     number | null;
  /** Cote moyenne / min / max sur les courses où on a la cote. */
  cote_moyenne: number | null;
  cote_min:     number | null;
  cote_max:     number | null;
  /** Top hippodromes fréquentés (nom → count). */
  hippodromes_freq: Array<[string, number]>;
  /** Top partenaires (pour chevaux : jockeys ; pour jockeys/entr. : chevaux). */
  partenaires_freq: Array<[string, number]>;
  /** Forme récente : positions des 10 dernières courses (null = pas terminée). */
  forme_recente: Array<number | null>;
  /** Musique textuelle façon PMU ("1p 3p 0p Da 5p…"). */
  musique_textuelle: string;
  /** Jours écoulés depuis la dernière course (null si jamais couru). */
  jours_derniere_course: number | null;
  /** Statut dérivé : "actif" si dernière course < 60j, sinon "au_repos". */
  statut: "actif" | "au_repos" | "inconnu";
  /** Tendance 90 derniers jours (nb de courses + victoires sur la fenêtre). */
  tendance_90j: { courses: number; victoires: number; places: number };
  /** Meilleur résultat (1 si déjà gagné, sinon plus petite arrivée). */
  meilleur_resultat: number | null;
}

/** Récupère 1 entité par slug. age/sexe sont uniquement sur `chevaux`. */
export async function getEntiteBySlug(
  type: EntiteType,
  slug: string,
): Promise<Entite | null> {
  const supabase = createServiceClient();
  const cols = type === "chevaux"
    ? "id, nom, slug, nb_courses, nb_victoires, nb_places, derniere_course_at, age, sexe"
    : "id, nom, slug, nb_courses, nb_victoires, nb_places, derniere_course_at";
  const { data } = await supabase
    .from(type)
    .select(cols)
    .eq("slug", slug)
    .single();
  return (data as unknown as Entite) ?? null;
}

/**
 * Charge l'historique des courses (dernières N) pour une entité.
 * Pourquoi on stocke en référentiel + on requête partants : pas de FK
 * (pmu-sync inserts en bulk avec juste nom). Index sur partants.{col} rend
 * ce lookup ~1ms même sur 12k rows.
 */
export async function getCoursesForEntite(
  type: EntiteType,
  nom: string,
  limit = 50,
): Promise<CourseLine[]> {
  const col = COL_MAP[type];
  const supabase = createServiceClient();

  // Note : Supabase JS ne supporte pas proprement order sur foreign table
  // imbriquée avec .order("course(date_course)"). On récupère sans tri (cap 500
  // pour conserver la diversité), puis tri en mémoire ci-dessous.
  const { data } = await supabase
    .from("partants")
    .select(`
      numero, cote, jockey, entraineur, nom_cheval,
      course:courses!inner(
        id, date_course, statut, numero_reunion, numero_course, libelle, arrivee_officielle,
        hippodrome:hippodromes(nom)
      )
    `)
    .eq(col, nom)
    .limit(500);

  const lines = (data ?? []).map((row: any) => {
    const c = row.course;
    const hippo = Array.isArray(c?.hippodrome) ? c.hippodrome[0] : c?.hippodrome;
    let arrivee: number | null = null;
    if (Array.isArray(c?.arrivee_officielle) && c.arrivee_officielle.length > 0) {
      const idx = c.arrivee_officielle.indexOf(row.numero);
      arrivee = idx === -1 ? null : idx + 1;
    }
    return {
      course_id:        c.id,
      date_course:      c.date_course,
      hippodrome_nom:   hippo?.nom ?? null,
      course_libelle:   c.libelle,
      numero_reunion:   c.numero_reunion,
      numero_course:    c.numero_course,
      numero:           row.numero,
      cote:             row.cote,
      jockey:           row.jockey,
      entraineur:       row.entraineur,
      nom_cheval:       row.nom_cheval,
      arrivee,
      statut:           c.statut,
    } as CourseLine;
  });
  // Tri en mémoire par date_course desc, puis tronquage à `limit`
  lines.sort((a, b) => b.date_course.localeCompare(a.date_course));
  return lines.slice(0, limit);
}

/** Top entités par activité (pour pages index). */
export async function getTopEntites(
  type: EntiteType,
  limit = 100,
): Promise<Entite[]> {
  const supabase = createServiceClient();
  // Tri par activité récente (derniere_course_at DESC), puis par nb_courses
  const { data } = await supabase
    .from(type)
    .select("id, nom, slug, nb_courses, nb_victoires, nb_places, derniere_course_at")
    .order("derniere_course_at", { ascending: false, nullsFirst: false })
    .order("nb_courses",         { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as Entite[];
}

export function tauxVictoire(e: Pick<Entite, "nb_courses" | "nb_victoires">): number | null {
  if (!e.nb_courses || e.nb_courses === 0) return null;
  return ((e.nb_victoires ?? 0) / e.nb_courses) * 100;
}

export function tauxPlace(e: Pick<Entite, "nb_courses" | "nb_places">): number | null {
  if (!e.nb_courses || e.nb_courses === 0) return null;
  return ((e.nb_places ?? 0) / e.nb_courses) * 100;
}

/**
 * Convertit une position en code musique PMU.
 * 1-9 : chiffre direct (1p, 2p…), 10+ : "0", Da/Ra/T conservés tels quels.
 * Pour cette Phase 1, on n'a pas le code "abandon" en BDD → on suppose
 * que toute course TERMINE sans arrivée = abandon = "Da".
 */
function positionToMusiqueCode(pos: number | null, statut: string): string {
  if (pos === null) {
    // Course pas terminée → on l'omet (sera filtré par le caller)
    if (statut !== "TERMINE") return "";
    // Course terminée sans position → cheval abandonné/disqualifié
    return "Da";
  }
  if (pos >= 1 && pos <= 9) return `${pos}p`;
  return `0p`; // 10e ou plus
}

/**
 * Calcule toutes les stats riches à la volée depuis l'historique.
 * Cette fonction est le cœur de la Phase 1 : elle compense l'absence du
 * job de sync nightly qui devrait peupler nb_victoires/nb_places en BDD.
 */
export function computeRichStats(
  type: EntiteType,
  rows: CourseLine[],
): RichStats {
  const today = new Date();
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);

  const terminees = rows.filter((r) => r.statut === "TERMINE");
  const avecArrivee = terminees.filter((r) => r.arrivee !== null);

  const nb_courses = rows.length;
  const nb_courses_terminees = terminees.length;
  const nb_victoires = avecArrivee.filter((r) => r.arrivee === 1).length;
  const nb_places   = avecArrivee.filter((r) => r.arrivee !== null && r.arrivee <= 3).length;
  const nb_top5     = avecArrivee.filter((r) => r.arrivee !== null && r.arrivee <= 5).length;

  const taux_victoire = nb_courses_terminees > 0 ? (nb_victoires / nb_courses_terminees) * 100 : null;
  const taux_place    = nb_courses_terminees > 0 ? (nb_places   / nb_courses_terminees) * 100 : null;
  const taux_top5     = nb_courses_terminees > 0 ? (nb_top5     / nb_courses_terminees) * 100 : null;

  // ── Cotes : moyenne / extrêmes sur les courses où la cote est connue ──
  const cotes = rows.map((r) => r.cote).filter((c): c is number => typeof c === "number");
  const cote_moyenne = cotes.length > 0 ? cotes.reduce((a, b) => a + b, 0) / cotes.length : null;
  const cote_min     = cotes.length > 0 ? Math.min(...cotes) : null;
  const cote_max     = cotes.length > 0 ? Math.max(...cotes) : null;

  // ── Top hippodromes ──
  const hippoMap = new Map<string, number>();
  for (const r of rows) {
    if (r.hippodrome_nom) hippoMap.set(r.hippodrome_nom, (hippoMap.get(r.hippodrome_nom) ?? 0) + 1);
  }
  const hippodromes_freq = Array.from(hippoMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // ── Top partenaires (jockeys pour cheval, chevaux pour jockey/entraîneur) ──
  const partMap = new Map<string, number>();
  for (const r of rows) {
    let key: string | null = null;
    if (type === "chevaux") key = r.jockey;
    else key = r.nom_cheval;
    if (key) partMap.set(key, (partMap.get(key) ?? 0) + 1);
  }
  const partenaires_freq = Array.from(partMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // ── Forme récente : 10 dernières positions (rows déjà triées DESC) ──
  const forme_recente = rows.slice(0, 10).map((r) => r.arrivee);

  // ── Musique textuelle (10 dernières courses terminées) ──
  const musiqueParts: string[] = [];
  for (const r of rows.slice(0, 15)) {
    const code = positionToMusiqueCode(r.arrivee, r.statut);
    if (code) musiqueParts.push(code);
    if (musiqueParts.length >= 10) break;
  }
  const musique_textuelle = musiqueParts.join(" ");

  // ── Jours depuis dernière course terminée ──
  const derniereTerminee = terminees[0];
  let jours_derniere_course: number | null = null;
  if (derniereTerminee) {
    const d = new Date(derniereTerminee.date_course + "T12:00:00");
    jours_derniere_course = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  }

  // ── Statut dérivé ──
  let statut: RichStats["statut"] = "inconnu";
  if (jours_derniere_course !== null) {
    statut = jours_derniere_course <= 60 ? "actif" : "au_repos";
  }

  // ── Tendance 90 derniers jours ──
  const courses90j = rows.filter((r) => {
    const d = new Date(r.date_course + "T12:00:00");
    return d >= ninetyDaysAgo && r.statut === "TERMINE";
  });
  const tendance_90j = {
    courses:   courses90j.length,
    victoires: courses90j.filter((r) => r.arrivee === 1).length,
    places:    courses90j.filter((r) => r.arrivee !== null && r.arrivee <= 3).length,
  };

  // ── Meilleur résultat (plus petite position en arrivée) ──
  const positions = avecArrivee.map((r) => r.arrivee).filter((p): p is number => p !== null);
  const meilleur_resultat = positions.length > 0 ? Math.min(...positions) : null;

  return {
    nb_courses,
    nb_courses_terminees,
    nb_victoires,
    nb_places,
    nb_top5,
    taux_victoire,
    taux_place,
    taux_top5,
    cote_moyenne,
    cote_min,
    cote_max,
    hippodromes_freq,
    partenaires_freq,
    forme_recente,
    musique_textuelle,
    jours_derniere_course,
    statut,
    tendance_90j,
    meilleur_resultat,
  };
}

/**
 * Formate le sexe d'un cheval en label lisible.
 * Accepte les codes courts ("H", "M", "F") et les codes numériques Geny
 * (1=mâle, 2=femelle, 3=hongre, etc. — convention non-standard mais présente en BDD).
 */
export function formatSexeCheval(sexe: string | null | undefined): string {
  if (!sexe) return "—";
  const s = sexe.trim().toUpperCase();
  if (s === "H" || s === "3") return "Hongre";
  if (s === "M" || s === "1") return "Mâle";
  if (s === "F" || s === "2") return "Femelle";
  if (s === "4") return "Jument";
  if (s === "5" || s === "6") return "Hongre";
  return sexe;
}

/**
 * Title SEO dynamique enrichi pour les fiches acteurs.
 * Stratégie CTR : emoji visuel + chiffres clés + qualificatif (Hongre, Femelle…).
 * Limite cible : ~65 chars (sinon Google tronque dans SERP).
 */
export function buildActeurTitle(
  type: EntiteType,
  entite: Entite,
  stats: RichStats,
): string {
  const emoji = type === "chevaux" ? "🏇" : type === "jockeys" ? "🏆" : "⭐";
  const nomCap = entite.nom;

  if (type === "chevaux") {
    const sexe = formatSexeCheval(entite.sexe);
    const age = entite.age ? `${entite.age} ans` : "";
    const qualif = [sexe, age].filter(Boolean).join(" ");
    const stats_str = stats.nb_victoires > 0
      ? `${stats.nb_courses_terminees} c · ${stats.nb_victoires}V`
      : `${stats.nb_courses_terminees} courses`;
    return `${emoji} ${nomCap}${qualif ? ` — ${qualif}` : ""} : ${stats_str} | Elite Turf`;
  }

  if (type === "jockeys") {
    const stats_str = stats.nb_victoires > 0
      ? `${stats.nb_courses_terminees} c · ${stats.nb_victoires}V · ${(stats.taux_victoire ?? 0).toFixed(0)}%`
      : `${stats.nb_courses_terminees} courses`;
    return `${emoji} ${nomCap} — Jockey PMU : ${stats_str} | Elite Turf`;
  }

  // entraineurs
  const stats_str = stats.nb_victoires > 0
    ? `${stats.nb_courses_terminees} c · ${stats.nb_victoires}V · ${(stats.taux_victoire ?? 0).toFixed(0)}%`
    : `${stats.nb_courses_terminees} courses`;
  return `${emoji} ${nomCap} — Entraîneur PMU : ${stats_str} | Elite Turf`;
}

/**
 * Description SEO dynamique enrichie.
 * Stratégie : préfixe data + musique + contexte (hippodromes/partenaires).
 * Limite cible : ~155 chars.
 */
export function buildActeurDescription(
  type: EntiteType,
  entite: Entite,
  stats: RichStats,
): string {
  const label = ENTITE_LABEL[type].singular;
  const musique = stats.musique_textuelle || "—";
  const topHippo = stats.hippodromes_freq[0]?.[0] || "";

  if (type === "chevaux") {
    const sexe = formatSexeCheval(entite.sexe);
    const age = entite.age ? `${entite.age} ans` : "";
    const id = [sexe, age].filter(Boolean).join(", ");
    const winrate = stats.taux_victoire !== null ? ` · ${stats.taux_victoire.toFixed(0)}% victoire` : "";
    return `📊 ${entite.nom}${id ? ` (${id})` : ""} : ${stats.nb_courses_terminees} courses · ${stats.nb_victoires}V · ${stats.nb_places}P${winrate}. Musique ${musique}${topHippo ? ` · Fréquent à ${topHippo}` : ""}.`.slice(0, 160);
  }

  const winrate = stats.taux_victoire !== null ? ` · ${stats.taux_victoire.toFixed(0)}% victoire` : "";
  return `📊 ${label} ${entite.nom} : ${stats.nb_courses_terminees} courses · ${stats.nb_victoires}V · ${stats.nb_places} top 3${winrate}. Forme ${musique}${topHippo ? ` · ${topHippo}` : ""}.`.slice(0, 160);
}

/**
 * Détermine si une fiche doit être indexée par Google.
 * Anti-thin-content : on indexe seulement si on a un minimum de matière.
 * Critère affiné Phase 1 : ≥3 courses ET au moins 1 course terminée.
 */
export function isIndexable(stats: RichStats): boolean {
  return stats.nb_courses >= 3 && stats.nb_courses_terminees >= 1;
}
