/**
 * lib/sync/seo-etl.ts — rafraîchit les tables chevaux / jockeys / entraineurs
 * (fiches SEO, sitemap, stats lues par l'IA) depuis l'historique `partants`.
 *
 * Lancé chaque nuit par GitHub Actions (.github/workflows/seo-etl.yml →
 * scripts/seo-etl-cli.ts). Plus par le Worker : le cron-worker coupait l'appel
 * à 25 s et l'ETL ne terminait plus (tables figées au 09/10/2026 depuis le
 * 27/06 pour les entraîneurs, le 03/08 pour les jockeys, le 09/09 pour les
 * chevaux). Module Node pur (aucun import Next) pour le bundle esbuild.
 *
 * Depuis le 09/10/2026 :
 *   - une seule lecture de `partants` (au lieu de six) ;
 *   - une course saisie par deux sources ne compte qu'une fois
 *     (lib/seo/apparitions.ts) ;
 *   - agrégation par CLÉ (lib/seo/cles-acteurs.ts) et non plus par nom
 *     exact : « STAN LE GRAND » et « Stan Le Grand » font une seule fiche,
 *     affichée en casse mixte (décision D1 de Steph) ;
 *   - les fiches fusionnées ou orphelines sont supprimées, leurs anciens
 *     slugs redirigés (table acteurs_alias), avec un garde-fou sur le volume.
 */

import { createServiceClient } from "@/lib/supabase/service-client";
import { slugify } from "@/lib/seo/slugs";
import { looksLikeMusique } from "@/lib/geny";
import { resultatPartant } from "@/lib/courses/arrivee";
import { cleActeur, cleCheval, choisirGraphie, nettoyerNomActeur } from "@/lib/seo/cles-acteurs";
import { dedoublonnerApparitions } from "@/lib/seo/apparitions";

export type EntiteType = "chevaux" | "jockeys" | "entraineurs";

const COL_MAP: Record<EntiteType, "nom_cheval" | "jockey" | "entraineur"> = {
  chevaux:     "nom_cheval",
  jockeys:     "jockey",
  entraineurs: "entraineur",
};

/** Au-delà de cette part de fiches supprimées en une nuit, l'ETL refuse d'écrire. */
const SEUIL_SUPPRESSIONS = 0.1;
const PAGE = 1000;
const CHUNK = 500;
const NB_EXEMPLES = 15;

/** Une ligne partants × courses. */
export interface LigneEtl {
  course_id:   string;
  numero:      number;
  date_course: string;
  statut:      string | null;
  arrivee:     number[] | null;
  rangs:       number[] | null;
  /** courses.updated_at */
  maj:         string | null;
  nom_cheval:  string | null;
  jockey:      string | null;
  entraineur:  string | null;
}

/** Ligne voulue dans la table de l'entité. */
export interface EntiteVoulue {
  cle:                string;
  slug:               string;
  nom:                string;
  nb_courses:         number;
  nb_victoires:       number;
  nb_places:          number;
  derniere_course_at: string | null;
}

export interface Existant { slug: string; nom: string }

export interface PlanEcritures {
  /** Slugs des fiches à supprimer (fusionnées dans une autre, ou orphelines). */
  suppressions: string[];
  /** Anciens slugs → clé de la fiche qui les remplace. */
  alias:        Array<{ slug: string; cle: string }>;
  nouvelles:    string[];
  renommees:    Array<{ slug: string; avant: string; apres: string }>;
}

export interface EtlResult {
  entite:           EntiteType;
  fiches:           number;
  existantes:       number;
  nouvelles:        number;
  supprimees:       number;
  renommees:        number;
  alias:            number;
  ecartees_musique: number;
  collisions_slug:  number;
  insert_or_update: number;
  errors:           number;
  exemples: {
    nouvelles:  string[];
    supprimees: string[];
    renommees:  string[];
  };
}

