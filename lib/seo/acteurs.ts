/**
 * Helpers shared par /chevaux/[slug], /jockeys/[slug], /entraineurs/[slug].
 *
 * Stratégie de query :
 *   - Charger l'entité depuis sa table de référence (1 row par slug) ; un
 *     ancien slug de fiche fusionnée redirige (308) vers la fiche actuelle.
 *   - JOIN partants WHERE cheval_cle/jockey_cle/entraineur_cle = entité.cle
 *     (toutes graphies des sources confondues, cf. lib/seo/cles-acteurs.ts),
 *     une course saisie par deux sources n'apparaissant qu'une fois.
 *   - Calculer dernières courses + stats avancées (taux victoire, ROI, etc.)
 *
 * Phase 1 (mai 2026) — refonte fiches acteurs premium :
 *   - computeRichStats() : calculs avancés à la volée depuis l'historique
 *     (fixe le bug "0 victoires partout" en attendant le job sync nightly)
 *   - Interface Entite : champs Phase 2 optionnels (pedigree, propriétaire,
 *     gains, robe, etc.) → quand les colonnes seront peuplées, le UI suit.
 */

import { permanentRedirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/seo/slugs";
import { resultatPartant } from "@/lib/courses/arrivee";
import { cleActeur, cleCheval, choisirGraphie } from "@/lib/seo/cles-acteurs";
import { dedoublonnerApparitions } from "@/lib/seo/apparitions";

export type EntiteType = "chevaux" | "jockeys" | "entraineurs";

export const COL_MAP: Record<EntiteType, "nom_cheval" | "jockey" | "entraineur"> = {
  chevaux:     "nom_cheval",
  jockeys:     "jockey",
  entraineurs: "entraineur",
};

/** Clés de `partants`, tenues par un déclencheur (migration 20261009_cles_acteurs). */
export const CLE_COL: Record<EntiteType, "cheval_cle" | "jockey_cle" | "entraineur_cle"> = {
  chevaux:     "cheval_cle",
  jockeys:     "jockey_cle",
  entraineurs: "entraineur_cle",
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
  /** Clé d'identité (lib/seo/cles-acteurs.ts), remplie par l'ETL ; null avant son passage. */
  cle?:      string | null;
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
  arrivee:          number | null; // rang officiel en arrivée (1, 2, 3, …, ex æquo compris) ou null
  /** Rang partagé avec un autre cheval (dead heat) : « 5e ex æquo ». */
  ex_aequo:         boolean;
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
    ? "id, nom, slug, cle, nb_courses, nb_victoires, nb_places, derniere_course_at, age, sexe"
    : "id, nom, slug, cle, nb_courses, nb_victoires, nb_places, derniere_course_at";
  const { data } = await supabase
    .from(type)
    .select(cols)
    .eq("slug", slug)
    .single();
  return (data as unknown as Entite) ?? null;
}

/**
 * Slug actuel de la fiche qui a remplacé `slug` (fiche fusionnée par l'ETL :
 * « c-demuro-56-5 » → « c-demuro »), ou null.
 */
export async function getSlugCanonique(type: EntiteType, slug: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data: alias } = await supabase
    .from("acteurs_alias")
    .select("cle")
    .eq("type", type)
    .eq("slug", slug)
    .maybeSingle();
  if (!alias?.cle) return null;
  const { data } = await supabase.from(type).select("slug").eq("cle", alias.cle).maybeSingle();
  return (data?.slug as string | undefined) ?? null;
}

/**
 * Entité de la page /<type>/<slug>. Un ancien slug de fiche fusionnée
 * redirige de façon permanente (308) vers la fiche actuelle ; null = 404.
 */
export async function getEntiteOuRediriger(type: EntiteType, slug: string): Promise<Entite | null> {
  const e = await getEntiteBySlug(type, slug);
  if (e) return e;
  const canon = await getSlugCanonique(type, slug);
  if (canon && canon !== slug) permanentRedirect(`/${type}/${canon}`);
  return null;
}

/**
 * Charge l'historique des courses (dernières N) pour une entité.
 * Pourquoi on stocke en référentiel + on requête partants : pas de FK
 * (les syncs insèrent en bulk avec juste le nom). On cherche par CLÉ
 * (colonnes indexées partants.*_cle, tenues par un déclencheur) : toutes les graphies des
 * sources, et l'historique complet avant tri — le plus gros jockey compte
 * ~1 100 lignes (l'ancien plafond de 500 lignes non triées faussait la
 * sélection des « dernières » courses).
 */
