/**
 * Queries pour articles blog auto-générés.
 *
 * Toutes les requêtes sont SSR / ISR-friendly (pas d'auth user-context).
 * Coût estimé par article : 2-4 queries Supabase, cap 1000 rows chacune.
 * Avec ISR 24h sur articles passés, l'impact DB est négligeable.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { resultatPartant } from "@/lib/courses/arrivee";
import { slugsParCle, type EntiteType } from "@/lib/seo/acteurs";
import { cleActeur, cleCheval, choisirGraphie } from "@/lib/seo/cles-acteurs";
import { dedoublonnerApparitions } from "@/lib/seo/apparitions";

/**
 * Regroupe des apparitions par acteur — par CLÉ, toutes graphies des sources
 * confondues (« M.BARZALONA » = « M. Barzalona ») — avec la graphie affichée
 * de la fiche. Les acteurs sans fiche sont écartés (pas de lien mort).
 */
async function agregerParActeur(
  supabase: ReturnType<typeof createServiceClient>,
  type: EntiteType,
  lignes: Array<{ nom: string | null | undefined; gagne: boolean }>,
): Promise<Array<{ nom: string; slug: string; courses: number; victoires: number }>> {
  const parCle = new Map<string, { graphies: Map<string, number>; courses: number; victoires: number }>();
  for (const l of lignes) {
    const nom = l.nom?.trim();
    const cle = cleActeur(type, nom);
    if (!nom || !cle) continue;
    const a = parCle.get(cle) ?? { graphies: new Map<string, number>(), courses: 0, victoires: 0 };
    a.graphies.set(nom, (a.graphies.get(nom) ?? 0) + 1);
    a.courses += 1;
    if (l.gagne) a.victoires += 1;
    parCle.set(cle, a);
  }
  const slugs = await slugsParCle(supabase, type, parCle.keys());
  const out: Array<{ nom: string; slug: string; courses: number; victoires: number }> = [];
  for (const [cle, a] of Array.from(parCle.entries())) {
    const slug = slugs.get(cle);
    if (slug) out.push({ nom: choisirGraphie(type, a.graphies.entries()), slug, courses: a.courses, victoires: a.victoires });
  }
  return out;
}

/** Une course saisie par deux sources ne compte qu'une fois (lib/seo/apparitions.ts). */
function uniquesParCourse(rows: any[]): any[] {
  return dedoublonnerApparitions(rows, (r: any) => ({
    course_id:   r.course?.id,
    numero:      r.numero,
    date_course: r.course?.date_course,
    cheval_cle:  cleCheval(r.nom_cheval),
    termine:     r.course?.statut === "TERMINE",
    a_arrivee:   Array.isArray(r.course?.arrivee_officielle) && r.course.arrivee_officielle.length > 0,
    maj:         r.course?.updated_at ?? null,
  }));
}

export interface TopJockey {
  nom:           string;
  slug:          string;
  victoires:     number;
  courses:       number;
  taux:          number;
}

export interface TopCheval {
  nom:       string;
  slug:      string;
  victoires: number;
  courses:   number;
}

export interface CourseHighlight {
  course_id:      string;
  date_course:    string;
  libelle:        string;
  hippodrome_nom: string | null;
  numero_reunion: number;
  numero_course:  number;
  arrivee:        number[] | null;
  /** Rangs officiels (ex æquo), NULL = ordre strict — cf. lib/courses/rangs. */
  rangs:          number[] | null;
  type:           "QUINTE_PLUS" | "AUTRE";
}

export interface PeriodStats {
  nb_courses_termine:    number;
  nb_partants:           number;
  nb_quintes_termine:    number;
  hippodromes_actifs:    Array<{ nom: string; nb: number }>;
}

/**
 * Récupère les stats de période pour un range donné (semaine ou mois).
 */
