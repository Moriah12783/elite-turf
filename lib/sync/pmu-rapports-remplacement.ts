/**
 * lib/sync/pmu-rapports-remplacement.ts
 *
 * Remplacement ONE-SHOT des rapports déjà en base par les rapports PMU
 * officiels (masse internet). Audit du 09/10/2026 : les rapports lus sur Geny
 * étaient faux (Tiercé et Quinté+ sur des courses qui n'en ont pas, simples et
 * couplés d'un autre opérateur) ; huit Quinté+ de septembre-octobre gardaient
 * l'ordre « + Tirelire » relevé avant la PR #388.
 *
 * Décisions de Steph du 09/10/2026 :
 *   - ère Geny (courses jusqu'au FIN_RAPPORTS_GENY) : rapports remplacés par
 *     ceux du PMU quand la course est retrouvée au PMU, VIDÉS sinon ;
 *   - ère PMU : remplacés seulement si un montant diffère, laissés sinon.
 *
 * La course PMU est retrouvée par son ARRIVÉE (nos 3 premiers), parmi les
 * courses du jour de même numéro : la numérotation des réunions en base
 * diffère parfois de celle du PMU. Essai à blanc par défaut ; sauvegarde dans
 * le schéma `sauvegarde` faite à la main avant toute écriture.
 */
import type { RapportsPMU } from "./geny-rapports-parser";
import { concordeAvecPmu, fetchPmuArriveesDuJour, type ArriveeRangee } from "./pmu-arrivees";
import { fetchRapportsDefinitifs, parseRapportsDefinitifs } from "./pmu-rapports";

/** Dernière date de course aux rapports Geny (dernière écriture Geny : 28/07/2026). */
export const FIN_RAPPORTS_GENY = "2026-07-27";

export type Resolution =
  | { etat: "trouvee"; R: number; C: number }
  | { etat: "introuvable" }
  | { etat: "ambigue" }
  | { etat: "pmu_indisponible" };

/**
 * PUR : quelle course PMU du jour a notre arrivée (3 premiers, deux ex æquo
 * pouvant être inversés) ? Cherchée parmi les courses de même numéro, notre
 * R/C d'abord. Map vide = programme indisponible : on ne conclut rien.
 */
export function resoudreCoursePmu(
  arrivee: number[] | null | undefined,
  R: number,
  C: number,
  arriveesPmu: Map<string, ArriveeRangee>,
): Resolution {
  if (arriveesPmu.size === 0) return { etat: "pmu_indisponible" };
  if (!Array.isArray(arrivee) || arrivee.length < 3) return { etat: "introuvable" };
  const top3 = arrivee.slice(0, 3);
  const reunions: number[] = [];
  arriveesPmu.forEach((off, cle) => {
    const [r, c] = cle.split("|").map(Number);
    if (c === C && concordeAvecPmu(top3, off)) reunions.push(r);
  });
  if (reunions.indexOf(R) !== -1) return { etat: "trouvee", R, C };
  if (reunions.length === 1) return { etat: "trouvee", R: reunions[0], C };
  return reunions.length === 0 ? { etat: "introuvable" } : { etat: "ambigue" };
}

/** PUR : lignes de la base qui désignent la MÊME course PMU (03/10/2026 : Amiens et Beaumont-de-Lomagne). */
export function doublons(lignes: { id: string; date: string; resolution: Resolution }[]): Set<string> {
  const parCourse: Record<string, string[]> = {};
  for (const l of lignes) {
    if (l.resolution.etat !== "trouvee") continue;
    const cle = `${l.date}|${l.resolution.R}|${l.resolution.C}`;
    (parCourse[cle] = parCourse[cle] || []).push(l.id);
  }
  const out = new Set<string>();
  for (const cle of Object.keys(parCourse)) if (parCourse[cle].length > 1) parCourse[cle].forEach((id) => out.add(id));
  return out;
}