export async function getCoursesForEntite(
  type: EntiteType,
  entite: Pick<Entite, "nom" | "cle">,
  limit = 50,
): Promise<CourseLine[]> {
  const cle = entite.cle || cleActeur(type, entite.nom);
  if (!cle) return [];
  const supabase = createServiceClient();

  const PAGE = 1000;
  const data: any[] = [];
  for (let from = 0; from < 10 * PAGE; from += PAGE) {
    const { data: page } = await supabase
      .from("partants")
      .select(`
        numero, cote, jockey, entraineur, nom_cheval,
        course:courses!inner(
          id, date_course, statut, numero_reunion, numero_course, libelle, arrivee_officielle, arrivee_rangs, updated_at,
          hippodrome:hippodromes(nom)
        )
      `)
      .eq(CLE_COL[type], cle)
      .order("id")
      .range(from, from + PAGE - 1);
    data.push(...(page ?? []));
    if (!page || page.length < PAGE) break;
  }

  // Une course saisie par deux sources (« Casablanca » / « Anfa ») : une seule ligne.
  const uniques = dedoublonnerApparitions(data, (row: any) => ({
    course_id:   row.course?.id,
    numero:      row.numero,
    date_course: row.course?.date_course,
    cheval_cle:  cleCheval(row.nom_cheval),
    termine:     row.course?.statut === "TERMINE",
    a_arrivee:   Array.isArray(row.course?.arrivee_officielle) && row.course.arrivee_officielle.length > 0,
    maj:         row.course?.updated_at ?? null,
  }));

  const lines = uniques.map((row: any) => {
    const c = row.course;
    const hippo = Array.isArray(c?.hippodrome) ? c.hippodrome[0] : c?.hippodrome;
    // Rang officiel (ex æquo compris) : le 16, 5e ex æquo, n'est plus « 6e ».
    const res = resultatPartant(row.numero, c?.arrivee_officielle, c?.arrivee_rangs);
    const arrivee: number | null = res ? res.rang : null;
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
      ex_aequo:         res ? res.exAequo : false,
      statut:           c.statut,
    } as CourseLine;
  });
  // Tri en mémoire par date_course desc, puis tronquage à `limit`
  lines.sort((a, b) => b.date_course.localeCompare(a.date_course));
  return lines.slice(0, limit);
}

/**
 * Maillage interne : pour un set de courses (HistoriqueCourses),
 * collecte les noms des chevaux/jockeys/entraîneurs/hippodromes mentionnés
 * et vérifie quels slugs existent réellement dans les tables référentielles.
 *
 * Permet de générer des `<Link>` vers /chevaux/<slug>, /jockeys/<slug>, etc.
 * SEULEMENT pour les acteurs réellement présents en BDD → évite les 404 et
 * boost le PageRank distribué entre fiches voisines.
 *
 * Stratégie : 4 queries `in()` parallèles, batchées par Promise.all. Sur 50
 * rows d'historique avec ~50 noms uniques de chaque type, ~50ms total.
 * Acteurs cherchés par CLÉ : « M.BARZALONA » mène à la fiche « m-barzalona »,
 * « Pc.Boudot » à « p-c-boudot ».
 */
export interface KnownSlugs {
  /** clé d'identité → slug de la fiche */
  chevaux:     Map<string, string>;
  jockeys:     Map<string, string>;
  entraineurs: Map<string, string>;
  hippodromes: Set<string>;
}

/** Slug de la fiche existante de l'acteur `nom` (toute graphie), sinon null. */
export function slugActeurConnu(
  known: KnownSlugs | undefined,
  type: EntiteType,
  nom: string | null | undefined,
): string | null {
  if (!known || !nom) return null;
  return known[type].get(cleActeur(type, nom)) ?? null;
}

/** clé → slug des fiches existantes parmi `cles` (requêtes `in` par lots). */
export async function slugsParCle(
  supabase: ReturnType<typeof createServiceClient>,
  type: EntiteType,
  cles: Iterable<string>,
): Promise<Map<string, string>> {
  const liste = Array.from(new Set(Array.from(cles).filter(Boolean)));
  const out = new Map<string, string>();
  for (let i = 0; i < liste.length; i += 150) {
    const { data } = await supabase.from(type).select("cle, slug").in("cle", liste.slice(i, i + 150));
    for (const r of (data ?? []) as Array<{ cle: string | null; slug: string }>) {
      if (r.cle && r.slug) out.set(r.cle, r.slug);
    }
  }
  return out;
}

