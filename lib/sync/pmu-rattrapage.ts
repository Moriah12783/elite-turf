/**
 * lib/sync/pmu-rattrapage.ts
 *
 * Rattrapage ponctuel depuis le programme PMU du jour (un appel par jour) :
 *   1. les ARRIVÉES manquantes — constat du 02/10/2026 : 1 113 courses
 *      françaises sans arrivée depuis le 01/05, la synchro horaire ne repassant
 *      jamais sur un jour écoulé ;
 *   2. les HEURES DE DÉPART enregistrées en heure GMT au lieu de l'heure de
 *      Paris (courses de mai à août) — elles faisaient passer des pronostics
 *      publiés une heure avant la course pour des pronostics « d'après départ ».
 *
 * Garde-fous :
 *   - une arrivée n'est ajoutée QUE si la course n'en a aucune, qu'elle est
 *     définitive au PMU et que tous ses numéros figurent parmi nos partants ;
 *   - une arrivée en base différente du PMU est SIGNALÉE ; elle n'est
 *     remplacée qu'en mode `corrigerDivergentes`, et seulement sur une course
 *     SANS aucun pronostic (sinon elle a pu servir à en juger un) ;
 *   - une heure n'est corrigée que si l'écart vaut exactement le décalage UTC
 *     (à ± TOLERANCE_MIN près, le temps d'un retard au départ) ;
 *   - aucun pronostic n'est jugé ici.
 */
import {
  aplatirOrdreArrivee,
  capPourParis,
  cleRC,
  estArriveeDefinitive,
  fetchProgrammeDuJour,
} from "./pmu-arrivees";
import { cleHippodrome } from "./hippodrome-cle";

/** Écart toléré (minutes) entre l'heure programmée et le départ réel. */
export const TOLERANCE_MIN = 10;

export interface DepartPmu {
  /** Heure locale de la course (Paris) « HH:MM ». */
  paris: string;
  /** Décalage UTC de l'heure locale, en minutes (120 en été, 60 en hiver). */
  decalageMin: number;
}

export interface CoursePmuFrance {
  /** Arrivée définitive aplatie ; [] si la course n'est pas officialisée. */
  arrivee: number[];
  depart: DepartPmu | null;
  /** Identité de la course côté PMU : hippodrome (court, long) et nom de l'épreuve. */
  hippodrome: string;
  hippodromeLong: string;
  libelle: string;
}

// ── Identité : (date, R, C) ne suffit PAS ────────────────────────────────────
// Leçon de l'audit du bilan (28/07/2026) : 26 pronostics sur 249 étaient
// comparés à une autre course que la leur. Une course en base n'est « la
// même » que la course PMU de mêmes numéros que si l'HIPPODROME ou le NOM DE
// L'ÉPREUVE concorde. Les copies d'une source secondaire (« Paris-Vincennes »
// pour « Vincennes ») passent par l'inclusion des clés d'hippodrome.

const MOTS_VIDES = ["PRIX", "DE", "DU", "LA", "LE", "LES", "D", "L", "DES", "ET", "AU", "AUX", "GRAND"];

function jetonsEpreuve(nom: string | null | undefined): string[] {
  const bruts = String(nom == null ? "" : nom)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().split(/[^A-Z0-9]+/);
  const out: string[] = [];
  for (let i = 0; i < bruts.length; i++) {
    const t = bruts[i];
    if (t.length > 1 && MOTS_VIDES.indexOf(t) === -1) out.push(t);
  }
  return out;
}

/** Même hippodrome : clés égales, ou l'une contient l'autre (≥ 5 caractères). */
export function memesHippodromes(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = cleHippodrome(String(a == null ? "" : a));
  const kb = cleHippodrome(String(b == null ? "" : b));
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const court = ka.length < kb.length ? ka : kb;
  const long = ka.length < kb.length ? kb : ka;
  return court.length >= 5 && long.indexOf(court) !== -1;
}

/** Même épreuve : au moins 60 % des mots significatifs du nom le plus court en commun. */
export function memesEpreuves(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = jetonsEpreuve(a);
  const tb = jetonsEpreuve(b);
  if (ta.length === 0 || tb.length === 0) return false;
  let communs = 0;
  for (let i = 0; i < ta.length; i++) if (tb.indexOf(ta[i]) !== -1) communs++;
  return communs / Math.min(ta.length, tb.length) >= 0.6;
}

