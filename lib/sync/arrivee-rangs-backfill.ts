/**
 * lib/sync/arrivee-rangs-backfill.ts
 *
 * Backfill des rangs d'arrivée (ex æquo) sur les arrivées DÉJÀ en base, d'après
 * le programme PMU du jour (un appel par jour). Décision de Steph du 08/10/2026 :
 * essai à blanc d'abord, puis écriture.
 *
 * Garde-fous :
 *   - seules les courses dont le PMU a un ex æquo sont regardées ;
 *   - l'arrivée en base doit être celle du PMU, au rang près (concordeAvecPmu) ;
 *     sinon elle est signalée, jamais touchée ;
 *   - `courses` et `arrivees` doivent porter la même arrivée : le déclencheur
 *     recopie `arrivees` dans `courses`, il ne doit rien changer d'autre que les
 *     rangs ;
 *   - n'écrit QUE des rangs : ni arrivée, ni rapport, ni pronostic. Aucun
 *     pronostic n'est rejugé (mesure du 08/10/2026 : aucun ne changerait de
 *     catégorie).
 */
import {
  cleRC,
  concordeAvecPmu,
  fetchProgrammeDuJour,
  parseArriveesProgramme,
  rangsPourArriveeEnBase,
  type ArriveePmu,
} from "./pmu-arrivees";
import { rangsAStocker } from "../courses/rangs";

export interface CourseBackfill {
  id: string;
  numero_reunion: number | null;
  numero_course: number | null;
  arrivee_officielle: number[] | null;
  arrivee_rangs: number[] | null;
  /** `arrivees.ordre_arrivee` de la course, si la ligne existe. */
  ordre_arrivee_ligne: number[] | null;
  a_ligne_arrivee: boolean;
  nb_pronostics: number;
}

export interface EcritureRangs {
  course_id: string;
  /** `arrivees` (le déclencheur recopie dans `courses`) ou `courses` directement. */
  cible: "arrivees" | "courses";
  rangs: number[];
}

export interface PlanBackfillRangs {
  ecritures: EcritureRangs[];
  deja: string[];
  nonConcordantes: string[];
  desynchronisees: string[];
  /** Arrivée concordante, mais l'ex æquo tombe au-delà de la partie enregistrée. */
  sansExAequo: number;
}

function egaux(a: number[] | null | undefined, b: number[] | null | undefined): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** PUR : les rangs à poser pour une journée. */
export function planifierBackfillRangs(pmu: ArriveePmu[], courses: CourseBackfill[]): PlanBackfillRangs {
  const plan: PlanBackfillRangs = { ecritures: [], deja: [], nonConcordantes: [], desynchronisees: [], sansExAequo: 0 };
  const parRC: Record<string, ArriveePmu> = {};
  for (const a of pmu) parRC[cleRC(a.reunion, a.course)] = a;

  for (const c of courses) {
    const base = c.arrivee_officielle;
    if (!Array.isArray(base) || base.length < 3 || !c.numero_reunion || !c.numero_course) continue;
    const a = parRC[cleRC(c.numero_reunion, c.numero_course)];
    if (!a) continue;
    if (c.a_ligne_arrivee && !egaux(c.ordre_arrivee_ligne, base)) {
      plan.desynchronisees.push(c.id);
      continue;
    }
    if (!concordeAvecPmu(base, a)) {
      plan.nonConcordantes.push(c.id);
      continue;
    }
    const rangs = rangsPourArriveeEnBase(base, a);
    if (!rangs) {
      plan.sansExAequo++;
      continue;
    }
    if (egaux(c.arrivee_rangs, rangs)) {
      plan.deja.push(c.id);
      continue;
    }
    plan.ecritures.push({ course_id: c.id, cible: c.a_ligne_arrivee ? "arrivees" : "courses", rangs });
  }
  return plan;
}

// ── Exécution ────────────────────────────────────────────────────────────────

export interface BackfillRangsOptions {
  depuis: string;
  jusqua: string;
  /** true (défaut) = ne rien écrire, seulement lister. */
  dryRun?: boolean;
}

export interface BackfillRangsResult {
  depuis: string;
  jusqua: string;
  dry_run: boolean;
  jours: number;
  jours_indisponibles: string[];
  courses_pmu_ex_aequo: number;
  a_ecrire: string[];
  ecrites: number;
  deja: number;
  non_concordantes: string[];
  desynchronisees: string[];
  sans_ex_aequo_enregistre: number;
  echecs: number;
}

interface LigneCourse {
  id: string;
  numero_reunion: number | null;
  numero_course: number | null;
  libelle: string | null;
  arrivee_officielle: number[] | null;
  arrivee_rangs: number[] | null;
  hippodrome: { nom: string | null } | { nom: string | null }[] | null;
  arrivees: { ordre_arrivee: number[] | null } | { ordre_arrivee: number[] | null }[] | null;
  pronostics: { id: string }[] | null;
}

function jourSuivant(iso: string): string {
  return new Date(Date.parse(iso + "T12:00:00Z") + 86400000).toISOString().slice(0, 10);
}