export async function getKnownSlugsForRows(rows: CourseLine[]): Promise<KnownSlugs> {
  const supabase = createServiceClient();

  const hippodromesNames = new Set<string>();
  for (const r of rows) if (r.hippodrome_nom) hippodromesNames.add(r.hippodrome_nom);

  const [chevaux, jockeys, entraineurs, hipp] = await Promise.all([
    slugsParCle(supabase, "chevaux",     rows.map((r) => cleActeur("chevaux", r.nom_cheval))),
    slugsParCle(supabase, "jockeys",     rows.map((r) => cleActeur("jockeys", r.jockey))),
    slugsParCle(supabase, "entraineurs", rows.map((r) => cleActeur("entraineurs", r.entraineur))),
    hippodromesNames.size > 0
      ? supabase.from("hippodromes").select("nom").in("nom", Array.from(hippodromesNames))
      : Promise.resolve({ data: [] as Array<{ nom: string }> }),
  ]);

  return {
    chevaux,
    jockeys,
    entraineurs,
    // Hippodromes : pas de colonne `slug` en BDD, on slugifie le nom
    hippodromes: new Set((hipp.data ?? []).map((r: any) => slugify(r.nom)).filter(Boolean)),
  };
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
  // Regroupés par clé : « M. Barzalona » et « M.BARZALONA » font un seul partenaire.
  const typePartenaire: EntiteType = type === "chevaux" ? "jockeys" : "chevaux";
  const partMap = new Map<string, { n: number; graphies: Map<string, number> }>();
  for (const r of rows) {
    const nom = type === "chevaux" ? r.jockey : r.nom_cheval;
    const cle = cleActeur(typePartenaire, nom);
    if (!nom || !cle) continue;
    const p = partMap.get(cle) ?? { n: 0, graphies: new Map<string, number>() };
    p.n += 1;
    p.graphies.set(nom, (p.graphies.get(nom) ?? 0) + 1);
    partMap.set(cle, p);
  }
  const partenaires_freq = Array.from(partMap.values())
    .map((p): [string, number] => [choisirGraphie(typePartenaire, p.graphies.entries()), p.n])
    .filter(([nom]) => nom !== "")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

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
 * Stratégie CTR (révisée 21/05/2026 — Sprint A) :
 *   - Emoji visuel SERP (signal coloré dans résultats Google)
 *   - Qualificatif PMU (Cheval/Jockey/Entraîneur) → match intent recherche
 *   - Chiffres concrets ET cas "0 victoires" enrichi avec mot "Analyse"
 *   - PAS de marque en fin : le template du root layout ("%s | Elite Turf")
 *     l'ajoute déjà au <title>. Les appelants la rajoutent eux-mêmes au
 *     titre OpenGraph, qui ne reçoit pas le template.
 * Limite cible : 50-65 chars (Google tronque ~580px ≈ 65 chars desktop).
 *
 * Audit GSC 18/05/2026 : CTR site 3,1% à pos 10,2. Objectif : +1pt CTR via
 * titles plus "cliquables" (chiffres > génériques, "Analyse" > juste nom).
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
    // Cas "actif" : on a au moins 1 victoire → afficher les stats marquantes
    if (stats.nb_victoires > 0) {
      const winrate = stats.taux_victoire !== null && stats.nb_courses_terminees >= 3
        ? ` · ${stats.taux_victoire.toFixed(0)}%`
        : "";
      return `${emoji} ${nomCap}${qualif ? ` — ${qualif}` : ""} : ${stats.nb_courses_terminees}c · ${stats.nb_victoires}V${winrate}`;
    }
    // Cas "thin" : pas encore de victoire → mot "Analyse" + qualif (CTR boost)
    return `${emoji} ${nomCap}${qualif ? ` — ${qualif}` : ""} — Analyse PMU & musique`;
  }

  if (type === "jockeys") {
    if (stats.nb_victoires > 0) {
      const winrate = stats.taux_victoire !== null
        ? ` · ${stats.taux_victoire.toFixed(0)}%`
        : "";
      return `${emoji} ${nomCap} — Jockey PMU : ${stats.nb_courses_terminees}c · ${stats.nb_victoires}V${winrate}`;
    }
    return `${emoji} ${nomCap} — Jockey PMU : analyse, montes & forme récente`;
  }

  // entraineurs
  if (stats.nb_victoires > 0) {
    const winrate = stats.taux_victoire !== null
      ? ` · ${stats.taux_victoire.toFixed(0)}%`
      : "";
    return `${emoji} ${nomCap} — Entraîneur PMU : ${stats.nb_courses_terminees}c · ${stats.nb_victoires}V${winrate}`;
  }
  return `${emoji} ${nomCap} — Entraîneur PMU : analyse, chevaux & forme`;
}