export type Action =
  | { action: "remplacer"; rapports: RapportsPMU }
  | { action: "vider"; motif: string }
  | { action: "inchange" }
  | { action: "laisser"; motif: string }
  | { action: "reessayer"; motif: string };

/** JSON à clés triées, valeurs `undefined` omises (comme en base). */
function stable(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return "{" + Object.keys(o).filter((k) => o[k] !== undefined).sort()
      .map((k) => JSON.stringify(k) + ":" + stable(o[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

function montants(r: RapportsPMU): RapportsPMU {
  const copie = { ...r };
  delete copie.combinaisons;
  return copie;
}

/**
 * PUR : que faire d'une ligne ? `frais` = rapports PMU convertis (null : rien
 * d'exploitable ; « indisponible » : l'API n'a pas répondu). Réseau en panne
 * → réessayer, jamais vider.
 */
export function deciderLigne(l: {
  date: string;
  existant: RapportsPMU;
  resolution: Resolution;
  frais: RapportsPMU | null | "indisponible";
  doublon: boolean;
}): Action {
  const geny = l.date <= FIN_RAPPORTS_GENY;
  const inverifiable = (motif: string): Action => (geny ? { action: "vider", motif } : { action: "laisser", motif });
  if (l.resolution.etat === "pmu_indisponible") return { action: "reessayer", motif: "programme PMU indisponible" };
  if (l.resolution.etat === "introuvable") return inverifiable("aucune course PMU du jour n'a cette arrivée");
  if (l.resolution.etat === "ambigue") return inverifiable("plusieurs courses PMU ont cette arrivée");
  if (l.doublon) return inverifiable("deux courses en base pour une seule course PMU");
  if (l.frais === "indisponible") return { action: "reessayer", motif: "rapports PMU indisponibles" };
  if (l.frais === null) return inverifiable("rapports PMU sans montant exploitable");
  // Ère PMU : la clé `combinaisons` (PR #388) manque aux lignes plus anciennes,
  // sans que leurs montants soient faux — seuls les montants comptent.
  const egal = geny ? stable(l.existant) === stable(l.frais) : stable(montants(l.existant)) === stable(montants(l.frais));
  return egal ? { action: "inchange" } : { action: "remplacer", rapports: l.frais };
}

// ── Exécution (réseau + base) ────────────────────────────────────────────────

export interface LignePlan {
  id: string;
  course_id: string;
  date: string;
  R: number | null;
  C: number | null;
  /** Réunion PMU retenue quand elle diffère de la nôtre. */
  R_pmu?: number;
  action: Action["action"];
  motif?: string;
  avant: RapportsPMU;
  apres?: RapportsPMU | null;
}

export interface RemplacementResult {
  ecrire: boolean;
  lues: number;
  par_action: Record<string, number>;
  par_motif: Record<string, number>;
  ecrites: number;
  echecs: number;
  plan: LignePlan[];
}

interface LigneLue {
  id: string;
  course_id: string;
  rapports_pmu: RapportsPMU;
  course: { date_course: string; numero_reunion: number | null; numero_course: number | null; arrivee_officielle: number[] | null }
    | { date_course: string; numero_reunion: number | null; numero_course: number | null; arrivee_officielle: number[] | null }[];
}

async function enParallele<T>(items: T[], n: number, travail: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const suivant = async (): Promise<void> => { while (i < items.length) await travail(items[i++]); };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, suivant));
}

export async function runRemplacementRapports(opts: { ecrire?: boolean; depuis?: string; jusqua?: string } = {}): Promise<RemplacementResult> {
  const { createServiceClient } = await import("@/lib/supabase/service-client");
  const supabase = createServiceClient();
  const ecrire = opts.ecrire === true;

  const lues: LigneLue[] = [];
  for (let debut = 0; ; debut += 1000) {
    let q = supabase
      .from("arrivees")
      .select("id, course_id, rapports_pmu, course:courses!inner(date_course, numero_reunion, numero_course, arrivee_officielle)")
      .not("rapports_pmu", "is", null);
    if (opts.depuis) q = q.gte("course.date_course", opts.depuis);
    if (opts.jusqua) q = q.lte("course.date_course", opts.jusqua);
    const { data, error } = await q.order("id", { ascending: true }).range(debut, debut + 999);
    if (error) throw new Error(`lecture des arrivées : ${error.message}`);
    const page = (data ?? []) as unknown as LigneLue[];
    for (let k = 0; k < page.length; k++) lues.push(page[k]);
    if (page.length < 1000) break;
  }
  const course = (l: LigneLue) => (Array.isArray(l.course) ? l.course[0] : l.course);

  // Arrivées PMU de chaque jour (un appel par jour).
  const jours = Array.from(new Set(lues.map((l) => course(l).date_course)));
  const arriveesParJour: Record<string, Map<string, ArriveeRangee>> = {};
  await enParallele(jours, 3, async (j) => { arriveesParJour[j] = await fetchPmuArriveesDuJour(j); });

  const resolues = lues.map((l) => {
    const c = course(l);
    return {
      l, c, id: l.id, date: c.date_course,
      resolution: resoudreCoursePmu(c.arrivee_officielle, c.numero_reunion ?? 0, c.numero_course ?? 0, arriveesParJour[c.date_course]),
    };
  });
  const enDouble = doublons(resolues);

  const frais: Record<string, RapportsPMU | null | "indisponible"> = {};
  const aRecuperer = resolues.filter((x) => x.resolution.etat === "trouvee" && !enDouble.has(x.id));
  await enParallele(aRecuperer, 4, async (x) => {
    const r = x.resolution as { R: number; C: number };
    const brut = await fetchRapportsDefinitifs(x.date, r.R, r.C);
    frais[x.id] = brut ? parseRapportsDefinitifs(brut, x.c.arrivee_officielle || []) : "indisponible";
  });

  const plan: LignePlan[] = resolues.map((x) => {
    const a = deciderLigne({
      date: x.date, existant: x.l.rapports_pmu, resolution: x.resolution,
      frais: x.id in frais ? frais[x.id] : null, doublon: enDouble.has(x.id),
    });
    const ligne: LignePlan = {
      id: x.id, course_id: x.l.course_id, date: x.date, R: x.c.numero_reunion, C: x.c.numero_course,
      action: a.action, avant: x.l.rapports_pmu,
    };
    if (x.resolution.etat === "trouvee" && x.resolution.R !== x.c.numero_reunion) ligne.R_pmu = x.resolution.R;
    if ("motif" in a) ligne.motif = a.motif;
    if (a.action === "remplacer") ligne.apres = a.rapports;
    if (a.action === "vider") ligne.apres = null;
    return ligne;
  });

  let ecrites = 0, echecs = 0;
  if (ecrire) {
    for (const p of plan) {
      if (p.action !== "remplacer" && p.action !== "vider") continue;
      const { data, error } = await supabase
        .from("arrivees")
        .update({ rapports_pmu: p.apres ?? null })
        .eq("id", p.id)
        .not("rapports_pmu", "is", null)
        .select("id");
      if (error || !data || data.length === 0) {
        echecs++;
        console.warn(`[remplacement-rapports] ${p.date} R${p.R}C${p.C} : ${error ? error.message : "aucune ligne modifiée"}`);
      } else ecrites++;
    }
  }

  const par_action: Record<string, number> = {};
  const par_motif: Record<string, number> = {};
  for (const p of plan) {
    const ere = p.date <= FIN_RAPPORTS_GENY ? "geny" : "pmu";
    par_action[`${ere}|${p.action}`] = (par_action[`${ere}|${p.action}`] || 0) + 1;
    if (p.motif) par_motif[`${ere}|${p.motif}`] = (par_motif[`${ere}|${p.motif}`] || 0) + 1;
  }
  return { ecrire, lues: lues.length, par_action, par_motif, ecrites, echecs, plan };
}