/** La course en base est bien la course PMU de mêmes numéros. */
export function memeCourse(
  base: { hippodrome: string; libelle: string | null },
  pmu: { hippodrome: string; hippodromeLong: string; libelle: string },
): boolean {
  return memesHippodromes(base.hippodrome, pmu.hippodrome)
    || memesHippodromes(base.hippodrome, pmu.hippodromeLong)
    || memesEpreuves(base.libelle, pmu.libelle);
}

function deuxChiffres(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** « HH:MM » ou « HH:MM:SS » → minutes depuis minuit ; null si illisible. */
export function enMinutes(heure: string | null | undefined): number | null {
  const m = String(heure == null ? "" : heure).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const mn = Number(m[2]);
  if (h > 23 || mn > 59) return null;
  return h * 60 + mn;
}

/**
 * PUR : courses FRANÇAISES du programme PMU d'un jour, indexées par R|C.
 * Seules les arrivées définitives sont retenues (cf. estArriveeDefinitive).
 */
export function lireProgrammeFrance(json: unknown): Map<string, CoursePmuFrance> {
  const out = new Map<string, CoursePmuFrance>();
  const prog = json as { programme?: { reunions?: unknown[] } } | null;
  const reunions = prog && prog.programme ? prog.programme.reunions : null;
  if (!Array.isArray(reunions)) return out;

  for (const r of reunions as any[]) {
    if (!r || !r.pays || r.pays.code !== "FRA") continue;
    const numR = Number(r.numOfficiel ?? r.numExterne ?? r.numOrdre);
    if (!Number.isFinite(numR)) continue;

    const courses = Array.isArray(r.courses) ? r.courses : [];
    for (const c of courses as any[]) {
      const numC = Number(c?.numOrdre ?? c?.numExterne);
      if (!Number.isFinite(numC)) continue;

      const arrivee = estArriveeDefinitive(c?.statut, c?.isArriveeDefinitive)
        ? aplatirOrdreArrivee(c?.ordreArrivee)
        : [];

      let depart: DepartPmu | null = null;
      const ms = Number(c?.heureDepart);
      const tz = Number(c?.timezoneOffset);
      if (Number.isFinite(ms) && ms > 0 && Number.isFinite(tz)) {
        const local = new Date(ms + tz);
        depart = {
          paris: `${deuxChiffres(local.getUTCHours())}:${deuxChiffres(local.getUTCMinutes())}`,
          decalageMin: Math.round(tz / 60000),
        };
      }
      out.set(cleRC(numR, numC), {
        arrivee,
        depart,
        hippodrome: String(r.hippodrome?.libelleCourt ?? ""),
        hippodromeLong: String(r.hippodrome?.libelleLong ?? ""),
        libelle: String(c?.libelle ?? ""),
      });
    }
  }
  return out;
}

/**
 * PUR : heure corrigée « HH:MM:SS » si `base` est l'heure UTC de la course
 * (écart = décalage UTC, à ± TOLERANCE_MIN près) ; null sinon. Les minutes
 * programmées sont conservées : seul le décalage est ajouté.
 */
export function heureCorrigee(base: string | null | undefined, depart: DepartPmu | null): string | null {
  if (!depart || depart.decalageMin <= 0) return null;
  const b = enMinutes(base);
  const p = enMinutes(depart.paris);
  if (b === null || p === null) return null;

  const ecart = p - b;
  if (Math.abs(ecart) <= TOLERANCE_MIN) return null;                            // déjà à l'heure de Paris
  if (Math.abs(ecart - depart.decalageMin) > TOLERANCE_MIN) return null;        // écart inexpliqué : on ne devine pas

  const corrigee = b + depart.decalageMin;
  if (corrigee >= 24 * 60) return null;
  return `${deuxChiffres(Math.floor(corrigee / 60))}:${deuxChiffres(corrigee % 60)}:00`;
}

export interface CourseEnBase {
  id: string;
  numero_reunion: number | null;
  numero_course: number | null;
  /** Nom de l'hippodrome et de l'épreuve en base : vérification d'identité. */
  hippodrome: string;
  libelle: string | null;
  heure_depart: string | null;
  paris_disponibles: string[] | null;
  arrivee_officielle: number[] | null;
  /** Une ligne `arrivees` existe déjà. */
  a_ligne_arrivee: boolean;
  /** Numéros de nos partants (non-partants compris) : garde-fou d'appariement. */
  partants: number[];
  /** Pronostics rattachés (publiés ou non) : une arrivée qui a pu en juger un n'est jamais corrigée ici. */
  nb_pronostics: number;
}

export type MotifIgnoree =
  | "sans numéro"
  | "absente du PMU"
  | "autre course au PMU"
  | "arrivée non définitive"
  | "partants inconnus"
  | "numéros hors partants";

export interface PlanRattrapage {
  arrivees: { course_id: string; ordre_arrivee: number[] }[];
  heures: { course_id: string; avant: string; apres: string }[];
  /**
   * Arrivée en base contredite par le PMU. Corrigeable (mode `corrigerDivergentes`)
   * seulement si la course n'a AUCUN pronostic ; sinon signalée, jamais réécrite.
   */
  divergentes: { course_id: string; base: number[]; pmu: number[]; a_ligne_arrivee: boolean; corrigeable: boolean }[];
  ignorees: { course_id: string; motif: MotifIgnoree }[];
}

/** Tous les numéros de l'arrivée figurent parmi nos partants : la course appariée est bien la nôtre. */
function tousParmi(arrivee: number[], partants: number[]): boolean {
  for (let i = 0; i < arrivee.length; i++) if (partants.indexOf(arrivee[i]) === -1) return false;
  return true;
}

/** Les deux arrivées concordent sur leur partie commune (les longueurs varient selon l'époque). */
function concordent(a: number[], b: number[]): boolean {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** PUR : ce qu'il faut écrire pour une journée. N'efface ni ne réécrit rien. */
export function planifierRattrapage(
  courses: CourseEnBase[],
  pmu: Map<string, CoursePmuFrance>,
): PlanRattrapage {
  const plan: PlanRattrapage = { arrivees: [], heures: [], divergentes: [], ignorees: [] };

  for (const c of courses) {
    if (!c.numero_reunion || !c.numero_course) {
      plan.ignorees.push({ course_id: c.id, motif: "sans numéro" });
      continue;
    }
    const brute = pmu.get(cleRC(c.numero_reunion, c.numero_course));
    // Mêmes numéros ne veut pas dire même course : sans concordance
    // d'hippodrome ou d'épreuve, la course PMU n'est pas la nôtre → rien.
    const p = brute && memeCourse(c, brute) ? brute : undefined;

    // 1. Heure de départ enregistrée en GMT.
    const apres = p ? heureCorrigee(c.heure_depart, p.depart) : null;
    if (apres && c.heure_depart) plan.heures.push({ course_id: c.id, avant: c.heure_depart, apres });

    // 2. Arrivée : seulement pour une course qui n'en a AUCUNE.
    const base = Array.isArray(c.arrivee_officielle) && c.arrivee_officielle.length >= 3 ? c.arrivee_officielle : null;
    if (base || c.a_ligne_arrivee) {
      if (base && p && p.arrivee.length >= 3) {
        const officielle = p.arrivee.slice(0, capPourParis(c.paris_disponibles));
        if (!concordent(base, officielle)) {
          // Corrigeable seulement sans pronostic ET si l'appariement est sûr
          // (mêmes garde-fous qu'un ajout : numéros PMU ⊆ nos partants).
          plan.divergentes.push({
            course_id: c.id, base, pmu: officielle,
            a_ligne_arrivee: c.a_ligne_arrivee,
            corrigeable: c.nb_pronostics === 0 && c.partants.length > 0 && tousParmi(officielle, c.partants),
          });
        }
      }
      continue;
    }
    if (!p) {
      plan.ignorees.push({ course_id: c.id, motif: brute ? "autre course au PMU" : "absente du PMU" });
      continue;
    }
    if (p.arrivee.length < 3) {
      plan.ignorees.push({ course_id: c.id, motif: "arrivée non définitive" });
      continue;
    }
    if (c.partants.length === 0) {
      plan.ignorees.push({ course_id: c.id, motif: "partants inconnus" });
      continue;
    }
    const officielle = p.arrivee.slice(0, capPourParis(c.paris_disponibles));
    if (!tousParmi(officielle, c.partants)) {
      plan.ignorees.push({ course_id: c.id, motif: "numéros hors partants" });
      continue;
    }
    plan.arrivees.push({ course_id: c.id, ordre_arrivee: officielle });
  }
  return plan;
}

// ── Exécution ────────────────────────────────────────────────────────────────

export interface RattrapageOptions {
  /** Première date (YYYY-MM-DD) incluse. */
  depuis: string;
  /** Dernière date incluse. */
  jusqua: string;
  dryRun?: boolean;
  /**
   * Remplace par l'arrivée PMU les arrivées contredites des courses SANS
   * pronostic et à l'appariement sûr (numéros PMU ⊆ nos partants) — décision
   * de Steph du 02/10/2026. L'ancienne arrivée est gardée dans `commentaire`
   * et ses rapports, devenus douteux, sont vidés.
   */
  corrigerDivergentes?: boolean;
}

export interface RattrapageResult {
  depuis: string;
  jusqua: string;
  dry_run: boolean;
  jours: number;
  /** API PMU muette ce jour-là : rien n'a été conclu, à relancer. */
  jours_indisponibles: string[];
  courses_lues: number;
  arrivees_ajoutees: number;
  heures_corrigees: number;
  divergentes: number;
  /** Divergences sur des courses sans pronostic (les seules corrigeables). */
  divergentes_corrigeables: number;
  divergentes_corrigees: number;
  exemples_divergentes: string[];
  ignorees: Record<string, number>;
  echecs: number;
}

interface LigneCourse {
  id: string;
  numero_reunion: number | null;
  numero_course: number | null;
  libelle: string | null;
  heure_depart: string | null;
  paris_disponibles: string[] | null;
  arrivee_officielle: number[] | null;
  hippodrome: { nom: string | null; pays: string | null } | { nom: string | null; pays: string | null }[] | null;
  arrivees: { id: string } | { id: string }[] | null;
  partants: { numero: number | null }[] | null;
  pronostics: { id: string }[] | null;
}

function jourSuivant(iso: string): string {
  return new Date(Date.parse(iso + "T12:00:00Z") + 86400000).toISOString().slice(0, 10);
}

export async function runRattrapagePmu(opts: RattrapageOptions): Promise<RattrapageResult> {
  const { createServiceClient } = await import("@/lib/supabase/service-client");
  const supabase = createServiceClient();
  const dryRun = opts.dryRun ?? false;
  const corriger = opts.corrigerDivergentes ?? false;
  const dateDuJour = new Date().toISOString().slice(0, 10);
  const commentaire = `Rattrapage PMU du ${dateDuJour} (programme officiel)`;
  const res: RattrapageResult = {
    depuis: opts.depuis, jusqua: opts.jusqua, dry_run: dryRun,
    jours: 0, jours_indisponibles: [], courses_lues: 0,
    arrivees_ajoutees: 0, heures_corrigees: 0,
    divergentes: 0, divergentes_corrigeables: 0, divergentes_corrigees: 0,
    exemples_divergentes: [], ignorees: {}, echecs: 0,
  };

  for (let jour = opts.depuis; jour <= opts.jusqua; jour = jourSuivant(jour)) {
    res.jours++;
    const json = await fetchProgrammeDuJour(jour);
    await new Promise((r) => setTimeout(r, 300));   // un appel PMU par jour, sans rafale
    if (!json) {
      res.jours_indisponibles.push(jour);
      continue;
    }
    const pmu = lireProgrammeFrance(json);

    // Une journée compte au plus une centaine de courses : une page suffit,
    // mais une page pleine signalerait une lecture tronquée (limite de 1 000).
    const { data, error } = await supabase
      .from("courses")
      .select("id, numero_reunion, numero_course, libelle, heure_depart, paris_disponibles, arrivee_officielle, hippodrome:hippodromes(nom, pays), arrivees(id), partants(numero), pronostics(id)")
      .eq("date_course", jour)
      .order("id", { ascending: true })
      .range(0, 999);
    if (error) throw new Error(`lecture des courses du ${jour} : ${error.message}`);
    const lignes = (data ?? []) as unknown as LigneCourse[];
    if (lignes.length >= 1000) throw new Error(`${jour} : 1 000 courses lues, lecture probablement tronquée`);

    const courses: CourseEnBase[] = [];
    for (const l of lignes) {
      const h = Array.isArray(l.hippodrome) ? l.hippodrome[0] : l.hippodrome;
      if (!h || h.pays !== "France") continue;
      const a = Array.isArray(l.arrivees) ? l.arrivees[0] : l.arrivees;
      const numeros: number[] = [];
      for (const p of l.partants ?? []) if (typeof p.numero === "number") numeros.push(p.numero);
      courses.push({
        id: l.id,
        numero_reunion: l.numero_reunion,
        numero_course: l.numero_course,
        hippodrome: h.nom ?? "",
        libelle: l.libelle,
        heure_depart: l.heure_depart,
        paris_disponibles: l.paris_disponibles,
        arrivee_officielle: l.arrivee_officielle,
        a_ligne_arrivee: !!a,
        partants: numeros,
        nb_pronostics: Array.isArray(l.pronostics) ? l.pronostics.length : 0,
      });
    }
    res.courses_lues += courses.length;

    const plan = planifierRattrapage(courses, pmu);
    for (const i of plan.ignorees) res.ignorees[i.motif] = (res.ignorees[i.motif] || 0) + 1;
    res.divergentes += plan.divergentes.length;
    const aCorriger = corriger ? plan.divergentes.filter((d) => d.corrigeable) : [];
    for (const d of plan.divergentes) {
      if (d.corrigeable) res.divergentes_corrigeables++;
      if (res.exemples_divergentes.length < 20) {
        res.exemples_divergentes.push(`${jour} ${d.course_id.slice(0, 8)} base ${d.base.join("-")} / PMU ${d.pmu.join("-")}${d.corrigeable ? "" : " (non corrigeable : pronostic rattaché ou appariement douteux)"}`);
      }
    }

    if (dryRun) {
      res.arrivees_ajoutees += plan.arrivees.length;
      res.heures_corrigees += plan.heures.length;
      res.divergentes_corrigees += aCorriger.length;
      continue;
    }

    for (const d of aCorriger) {
      const note = `Corrigée le ${dateDuJour} d'après le programme PMU (avant : ${d.base.join("-")})`;
      // Avec une ligne `arrivees` : on la réécrit (le déclencheur recopie dans
      // `courses`) ; ses rapports appartenaient à l'arrivée fausse → vidés.
      // Sans ligne : on la crée, ce qui corrige `courses` de la même façon.
      const { error: e } = d.a_ligne_arrivee
        ? await supabase.from("arrivees")
            .update({ ordre_arrivee: d.pmu, rapports_pmu: null, commentaire: note })
            .eq("course_id", d.course_id)
        : await supabase.from("arrivees").upsert(
            [{ course_id: d.course_id, ordre_arrivee: d.pmu, commentaire: note, horodatage: new Date().toISOString() }],
            { onConflict: "course_id", ignoreDuplicates: true },
          );
      if (e) {
        res.echecs++;
        console.warn(`[rattrapage] ${jour} correction ${d.course_id} : ${e.message}`);
      } else {
        res.divergentes_corrigees++;
      }
    }

    if (plan.arrivees.length > 0) {
      // INSERT … ON CONFLICT DO NOTHING : une arrivée apparue entre-temps n'est
      // jamais écrasée. Le déclencheur recopie l'arrivée dans `courses`.
      const horodatage = new Date().toISOString();
      const { error: e } = await supabase.from("arrivees").upsert(
        plan.arrivees.map((x) => ({ course_id: x.course_id, ordre_arrivee: x.ordre_arrivee, commentaire, horodatage })),
        { onConflict: "course_id", ignoreDuplicates: true },
      );
      if (e) {
        res.echecs++;
        console.warn(`[rattrapage] ${jour} arrivées : ${e.message}`);
      } else {
        res.arrivees_ajoutees += plan.arrivees.length;
      }
    }
    for (const hc of plan.heures) {
      const { error: e } = await supabase
        .from("courses")
        .update({ heure_depart: hc.apres })
        .eq("id", hc.course_id)
        .eq("heure_depart", hc.avant);
      if (e) {
        res.echecs++;
        console.warn(`[rattrapage] ${jour} heure ${hc.course_id} : ${e.message}`);
      } else {
        res.heures_corrigees++;
      }
    }
  }
  return res;
}
