/**
 * lib/sync/pmu-rapports.ts
 *
 * Rapports PMU définitifs d'une course — source API PMU officielle.
 *
 * Contexte (01/10/2026) : `arrivees.rapports_pmu` venait du scraping Geny, qui
 * nous bloque (403) depuis l'été : les 15 derniers Quinté+ n'ont plus aucun
 * rapport. Le PMU les publie à `/programme/{DDMMYYYY}/R{r}/C{c}/rapports-definitifs`
 * (vérifié le 01/10/2026 : HTTP 200).
 *
 * Ce module CONVERTIT seulement (pur, testé) et récupère (réseau). Il n'écrit
 * RIEN en base : remplir `rapports_pmu` réactive la chaîne du ROI public (cron
 * 22:40 UTC → `pronostics.rapport_gagnant` → /performances, « Mon ROI »).
 * Décision de Steph du 01/10/2026 : simulation d'abord, activation après
 * son accord.
 *
 * Unités = conventions déjà en base (parser Geny, `RapportsPMU`) : Quinté+
 * « pour 2 € », tous les autres « pour 1 € ». Calculées depuis
 * `dividendePourUnEuro` (centimes pour 1 €), donc indépendantes de la mise
 * de base du PMU (Quarté+ 1,50 €, Quinté+ 2 €…).
 */
import type { RapportsPMU } from "./geny-rapports-parser";
import { isoVersDdmmyyyy } from "./pmu-arrivees";

interface RapportBrut {
  libelle?: string;
  combinaison?: string;
  dividendePourUnEuro?: number;
}

interface PariBrut {
  typePari?: string;
  rapports?: RapportBrut[];
}

/** Centimes pour 1 € → euros pour `mise` €, arrondis au centime. */
function euros(r: RapportBrut | undefined, mise = 1): number | undefined {
  const c = r && typeof r.dividendePourUnEuro === "number" ? r.dividendePourUnEuro : NaN;
  if (!Number.isFinite(c) || c <= 0) return undefined;
  return Math.round(c * mise) / 100;
}

function trouver(rapports: RapportBrut[], motif: RegExp): RapportBrut | undefined {
  for (let i = 0; i < rapports.length; i++) if (motif.test(rapports[i].libelle || "")) return rapports[i];
  return undefined;
}

/** Rapports dans l'ordre des combinaisons attendues (ex. « 15-3 », « 15-14 »…). */
function selonCombinaisons(rapports: RapportBrut[], combinaisons: string[]): number[] | undefined {
  const out: number[] = [];
  for (const cible of combinaisons) {
    let trouve: number | undefined;
    for (const r of rapports) if ((r.combinaison || "") === cible) { trouve = euros(r); break; }
    if (trouve === undefined) return undefined;
    out.push(trouve);
  }
  return out;
}

/**
 * PUR : rapports définitifs PMU → `RapportsPMU` (format de `arrivees.rapports_pmu`).
 * `arrivee` sert à ordonner les placés (1er, 2e, 3e) et les couplés placés
 * ([1-2, 1-3, 2-3]). null si rien d'exploitable.
 */