export interface EtlOptions {
  entites?: EntiteType[];
  dryRun?:  boolean;
  /** Lève le garde-fou des suppressions (premier passage après la fusion). */
  forcerSuppressions?: boolean;
}

// ── Pur ──────────────────────────────────────────────────────────────────

/** Une course saisie par deux sources ne compte qu'une fois. */
export function dedoublonnerLignes(lignes: LigneEtl[]): { lignes: LigneEtl[]; ecartees: number } {
  const gardees = dedoublonnerApparitions(lignes, (l) => ({
    course_id:   l.course_id,
    numero:      l.numero,
    date_course: l.date_course,
    cheval_cle:  cleCheval(l.nom_cheval),
    termine:     l.statut === "TERMINE",
    a_arrivee:   Array.isArray(l.arrivee) && l.arrivee.length > 0,
    maj:         l.maj,
  }));
  return { lignes: gardees, ecartees: lignes.length - gardees.length };
}

interface Agregat {
  graphies:   Map<string, number>;
  nb_courses: number;
  victoires:  number;
  places:     number;
  derniere:   string | null;
}

export function agregerEntites(type: EntiteType, lignes: LigneEtl[]): {
  voulues:    EntiteVoulue[];
  graphies:   Map<string, Map<string, number>>;
  ecartees:   number;
  collisions: number;
} {
  const col = COL_MAP[type];
  const parCle = new Map<string, Agregat>();
  const musiques = new Set<string>();

  for (const l of lignes) {
    const nom = l[col]?.trim();
    if (!nom) continue;
    // Le parser Geny pouvait prendre la musique du cheval pour un jockey ou un
    // entraîneur (« 0h3h7h1h ») : jamais de fiche pour ces noms.
    if (type !== "chevaux" && looksLikeMusique(nettoyerNomActeur(type, nom))) {
      musiques.add(nom);
      continue;
    }
    const cle = cleActeur(type, nom);
    if (!cle) continue;

    let a = parCle.get(cle);
    if (!a) {
      a = { graphies: new Map(), nb_courses: 0, victoires: 0, places: 0, derniere: null };
      parCle.set(cle, a);
    }
    a.graphies.set(nom, (a.graphies.get(nom) ?? 0) + 1);
    a.nb_courses += 1;
    if (l.date_course && (!a.derniere || l.date_course > a.derniere)) a.derniere = l.date_course;
    if (l.statut === "TERMINE" && Array.isArray(l.arrivee) && l.arrivee.length > 0) {
      // Rang officiel, ex æquo compris : un co-vainqueur gagne, un 3e ex æquo est placé.
      const res = resultatPartant(l.numero, l.arrivee, l.rangs);
      if (res?.victoire) a.victoires += 1;
      if (res?.place)    a.places    += 1;
    }
  }

  // Deux clés qui donneraient le même slug (rarissime) : la plus courue garde la fiche.
  const parSlug = new Map<string, EntiteVoulue>();
  let collisions = 0;
  const graphies = new Map<string, Map<string, number>>();
  for (const [cle, a] of Array.from(parCle.entries())) {
    const nom = choisirGraphie(type, a.graphies.entries());
    const slug = slugify(nom);
    if (!slug) continue;
    graphies.set(cle, a.graphies);
    const v: EntiteVoulue = {
      cle, slug, nom,
      nb_courses:         a.nb_courses,
      nb_victoires:       a.victoires,
      nb_places:          a.places,
      derniere_course_at: a.derniere,
    };
    const prev = parSlug.get(slug);
    if (prev) {
      collisions += 1;
      if (v.nb_courses <= prev.nb_courses) continue;
    }
    parSlug.set(slug, v);
  }

  return { voulues: Array.from(parSlug.values()), graphies, ecartees: musiques.size, collisions };
}

