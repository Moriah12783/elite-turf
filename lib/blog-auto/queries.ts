/**
 * Queries pour articles blog auto-générés.
 *
 * Toutes les requêtes sont SSR / ISR-friendly (pas d'auth user-context).
 * Coût estimé par article : 2-4 queries Supabase, cap 1000 rows chacune.
 * Avec ISR 24h sur articles passés, l'impact DB est négligeable.
 */

import { createServiceClient } from "@/lib/supabase/server";

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
      jockey, numero,
      course:courses!inner(date_course, statut, arrivee_officielle)
    `)
    .not("jockey", "is", null)
    .gte("course.date_course", fromDate)
    .lte("course.date_course", toDate)
    .eq("course.statut", "TERMINE")
    .limit(2000);

  // Agréger
  const stats = new Map<string, { courses: number; victoires: number }>();
  for (const row of (data ?? []) as any[]) {
    const nom = (row.jockey as string).trim();
    if (!nom) continue;
    const arr = row.course?.arrivee_officielle;
    const won = Array.isArray(arr) && arr.length > 0 && arr[0] === row.numero;
    const cur = stats.get(nom) ?? { courses: 0, victoires: 0 };
    cur.courses += 1;
    if (won) cur.victoires += 1;
    stats.set(nom, cur);
  }

  // Slugify on-the-fly via la table jockeys (1 lookup)
  const noms = Array.from(stats.keys());
  const slugMap = new Map<string, string>();
  if (noms.length > 0) {
    const { data: jockeys } = await supabase
      .from("jockeys")
      .select("nom, slug")
      .in("nom", noms);
    for (const j of (jockeys ?? [])) slugMap.set(j.nom, j.slug);
  }

  return Array.from(stats.entries())
    .map(([nom, s]) => ({
      nom,
      slug:      slugMap.get(nom) ?? "",
      victoires: s.victoires,
      courses:   s.courses,
      taux:      s.courses > 0 ? (s.victoires / s.courses) * 100 : 0,
    }))
    .filter((j) => j.slug !== "")
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
      course:courses!inner(date_course, statut, arrivee_officielle)
    `)
    .not("nom_cheval", "is", null)
    .gte("course.date_course", fromDate)
    .lte("course.date_course", toDate)
    .eq("course.statut", "TERMINE")
    .limit(2000);

  const stats = new Map<string, { courses: number; victoires: number }>();
  for (const row of (data ?? []) as any[]) {
    const nom = (row.nom_cheval as string).trim();
    if (!nom) continue;
    const arr = row.course?.arrivee_officielle;
    const won = Array.isArray(arr) && arr.length > 0 && arr[0] === row.numero;
    const cur = stats.get(nom) ?? { courses: 0, victoires: 0 };
    cur.courses += 1;
    if (won) cur.victoires += 1;
    stats.set(nom, cur);
  }

  const noms = Array.from(stats.keys());
  const slugMap = new Map<string, string>();
  if (noms.length > 0) {
    const { data: chevaux } = await supabase
      .from("chevaux")
      .select("nom, slug")
      .in("nom", noms);
    for (const c of (chevaux ?? [])) slugMap.set(c.nom, c.slug);
  }

  return Array.from(stats.entries())
    .map(([nom, s]) => ({
      nom,
      slug:      slugMap.get(nom) ?? "",
      victoires: s.victoires,
      courses:   s.courses,
    }))
    .filter((c) => c.slug !== "" && c.victoires > 0)
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
      paris_disponibles, arrivee_officielle,
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
    .select("id, date_course, statut, arrivee_officielle")
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
    const arriveeMap = new Map<string, number[]>();
    for (const c of (rawCoursesTotal ?? []) as any[]) {
      if (Array.isArray(c.arrivee_officielle)) arriveeMap.set(c.id, c.arrivee_officielle);
    }

    const jockeyStats = new Map<string, { courses: number; victoires: number }>();
    const chevalStats = new Map<string, { courses: number; victoires: number }>();
    for (const p of (partants ?? []) as any[]) {
      const arr = arriveeMap.get(p.course_id);
      const won = Array.isArray(arr) && arr.length > 0 && arr[0] === p.numero;

      if (p.jockey) {
        const nom = p.jockey.trim();
        const cur = jockeyStats.get(nom) ?? { courses: 0, victoires: 0 };
        cur.courses += 1;
        if (won) cur.victoires += 1;
        jockeyStats.set(nom, cur);
      }
      if (p.nom_cheval) {
        const nom = p.nom_cheval.trim();
        const cur = chevalStats.get(nom) ?? { courses: 0, victoires: 0 };
        cur.courses += 1;
        if (won) cur.victoires += 1;
        chevalStats.set(nom, cur);
      }
    }

    // Récupérer slugs
    const jockeyNames = Array.from(jockeyStats.keys());
    const chevalNames = Array.from(chevalStats.keys());
    const [{ data: jocks }, { data: chevs }] = await Promise.all([
      jockeyNames.length > 0
        ? supabase.from("jockeys").select("nom, slug").in("nom", jockeyNames)
        : Promise.resolve({ data: [] as any[] }),
      chevalNames.length > 0
        ? supabase.from("chevaux").select("nom, slug").in("nom", chevalNames)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const jockSlugMap = new Map((jocks ?? []).map((j: any) => [j.nom, j.slug]));
    const chevSlugMap = new Map((chevs ?? []).map((c: any) => [c.nom, c.slug]));

    topJockeys = Array.from(jockeyStats.entries())
      .map(([nom, s]) => ({
        nom, slug: jockSlugMap.get(nom) ?? "",
        victoires: s.victoires, courses: s.courses,
      }))
      .filter((j) => j.slug !== "")
      .sort((a, b) => b.courses - a.courses)
      .slice(0, 6);

    topChevaux = Array.from(chevalStats.entries())
      .map(([nom, s]) => ({
        nom, slug: chevSlugMap.get(nom) ?? "",
        victoires: s.victoires, courses: s.courses,
      }))
      .filter((c) => c.slug !== "")
      .sort((a, b) => b.courses - a.courses)
      .slice(0, 6);
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