export async function runBackfillRangs(opts: BackfillRangsOptions): Promise<BackfillRangsResult> {
  const { createServiceClient } = await import("@/lib/supabase/service-client");
  const supabase = createServiceClient();
  const dryRun = opts.dryRun !== false;
  const res: BackfillRangsResult = {
    depuis: opts.depuis, jusqua: opts.jusqua, dry_run: dryRun,
    jours: 0, jours_indisponibles: [], courses_pmu_ex_aequo: 0,
    a_ecrire: [], ecrites: 0, deja: 0, non_concordantes: [], desynchronisees: [],
    sans_ex_aequo_enregistre: 0, echecs: 0,
  };

  for (let jour = opts.depuis; jour <= opts.jusqua; jour = jourSuivant(jour)) {
    res.jours++;
    const json = await fetchProgrammeDuJour(jour);
    await new Promise((r) => setTimeout(r, 300));   // un appel PMU par jour, sans rafale
    if (!json) {
      res.jours_indisponibles.push(jour);
      continue;
    }
    const pmu = parseArriveesProgramme(json).filter((a) => rangsAStocker(a.rangs) !== null);
    if (pmu.length === 0) continue;
    res.courses_pmu_ex_aequo += pmu.length;

    // `arrivee_rangs` n'est lu qu'après la migration : en essai à blanc avant
    // elle, la colonne est absente et on part de « aucun rang posé ».
    const colonnes = "id, numero_reunion, numero_course, libelle, arrivee_officielle, hippodrome:hippodromes(nom), arrivees(ordre_arrivee), pronostics(id)";
    let lecture: { data: unknown; error: { message: string } | null } = await supabase.from("courses").select(`${colonnes}, arrivee_rangs`)
      .eq("date_course", jour).not("arrivee_officielle", "is", null).range(0, 999);
    if (lecture.error && dryRun && /arrivee_rangs/.test(lecture.error.message)) {
      lecture = await supabase.from("courses").select(colonnes)
        .eq("date_course", jour).not("arrivee_officielle", "is", null).range(0, 999);
    }
    if (lecture.error) throw new Error(`lecture des courses du ${jour} : ${lecture.error.message}`);
    const lignes = (lecture.data ?? []) as unknown as LigneCourse[];
    if (lignes.length >= 1000) throw new Error(`${jour} : 1 000 courses lues, lecture probablement tronquée`);

    const parId: Record<string, LigneCourse> = {};
    const courses: CourseBackfill[] = lignes.map((l) => {
      parId[l.id] = l;
      const a = Array.isArray(l.arrivees) ? l.arrivees[0] : l.arrivees;
      return {
        id: l.id,
        numero_reunion: l.numero_reunion,
        numero_course: l.numero_course,
        arrivee_officielle: l.arrivee_officielle,
        arrivee_rangs: l.arrivee_rangs ?? null,
        ordre_arrivee_ligne: a ? a.ordre_arrivee : null,
        a_ligne_arrivee: !!a,
        nb_pronostics: Array.isArray(l.pronostics) ? l.pronostics.length : 0,
      };
    });

    const plan = planifierBackfillRangs(pmu, courses);
    res.deja += plan.deja.length;
    res.sans_ex_aequo_enregistre += plan.sansExAequo;
    const decrire = (id: string): string => {
      const l = parId[id];
      const h = Array.isArray(l.hippodrome) ? l.hippodrome[0] : l.hippodrome;
      return `${jour} R${l.numero_reunion}C${l.numero_course} ${h?.nom ?? "?"} « ${l.libelle ?? ""} » ${(l.arrivee_officielle ?? []).join("-")}`;
    };
    for (const id of plan.nonConcordantes) res.non_concordantes.push(decrire(id));
    for (const id of plan.desynchronisees) res.desynchronisees.push(decrire(id));

    for (const e of plan.ecritures) {
      const l = parId[e.course_id];
      const pronos = Array.isArray(l.pronostics) ? l.pronostics.length : 0;
      res.a_ecrire.push(`${decrire(e.course_id)} → rangs ${e.rangs.join(",")}${pronos > 0 ? ` (${pronos} pronostic(s))` : ""}`);
      if (dryRun) continue;
      // Garde de concurrence : l'arrivée ne doit pas avoir changé depuis la lecture.
      const arrivee = `{${(l.arrivee_officielle ?? []).join(",")}}`;
      const { error: err } = e.cible === "arrivees"
        ? await supabase.from("arrivees").update({ rangs: e.rangs }).eq("course_id", e.course_id).eq("ordre_arrivee", arrivee)
        : await supabase.from("courses").update({ arrivee_rangs: e.rangs }).eq("id", e.course_id).eq("arrivee_officielle", arrivee);
      if (err) {
        res.echecs++;
        console.warn(`[backfill-rangs] ${decrire(e.course_id)} : ${err.message}`);
      } else {
        res.ecrites++;
      }
    }
  }
  return res;
}