export async function getPeriodStats(
  fromDate: string,
  toDate:   string,
): Promise<PeriodStats> {
  const supabase = createServiceClient();

  // 1. Courses terminées de la période
  const { data: courses } = await supabase
    .from("courses")
    .select("id, paris_disponibles, hippodrome:hippodromes(nom)")
    .gte("date_course", fromDate)
    .lte("date_course", toDate)
    .eq("statut", "TERMINE")
    .limit(1000);

  const list = (courses ?? []) as any[];
  const nb_quintes_termine = list.filter(
    (c) => Array.isArray(c.paris_disponibles) && c.paris_disponibles.includes("QUINTE_PLUS"),
  ).length;

  // 2. Stats hippodromes (compter les courses par hippo)
  const hippoCounts = new Map<string, number>();
  for (const c of list) {
    const nom = (Array.isArray(c.hippodrome) ? c.hippodrome[0]?.nom : c.hippodrome?.nom) ?? null;
    if (!nom) continue;
    hippoCounts.set(nom, (hippoCounts.get(nom) ?? 0) + 1);
  }
  const hippodromes_actifs = Array.from(hippoCounts.entries())
    .map(([nom, nb]) => ({ nom, nb }))
    .sort((a, b) => b.nb - a.nb)
    .slice(0, 10);

  // 3. Nb partants total (1 query)
  const courseIds = list.map((c) => c.id);
  let nb_partants = 0;
  if (courseIds.length > 0) {
    const { count } = await supabase
      .from("partants")
      .select("id", { count: "exact", head: true })
      .in("course_id", courseIds);
    nb_partants = count ?? 0;
  }

  return {
    nb_courses_termine: list.length,
    nb_partants,
    nb_quintes_termine,
    hippodromes_actifs,
  };
}

/**
 * Top jockeys de la période (cumulé sur les courses TERMINE du range).
 * Joint partants × courses, agrège côté JS car PostgREST ne supporte pas
 * les window functions.
 */
export async function getTopJockeysForPeriod(
  fromDate: string,
  toDate:   string,
  limit = 10,
): Promise<TopJockey[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("partants")
    .select(`
      jockey, nom_cheval, numero,
      course:courses!inner(id, date_course, statut, arrivee_officielle, arrivee_rangs, updated_at)
    `)
    .not("jockey", "is", null)
    .gte("course.date_course", fromDate)
    .lte("course.date_course", toDate)
    .eq("course.statut", "TERMINE")
    .limit(2000);

  const jockeys = await agregerParActeur(supabase, "jockeys", uniquesParCourse(data ?? []).map((row: any) => ({
    nom:   row.jockey,
    // Rang officiel : en dead heat, les deux vainqueurs gagnent.
    gagne: resultatPartant(row.numero, row.course?.arrivee_officielle, row.course?.arrivee_rangs)?.victoire === true,
  })));

  return jockeys
    .map((j) => ({ ...j, taux: j.courses > 0 ? (j.victoires / j.courses) * 100 : 0 }))
    .sort((a, b) => b.victoires - a.victoires || b.courses - a.courses)
    .slice(0, limit);
}

/** Top chevaux de la période — même logique. */
export async function getTopChevauxForPeriod(
  fromDate: string,
  toDate:   string,
  limit = 10,
): Promise<TopCheval[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("partants")
    .select(`
      nom_cheval, numero,
      course:courses!inner(id, date_course, statut, arrivee_officielle, arrivee_rangs, updated_at)
    `)
    .not("nom_cheval", "is", null)
    .gte("course.date_course", fromDate)
    .lte("course.date_course", toDate)
    .eq("course.statut", "TERMINE")
    .limit(2000);

  const chevaux = await agregerParActeur(supabase, "chevaux", uniquesParCourse(data ?? []).map((row: any) => ({
    nom:   row.nom_cheval,
    // Rang officiel : en dead heat, les deux vainqueurs gagnent.
    gagne: resultatPartant(row.numero, row.course?.arrivee_officielle, row.course?.arrivee_rangs)?.victoire === true,
  })));

  return chevaux
    .filter((c) => c.victoires > 0)
    .sort((a, b) => b.victoires - a.victoires)
    .slice(0, limit);
}

/** Quinté+ marquants de la période (avec arrivée). */
export async function getQuintesForPeriod(
  fromDate: string,
  toDate:   string,
  limit = 10,
): Promise<CourseHighlight[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("courses")
    .select(`
      id, date_course, libelle, numero_reunion, numero_course,
      paris_disponibles, arrivee_officielle, arrivee_rangs,
      hippodrome:hippodromes(nom)
    `)
    .gte("date_course", fromDate)
    .lte("date_course", toDate)
    .eq("statut", "TERMINE")
    .contains("paris_disponibles", ["QUINTE_PLUS"])
    .order("date_course", { ascending: false })
    .limit(limit);

  return ((data ?? []) as any[]).map((c) => ({
    course_id:      c.id,
    date_course:    c.date_course,
    libelle:        c.libelle,
    hippodrome_nom: Array.isArray(c.hippodrome) ? c.hippodrome[0]?.nom : c.hippodrome?.nom,
    numero_reunion: c.numero_reunion,
    numero_course:  c.numero_course,
    arrivee:        Array.isArray(c.arrivee_officielle) ? c.arrivee_officielle : null,
    rangs:          Array.isArray(c.arrivee_rangs) ? c.arrivee_rangs : null,
    type:           "QUINTE_PLUS",
  }));
}