export function parseRapportsDefinitifs(json: unknown, arrivee: number[]): RapportsPMU | null {
  if (!Array.isArray(json)) return null;
  const parType: Record<string, RapportBrut[]> = {};
  for (const p of json as PariBrut[]) {
    if (p && p.typePari && Array.isArray(p.rapports)) parType[p.typePari] = p.rapports;
  }
  const out: RapportsPMU = {};

  const quinte = parType["E_QUINTE_PLUS"];
  if (quinte) {
    const q = {
      ordre: euros(trouver(quinte, /ordre/i), 2),
      desordre: euros(trouver(quinte, /d[ée]sordre/i), 2),
      bonus4: euros(trouver(quinte, /bonus\s*4/i), 2),
      bonus3: euros(trouver(quinte, /bonus\s*3/i), 2),
    };
    if (q.ordre !== undefined || q.desordre !== undefined) out.quinte_plus = q;
  }

  const quarte = parType["E_QUARTE_PLUS"];
  if (quarte) {
    const q = {
      ordre: euros(trouver(quarte, /ordre/i)),
      desordre: euros(trouver(quarte, /d[ée]sordre/i)),
      bonus: euros(trouver(quarte, /bonus/i)),
    };
    if (q.ordre !== undefined || q.desordre !== undefined) out.quarte_plus = q;
  }

  const tierce = parType["E_TIERCE"];
  if (tierce) {
    const t = { ordre: euros(trouver(tierce, /ordre/i)), desordre: euros(trouver(tierce, /d[ée]sordre/i)) };
    if (t.ordre !== undefined || t.desordre !== undefined) out.tierce = t;
  }

  const sg = parType["E_SIMPLE_GAGNANT"];
  if (sg && sg.length > 0) {
    const v = euros(sg[0]);
    if (v !== undefined) out.simple_gagnant = v;
  }

  const cg = parType["E_COUPLE_GAGNANT"];
  if (cg && cg.length > 0) {
    const v = euros(cg[0]);
    if (v !== undefined) out.couple_gagnant = v;
  }

  if (arrivee.length >= 3) {
    const [a, b, c] = arrivee;
    const sp = parType["E_SIMPLE_PLACE"];
    const placés = sp ? selonCombinaisons(sp, [String(a), String(b), String(c)]) : undefined;
    if (placés) out.simple_place = placés;
    const cp = parType["E_COUPLE_PLACE"];
    const couplés = cp ? selonCombinaisons(cp, [`${a}-${b}`, `${a}-${c}`, `${b}-${c}`]) : undefined;
    if (couplés) out.couple_place = couplés;
  }

  return Object.keys(out).length > 0 ? out : null;
}

const PMU_DIRECT = "https://online.turfinfo.api.pmu.fr";
const PMU_PROXY = (process.env.PMU_PROXY_URL || process.env.PMU_PROXY || "https://pmu-proxy.manuel-conti2008.workers.dev").replace(/\/$/, "");
const PMU_HEADERS = {
  "Accept": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Referer": "https://www.pmu.fr/",
  "Origin": "https://www.pmu.fr",
};

/**
 * Rapports définitifs bruts d'une course (proxy d'abord : l'IP du Worker est
 * bloquée en direct). null si indisponibles (course pas encore officialisée,
 * API en panne) : l'appelant NE DOIT PAS en conclure « pas de rapport ».
 */
export async function fetchRapportsDefinitifs(dateISO: string, R: number, C: number, timeoutMs = 15000): Promise<unknown | null> {
  const chemin = `/rest/client/1/programme/${isoVersDdmmyyyy(dateISO)}/R${R}/C${C}/rapports-definitifs?specialisation=INTERNET`;
  for (const base of [PMU_PROXY, PMU_DIRECT]) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(base + chemin, { headers: PMU_HEADERS, cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) return json;
    } catch {
      clearTimeout(timer);
      /* base suivante */
    }
  }
  return null;
}

// ── Synchro : écrit les rapports manquants dans `arrivees.rapports_pmu` ─────

export interface RapportsSyncOptions {
  /** Première date (YYYY-MM-DD) incluse. */
  depuis: string;
  /** Dernière date incluse (défaut : `depuis`). */
  jusqua?: string;
  /** « quinte » : seulement les Quinté+ ; « toutes » : toutes les courses françaises. */
  portee?: "quinte" | "toutes";
  /** Plafond de courses traitées (test). */
  limite?: number;
  dryRun?: boolean;
}

export interface RapportsSyncResult {
  depuis: string;
  jusqua: string;
  portee: "quinte" | "toutes";
  candidates: number;
  ecrits: number;
  /** Rapports pas encore publiés par le PMU (ou API indisponible) : retentés au passage suivant. */
  indisponibles: number;
  echecs: number;
  dry_run: boolean;
}