export function planifierEcritures(
  type: EntiteType,
  existants: Existant[],
  voulues: EntiteVoulue[],
  graphiesParCle: Map<string, Map<string, number>>,
): PlanEcritures {
  const voulueParSlug = new Map(voulues.map((v) => [v.slug, v]));
  const cles = new Set(voulues.map((v) => v.cle));
  const existantParSlug = new Map(existants.map((e) => [e.slug, e]));

  const alias = new Map<string, string>();
  const ajouterAlias = (slug: string, cle: string) => {
    if (slug && !voulueParSlug.has(slug) && !alias.has(slug)) alias.set(slug, cle);
  };

  const suppressions: string[] = [];
  for (const e of existants) {
    if (voulueParSlug.has(e.slug)) continue;
    suppressions.push(e.slug);
    // Fiche fusionnée dans une autre : son ancienne adresse redirige.
    // Orpheline (plus aucun partant) : rien vers quoi rediriger.
    const cle = cleActeur(type, e.nom);
    if (cles.has(cle)) ajouterAlias(e.slug, cle);
  }
  // Chaque graphie brute a pu avoir sa propre fiche (l'ancien ETL slugifiait
  // le nom brut : « c-demuro-57-5 », « m-seror-s ») : toutes redirigent.
  for (const v of voulues) {
    for (const nom of Array.from(graphiesParCle.get(v.cle)?.keys() ?? [])) ajouterAlias(slugify(nom), v.cle);
  }

  const nouvelles: string[] = [];
  const renommees: PlanEcritures["renommees"] = [];
  for (const v of voulues) {
    const e = existantParSlug.get(v.slug);
    if (!e) nouvelles.push(v.slug);
    else if (e.nom !== v.nom) renommees.push({ slug: v.slug, avant: e.nom, apres: v.nom });
  }

  return {
    suppressions,
    alias: Array.from(alias.entries()).map(([slug, cle]) => ({ slug, cle })),
    nouvelles,
    renommees,
  };
}

// ── I/O ──────────────────────────────────────────────────────────────────

type Client = ReturnType<typeof createServiceClient>;