/**
 * Description SEO dynamique enrichie (Sprint A 21/05/2026).
 * Stratégie CTR :
 *   - Emoji 📊 en début pour signal visuel SERP
 *   - Chiffres compacts (Xc · YV · ZP · W%) = signaux de matière
 *   - Musique = mot-clé high-intent pour parieurs PMU
 *   - "Stats détaillées" / "Découvrez" = CTA implicite
 *   - Top hippodrome = local SEO bonus (recherches géo)
 * Limite cible : 145-160 chars (Google coupe à ~155 chars desktop).
 */
export function buildActeurDescription(
  type: EntiteType,
  entite: Entite,
  stats: RichStats,
): string {
  const label = ENTITE_LABEL[type].singular;
  const musique = stats.musique_textuelle || null;
  const topHippo = stats.hippodromes_freq[0]?.[0] || "";

  if (type === "chevaux") {
    const sexe = formatSexeCheval(entite.sexe);
    const age = entite.age ? `${entite.age} ans` : "";
    const id = [sexe, age].filter(Boolean).join(", ");
    // Cas avec courses terminées : on push les chiffres en avant
    if (stats.nb_courses_terminees > 0) {
      const winrate = stats.taux_victoire !== null && stats.nb_courses_terminees >= 3
        ? ` · ${stats.taux_victoire.toFixed(0)}% victoire`
        : "";
      const musiquePart = musique ? ` Musique ${musique}.` : "";
      const hippoPart = topHippo ? ` Fréquent à ${topHippo}.` : "";
      return `📊 ${entite.nom}${id ? ` (${id})` : ""} : ${stats.nb_courses_terminees}c · ${stats.nb_victoires}V · ${stats.nb_places} top 3${winrate}.${musiquePart}${hippoPart} Stats détaillées Elite Turf.`.slice(0, 160);
    }
    // Cas "thin" : pas encore de course terminée → focus sur "À venir" + brand
    return `📊 ${entite.nom}${id ? ` (${id})` : ""} — Cheval PMU à suivre. Découvrez son historique, ses jockeys habituels et ses prochaines courses sur Elite Turf.`.slice(0, 160);
  }

  // jockeys + entraineurs
  if (stats.nb_courses_terminees > 0) {
    const winrate = stats.taux_victoire !== null
      ? ` · ${stats.taux_victoire.toFixed(0)}% victoire`
      : "";
    const musiquePart = musique ? ` Forme ${musique}.` : "";
    const hippoPart = topHippo ? ` Hippodrome favori : ${topHippo}.` : "";
    return `📊 ${label} ${entite.nom} : ${stats.nb_courses_terminees}c · ${stats.nb_victoires}V · ${stats.nb_places} top 3${winrate}.${musiquePart}${hippoPart}`.slice(0, 160);
  }
  return `📊 ${label} ${entite.nom} — Profil PMU complet. Découvrez ses montes, sa forme récente et les chevaux qu'il fréquente sur Elite Turf.`.slice(0, 160);
}

/**
 * Détermine si une fiche doit être indexée par Google.
 * Anti-thin-content : on indexe seulement si on a un minimum de matière.
 *
 * Critère affiné Phase 1 (révisé 14/05/2026 après QA noindex sur Gitano Jack
 * & Victory Pace qui avaient 2 courses TOUTES terminées) :
 *   - Soit ≥ 2 courses terminées (matière historique réelle même si 2 entrées)
 *   - Soit ≥ 3 courses au total dont ≥ 1 terminée (large historique en cours)
 *   - Soit ≥ 1 victoire (cheval gagnant = contenu pertinent même si peu vu)
 *
 * Idée directrice : c'est la quantité de **résultats** affichables (musique,
 * positions, hippodromes) qui détermine la richesse, pas le nombre brut
 * d'apparitions dans partants. 2 courses terminées = 2 positions + 2 jockeys
 * + 2 hippodromes + 1 graphique → contenu suffisant pour Google.
 */
export function isIndexable(stats: RichStats): boolean {
  return stats.nb_courses_terminees >= 2
      || (stats.nb_courses >= 3 && stats.nb_courses_terminees >= 1)
      || stats.nb_victoires >= 1;
}