interface CourseCandidate {
  id: string;
  date_course: string;
  numero_reunion: number | null;
  numero_course: number | null;
  nationale: number | null;
  paris_disponibles: string[] | null;
  arrivee_officielle: number[] | null;
  hippodrome: { pays: string | null } | { pays: string | null }[] | null;
  arrivees: { id: string; rapports_pmu: unknown } | { id: string; rapports_pmu: unknown }[] | null;
}

/**
 * Course française, arrivée officielle connue, ligne `arrivees` existante et
 * `rapports_pmu` encore vide. PUR (testé).
 */
export function estCandidate(c: CourseCandidate, portee: "quinte" | "toutes"): boolean {
  const h = Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome;
  if (!h || h.pays !== "France") return false;
  if (!Array.isArray(c.arrivee_officielle) || c.arrivee_officielle.length < 3) return false;
  if (!c.numero_reunion || !c.numero_course) return false;
  const a = Array.isArray(c.arrivees) ? c.arrivees[0] : c.arrivees;
  if (!a || a.rapports_pmu != null) return false;
  if (portee === "quinte") {
    const quintePlus = Array.isArray(c.paris_disponibles) && c.paris_disponibles.indexOf("QUINTE_PLUS") !== -1;
    return c.nationale === 1 || quintePlus;
  }
  return true;
}

/**
 * Récupère et écrit les rapports PMU définitifs manquants. N'écrase JAMAIS un
 * rapport existant (`rapports_pmu IS NULL` revérifié à l'écriture). Rien
 * d'inventé : sans rapports exploitables, la course est laissée telle quelle et
 * retentée au passage suivant.
 *
 * ⚠️ N'alimente PAS le ROI : la propagation vers `pronostics.rapport_gagnant`
 * est coupée (PROPAGATION_ROI_COUPEE, lib/pmu-backfill-rapport-gagnant.ts).
 */
export async function runPmuRapportsSync(opts: RapportsSyncOptions): Promise<RapportsSyncResult> {
  const { createServiceClient } = await import("@/lib/supabase/service-client");
  const supabase = createServiceClient();
  const jusqua = opts.jusqua || opts.depuis;
  const portee = opts.portee || "toutes";
  const dryRun = opts.dryRun ?? false;

  const { data, error } = await supabase
    .from("courses")
    .select("id, date_course, numero_reunion, numero_course, nationale, paris_disponibles, arrivee_officielle, hippodrome:hippodromes(pays), arrivees(id, rapports_pmu)")
    .gte("date_course", opts.depuis)
    .lte("date_course", jusqua)
    .not("arrivee_officielle", "is", null)
    .order("date_course", { ascending: true });
  if (error) throw new Error(`lecture des courses : ${error.message}`);

  let candidates = ((data ?? []) as unknown as CourseCandidate[]).filter((c) => estCandidate(c, portee));
  if (opts.limite && opts.limite > 0) candidates = candidates.slice(0, opts.limite);

  let ecrits = 0, indisponibles = 0, echecs = 0;
  for (const c of candidates) {
    const brut = await fetchRapportsDefinitifs(c.date_course, c.numero_reunion as number, c.numero_course as number);
    const rapports = brut ? parseRapportsDefinitifs(brut, c.arrivee_officielle || []) : null;
    if (!rapports) { indisponibles++; continue; }
    if (dryRun) { ecrits++; continue; }
    const a = Array.isArray(c.arrivees) ? c.arrivees[0] : c.arrivees;
    const { error: e } = await supabase
      .from("arrivees")
      .update({ rapports_pmu: rapports })
      .eq("id", (a as { id: string }).id)
      .is("rapports_pmu", null);
    if (e) { echecs++; console.warn(`[pmu-rapports] ${c.date_course} R${c.numero_reunion}C${c.numero_course} : ${e.message}`); }
    else ecrits++;
  }

  return { depuis: opts.depuis, jusqua, portee, candidates: candidates.length, ecrits, indisponibles, echecs, dry_run: dryRun };
}