/** Tout l'historique partants × courses, en une seule lecture paginée (ordre stable). */
async function chargerLignes(supabase: Client): Promise<LigneEtl[]> {
  const out: LigneEtl[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("partants")
      .select("id, numero, nom_cheval, jockey, entraineur, course:courses!inner(id, date_course, statut, arrivee_officielle, arrivee_rangs, updated_at)")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`lecture partants: ${error.message}`);
    for (const row of (data ?? []) as any[]) {
      const c = Array.isArray(row.course) ? row.course[0] : row.course;
      if (!c) continue;
      out.push({
        course_id:   c.id,
        numero:      row.numero,
        date_course: c.date_course,
        statut:      c.statut ?? null,
        arrivee:     Array.isArray(c.arrivee_officielle) ? c.arrivee_officielle : null,
        rangs:       Array.isArray(c.arrivee_rangs) ? c.arrivee_rangs : null,
        maj:         c.updated_at ?? null,
        nom_cheval:  row.nom_cheval,
        jockey:      row.jockey,
        entraineur:  row.entraineur,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function chargerExistants(supabase: Client, type: EntiteType): Promise<Existant[]> {
  const out: Existant[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(type)
      .select("slug, nom")
      .order("slug")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`lecture ${type}: ${error.message}`);
    out.push(...((data ?? []) as Existant[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function ecrire(
  supabase: Client,
  type: EntiteType,
  voulues: EntiteVoulue[],
  plan: PlanEcritures,
): Promise<{ inserted: number; errors: number }> {
  // 1. Suppressions d'abord : une clé passée à un autre slug libère l'ancien.
  for (let i = 0; i < plan.suppressions.length; i += 200) {
    const { error } = await supabase.from(type).delete().in("slug", plan.suppressions.slice(i, i + 200));
    if (error) throw new Error(`suppression ${type}: ${error.message}`);
  }

  // 2. Fiches voulues.
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < voulues.length; i += CHUNK) {
    const chunk = voulues.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from(type)
      .upsert(chunk, { onConflict: "slug", count: "exact" });
    if (error) {
      console.error(`[seo-etl] upsert ${type} lot ${i}: ${error.message}`);
      errors += chunk.length;
    } else {
      inserted += count ?? chunk.length;
    }
  }

  // 3. Redirections : nouveaux alias, et retrait de ceux redevenus des fiches.
  const lignesAlias = plan.alias.map((a) => ({ type, slug: a.slug, cle: a.cle }));
  for (let i = 0; i < lignesAlias.length; i += CHUNK) {
    const { error } = await supabase
      .from("acteurs_alias")
      .upsert(lignesAlias.slice(i, i + CHUNK), { onConflict: "type,slug" });
    if (error) throw new Error(`alias ${type}: ${error.message}`);
  }
  const slugsVoulus = new Set(voulues.map((v) => v.slug));
  const { data: anciens, error: errAlias } = await supabase.from("acteurs_alias").select("slug").eq("type", type);
  if (errAlias) throw new Error(`lecture alias ${type}: ${errAlias.message}`);
  const redevenus = ((anciens ?? []) as Array<{ slug: string }>).map((a) => a.slug).filter((s) => slugsVoulus.has(s));
  for (let i = 0; i < redevenus.length; i += 200) {
    const { error } = await supabase.from("acteurs_alias").delete().eq("type", type).in("slug", redevenus.slice(i, i + 200));
    if (error) throw new Error(`nettoyage alias ${type}: ${error.message}`);
  }

  return { inserted, errors };
}

/** Lance l'ETL pour un ou plusieurs types d'entités. */
export async function runSeoEtl(opts: EtlOptions = {}): Promise<{
  ok: true;
  dry_run: boolean;
  lignes_lues: number;
  doublons_ecartes: number;
  results: EtlResult[];
  elapsed_ms: number;
}> {
  const entites = opts.entites && opts.entites.length > 0
    ? opts.entites
    : (["chevaux", "jockeys", "entraineurs"] as EntiteType[]);
  const dryRun = opts.dryRun ?? false;

  const supabase = createServiceClient();
  const start = Date.now();
  const brutes = await chargerLignes(supabase);
  const { lignes, ecartees: doublons } = dedoublonnerLignes(brutes);

  const results: EtlResult[] = [];
  for (const type of entites) {
    const { voulues, graphies, ecartees, collisions } = agregerEntites(type, lignes);
    const existants = await chargerExistants(supabase, type);
    const plan = planifierEcritures(type, existants, voulues, graphies);

    const seuil = Math.max(50, Math.floor(existants.length * SEUIL_SUPPRESSIONS));
    if (!dryRun && plan.suppressions.length > seuil && !opts.forcerSuppressions) {
      throw new Error(
        `${type} : ${plan.suppressions.length} fiches à supprimer (seuil ${seuil}). ` +
        "Vérifier un essai à blanc, puis relancer avec forcer_suppressions.",
      );
    }

    const { inserted, errors } = dryRun ? { inserted: 0, errors: 0 } : await ecrire(supabase, type, voulues, plan);
    results.push({
      entite:           type,
      fiches:           voulues.length,
      existantes:       existants.length,
      nouvelles:        plan.nouvelles.length,
      supprimees:       plan.suppressions.length,
      renommees:        plan.renommees.length,
      alias:            plan.alias.length,
      ecartees_musique: ecartees,
      collisions_slug:  collisions,
      insert_or_update: inserted,
      errors,
      exemples: {
        nouvelles:  plan.nouvelles.slice(0, NB_EXEMPLES),
        supprimees: plan.suppressions.slice(0, NB_EXEMPLES),
        renommees:  plan.renommees.slice(0, NB_EXEMPLES).map((r) => `${r.avant} → ${r.apres}`),
      },
    });
  }

  return {
    ok: true,
    dry_run: dryRun,
    lignes_lues: brutes.length,
    doublons_ecartes: doublons,
    results,
    elapsed_ms: Date.now() - start,
  };
}