// ── Pour /blog/decouvrir-hippodrome/[slug] ──────────────────────────────────

export interface HippodromeStats {
  nom:                 string;
  pays:                string;
  ville:               string;
  nb_courses_30j:      number;
  nb_courses_total:    number;
  top_jockeys:         Array<{ nom: string; slug: string; victoires: number; courses: number }>;
  top_chevaux:         Array<{ nom: string; slug: string; victoires: number; courses: number }>;
  derniere_date:       string | null;
}

export async function getHippodromeStats(slug: string): Promise<HippodromeStats | null> {
  const supabase = createServiceClient();
  // Trouver l'hippo par slug calculé côté JS
  const { data: hippos } = await supabase
    .from("hippodromes")
    .select("id, nom, pays, ville, actif")
    .eq("actif", true);

  const { slugify } = await import("@/lib/seo/slugs");
  const hippo = (hippos ?? []).find((h: any) => slugify(h.nom) === slug);
  if (!hippo) return null;

  const today = new Date();
  const minus30 = new Date(today.getTime() - 30 * 24 * 3600 * 1000)
    .toISOString().split("T")[0];

  const { data: rawCourses30j } = await supabase
    .from("courses")
    .select("id")
    .eq("hippodrome_id", hippo.id)
    .gte("date_course", minus30)
    .neq("statut", "ANNULE");

  const { data: rawCoursesTotal } = await supabase
    .from("courses")
    .select("id, date_course, statut, arrivee_officielle, arrivee_rangs")
    .eq("hippodrome_id", hippo.id)
    .neq("statut", "ANNULE")
    .order("date_course", { ascending: false })
    .limit(500);

  const total       = (rawCoursesTotal ?? []).length;
  const totalIds    = (rawCoursesTotal ?? []).map((c: any) => c.id);
  const lastDate    = (rawCoursesTotal ?? [])[0]?.date_course ?? null;

  // Top jockeys/chevaux (joint via partants)
  let topJockeys: HippodromeStats["top_jockeys"] = [];
  let topChevaux: HippodromeStats["top_chevaux"] = [];
  if (totalIds.length > 0) {
    const { data: partants } = await supabase
      .from("partants")
      .select("jockey, nom_cheval, numero, course_id")
      .in("course_id", totalIds.slice(0, 200))
      .limit(2000);

    // Récupérer arrivees pour les courses ciblées
    const arriveeMap = new Map<string, { arrivee: number[]; rangs: number[] | null }>();
    for (const c of (rawCoursesTotal ?? []) as any[]) {
      if (Array.isArray(c.arrivee_officielle)) arriveeMap.set(c.id, { arrivee: c.arrivee_officielle, rangs: c.arrivee_rangs ?? null });
    }

    const lignes = ((partants ?? []) as any[]).map((p) => {
      const a = arriveeMap.get(p.course_id);
      // Rang officiel : en dead heat, les deux vainqueurs gagnent.
      return { jockey: p.jockey, nom_cheval: p.nom_cheval, gagne: !!a && resultatPartant(p.numero, a.arrivee, a.rangs)?.victoire === true };
    });
    const [jockeys, chevaux] = await Promise.all([
      agregerParActeur(supabase, "jockeys", lignes.map((l) => ({ nom: l.jockey, gagne: l.gagne }))),
      agregerParActeur(supabase, "chevaux", lignes.map((l) => ({ nom: l.nom_cheval, gagne: l.gagne }))),
    ]);
    topJockeys = jockeys.sort((a, b) => b.courses - a.courses).slice(0, 6);
    topChevaux = chevaux.sort((a, b) => b.courses - a.courses).slice(0, 6);
  }

  return {
    nom:              hippo.nom,
    pays:             hippo.pays,
    ville:            hippo.ville,
    nb_courses_30j:   (rawCourses30j ?? []).length,
    nb_courses_total: total,
    top_jockeys:      topJockeys,
    top_chevaux:      topChevaux,
    derniere_date:    lastDate,
  };
}
