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
import type { CombinaisonPayee, RapportsPMU, SourceRapports } from "./geny-rapports-parser";
import { cleRC, concordeAvecPmu, fetchPmuArriveesDuJour, isoVersDdmmyyyy, type ArriveeRangee } from "./pmu-arrivees";

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

/**
 * Libellé PMU réduit à sa nature : « e-Quinté+ Ordre » → « ordre »,
 * « e-Tiercé Désordre » → « désordre », « e-Simple Gagnant » → « simple gagnant ».
 * Les variantes gardent leur suffixe (« ordre + e-tirelire », « 1 np »).
 */
function nature(libelle: string | undefined): string {
  return String(libelle || "")
    .trim()
    .replace(/^e-/i, "")
    .toLowerCase()
    .replace(/^(tiercé|quarté\+|quinté\+)\s*/, "")
    .trim();
}

/**
 * Rapport « Ordre » ou « Désordre » d'un Tiercé / Quarté+ / Quinté+, au libellé
 * exact. Le PMU liste parfois « Quinté+ Ordre + e-Tirelire » AVANT l'ordre
 * simple, et `/ordre/` le prenait : à Deauville (30/08/2026), 2 × 6 070,60 €
 * au lieu de 2 × 2 297,10 €.
 */
function trouverOrdre(rapports: RapportBrut[], cible: "ordre" | "désordre"): RapportBrut | undefined {
  for (let i = 0; i < rapports.length; i++) if (nature(rapports[i].libelle) === cible) return rapports[i];
  return undefined;
}

// ── Ex æquo : toutes les combinaisons payées (08/10/2026) ─────────────────────

const PARIS_PRINCIPAUX: Record<string, CombinaisonPayee["pari"]> = {
  SIMPLE_GAGNANT: "SIMPLE_GAGNANT",
  SIMPLE_PLACE: "SIMPLE_PLACE",
  COUPLE_GAGNANT: "COUPLE_GAGNANT",
  COUPLE_PLACE: "COUPLE_PLACE",
  TRIO: "TRIO",
  TIERCE: "TIERCE",
  QUARTE_PLUS: "QUARTE_PLUS",
  QUINTE_PLUS: "QUINTE_PLUS",
};

/** Nature de la ligne principale des paris sans ordre ni désordre. */
const NATURE_SIMPLE: Record<string, string> = {
  SIMPLE_GAGNANT: "simple gagnant",
  SIMPLE_PLACE: "simple placé",
  COUPLE_GAGNANT: "couplé gagnant",
  COUPLE_PLACE: "couplé placé",
  TRIO: "trio",
};

/**
 * PUR : toutes les lignes payées des paris dont la combinaison dépend de
 * l'arrivée (simples, couplés, trio, ordre et désordre des Tiercé, Quarté+,
 * Quinté+), pour une source. Bonus, multi, 2 sur 4, variantes « NP » et
 * Tirelire sont écartés. Unités de `RapportsPMU` : Quinté+ pour 2 €.
 */
export function lignesPrincipales(json: unknown, source: SourceRapports): CombinaisonPayee[] {
  if (!Array.isArray(json)) return [];
  const out: CombinaisonPayee[] = [];
  for (const p of json as PariBrut[]) {
    const brut = String((p && p.typePari) || "");
    const internet = brut.indexOf("E_") === 0;
    if (internet !== (source === "internet")) continue;
    const pari = PARIS_PRINCIPAUX[internet ? brut.slice(2) : brut];
    if (!pari || !Array.isArray(p.rapports)) continue;
    const mise = pari === "QUINTE_PLUS" ? 2 : 1;
    for (const r of p.rapports) {
      const n = nature(r.libelle);
      const rapport = euros(r, mise);
      const combinaison = String(r.combinaison || "").trim();
      if (rapport === undefined || !combinaison) continue;
      if (NATURE_SIMPLE[pari]) {
        if (n === NATURE_SIMPLE[pari]) out.push({ pari, combinaison, rapport });
      } else if (n === "ordre" || n === "désordre") {
        out.push({ pari, type: n === "ordre" ? "ordre" : "desordre", combinaison, rapport });
      }
    }
  }
  return out;
}

/**
 * PUR : ne garde que les paris où l'ex æquo multiplie les combinaisons payées
 * (plus d'un simple ou couplé gagnant, d'un trio, d'un ordre ou d'un désordre ;
 * plus de trois placés ou couplés placés). Ailleurs, les champs historiques
 * de `RapportsPMU` suffisent.
 */
export function combinaisonsMultiples(lignes: CombinaisonPayee[]): CombinaisonPayee[] {
  const compte: Record<string, number> = {};
  for (const l of lignes) {
    const cle = `${l.pari}|${l.type || ""}`;
    compte[cle] = (compte[cle] || 0) + 1;
  }
  const multiples: Record<string, boolean> = {};
  for (const cle of Object.keys(compte)) {
    const pari = cle.split("|")[0];
    const seuil = pari === "SIMPLE_PLACE" || pari === "COUPLE_PLACE" ? 3 : 1;
    if (compte[cle] > seuil) multiples[pari] = true;
  }
  return lignes.filter((l) => multiples[l.pari]);
}

interface Repere {
  pari: CombinaisonPayee["pari"];
  type?: "ordre" | "desordre";
  valeur: number | undefined;
}

/**
 * Montants en base qui identifient la source, en deux paliers : d'abord ordre
 * et désordre des Tiercé, Quarté+, Quinté+ (sûrs, y compris chez Geny), puis,
 * pour une course sans ces paris, les simples et couplés.
 */
function reperes(r: RapportsPMU): Repere[][] {
  const simples: Repere[] = [
    { pari: "SIMPLE_GAGNANT", valeur: r.simple_gagnant },
    { pari: "COUPLE_GAGNANT", valeur: r.couple_gagnant },
  ];
  for (const v of r.simple_place || []) simples.push({ pari: "SIMPLE_PLACE", valeur: v });
  for (const v of r.couple_place || []) simples.push({ pari: "COUPLE_PLACE", valeur: v });
  return [
    [
      { pari: "QUINTE_PLUS", type: "ordre", valeur: r.quinte_plus?.ordre },
      { pari: "QUINTE_PLUS", type: "desordre", valeur: r.quinte_plus?.desordre },
      { pari: "QUARTE_PLUS", type: "ordre", valeur: r.quarte_plus?.ordre },
      { pari: "QUARTE_PLUS", type: "desordre", valeur: r.quarte_plus?.desordre },
      { pari: "TIERCE", type: "ordre", valeur: r.tierce?.ordre },
      { pari: "TIERCE", type: "desordre", valeur: r.tierce?.desordre },
    ],
    simples,
  ];
}

/**
 * PUR : de quelle source (masse d'enjeux) viennent des rapports DÉJÀ en base ?
 * Geny donnait les prix des points de vente, l'API PMU ceux d'internet : on ne
 * mélange jamais les deux dans un même rapport. Une source concorde si au
 * moins deux de ses montants valent ceux en base et si les écarts (ex. un
 * ordre « Tirelire » mal lu) restent minoritaires. Les simples et couplés de
 * Geny ne correspondent à aucune source PMU : seuls, ils ne tranchent rien.
 * null si aucune source ne concorde.
 */
export function sourceDesRapports(
  existant: RapportsPMU,
  parSource: Partial<Record<SourceRapports, CombinaisonPayee[]>>,
): SourceRapports | null {
  const sources: SourceRapports[] = ["internet", "points_de_vente"];
  for (const palier of reperes(existant)) {
    for (const source of sources) {
      const lignes = parSource[source];
      if (!lignes || lignes.length === 0) continue;
      let accords = 0, ecarts = 0;
      for (const r of palier) {
        if (typeof r.valeur !== "number") continue;
        const memes = lignes.filter((l) => l.pari === r.pari && l.type === r.type);
        if (memes.length === 0) continue;
        if (memes.some((l) => Math.abs(l.rapport - (r.valeur as number)) < 0.011)) accords++;
        else ecarts++;
      }
      if (accords >= 2 && ecarts * 2 < accords) return source;
    }
  }
  return null;
}

/**
 * PUR : les rapports PMU de R/C sont-ils ceux de notre course ? La numérotation
 * des réunions en base diffère parfois de celle du PMU (07/06/2026 : Strasbourg,
 * Rambouillet et Dax notées « R9 » en base, R12/R11/R10 au PMU) : nos R/C
 * peuvent désigner une AUTRE course. On compare nos 3 premiers à l'arrivée
 * définitive du PMU au même R/C (deux ex æquo pouvant être inversés). Programme
 * PMU indisponible (Map vide) ≠ « autre course » : on ne conclut rien.
 */
export function identiteCourse(
  arrivee: number[] | null | undefined,
  R: number,
  C: number,
  arriveesPmu: Map<string, ArriveeRangee>,
): "ok" | "autre_course" | "pmu_indisponible" {
  if (arriveesPmu.size === 0) return "pmu_indisponible";
  const off = arriveesPmu.get(cleRC(R, C));
  if (!off || !Array.isArray(arrivee)) return "autre_course";
  return concordeAvecPmu(arrivee.slice(0, 3), off) ? "ok" : "autre_course";
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
      ordre: euros(trouverOrdre(quinte, "ordre"), 2),
      desordre: euros(trouverOrdre(quinte, "désordre"), 2),
      bonus4: euros(trouver(quinte, /bonus\s*4/i), 2),
      bonus3: euros(trouver(quinte, /bonus\s*3/i), 2),
    };
    if (q.ordre !== undefined || q.desordre !== undefined) out.quinte_plus = q;
  }

  const quarte = parType["E_QUARTE_PLUS"];
  if (quarte) {
    const q = {
      ordre: euros(trouverOrdre(quarte, "ordre")),
      desordre: euros(trouverOrdre(quarte, "désordre")),
      bonus: euros(trouver(quarte, /bonus/i)),
    };
    if (q.ordre !== undefined || q.desordre !== undefined) out.quarte_plus = q;
  }

  const tierce = parType["E_TIERCE"];
  if (tierce) {
    const t = { ordre: euros(trouverOrdre(tierce, "ordre")), desordre: euros(trouverOrdre(tierce, "désordre")) };
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

  if (Object.keys(out).length === 0) return null;
  // Ex æquo : les autres combinaisons payées ([] = vérifié, aucune).
  out.combinaisons = { source: "internet", lignes: combinaisonsMultiples(lignesPrincipales(json, "internet")) };
  return out;
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
export async function fetchRapportsDefinitifs(
  dateISO: string,
  R: number,
  C: number,
  timeoutMs = 15000,
  /** « points_de_vente » : les prix des points de vente, ceux que donnait Geny. */
  source: SourceRapports = "internet",
): Promise<unknown | null> {
  return (await fetchRapportsDefinitifsAvecStatut(dateISO, R, C, timeoutMs, source)).json;
}

/**
 * Comme fetchRapportsDefinitifs, en disant pourquoi il n'y a rien : `absent`
 * quand le PMU répond 204 — aucun rapport pour cette masse d'enjeux (course
 * régionale jouée en points de vente seulement). Sinon : panne, ou course pas
 * encore officialisée.
 */
export async function fetchRapportsDefinitifsAvecStatut(
  dateISO: string,
  R: number,
  C: number,
  timeoutMs = 15000,
  source: SourceRapports = "internet",
): Promise<{ json: unknown | null; absent: boolean }> {
  const specialisation = source === "internet" ? "INTERNET" : "OFFLINE";
  const chemin = `/rest/client/1/programme/${isoVersDdmmyyyy(dateISO)}/R${R}/C${C}/rapports-definitifs?specialisation=${specialisation}`;
  let absent = false;
  for (const base of [PMU_PROXY, PMU_DIRECT]) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(base + chemin, { headers: PMU_HEADERS, cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 204) { absent = true; continue; }
      if (!res.ok) continue;
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) return { json, absent: false };
    } catch {
      clearTimeout(timer);
      /* base suivante */
    }
  }
  return { json: null, absent };
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
  /** Seulement les courses avec ex æquo (rangs en base) : rattrapage de l'historique. */
  exAequoSeulement?: boolean;
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
  /** Arrivée différente au même R/C chez le PMU (cf. identiteCourse) : rien d'écrit. */
  autres_courses: number;
  /** Ex æquo : rapports déjà en base complétés de leurs combinaisons (montants inchangés). */
  combinaisons_ajoutees: number;
  /** Ex æquo : rapports en base dont aucune source PMU ne retrouve les montants (Geny) — non touchés. */
  sources_inconnues: number;
  /** Ex æquo : courses où le PMU paie effectivement plusieurs combinaisons. */
  avec_plusieurs_combinaisons: number;
}

interface CourseCandidate {
  id: string;
  date_course: string;
  numero_reunion: number | null;
  numero_course: number | null;
  nationale: number | null;
  paris_disponibles: string[] | null;
  arrivee_officielle: number[] | null;
  /** Rangs officiels (ex æquo), NULL = ordre strict — cf. lib/courses/rangs. */
  arrivee_rangs?: number[] | null;
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
  return portee === "toutes" || estQuinte(c);
}

function estQuinte(c: CourseCandidate): boolean {
  const quintePlus = Array.isArray(c.paris_disponibles) && c.paris_disponibles.indexOf("QUINTE_PLUS") !== -1;
  return c.nationale === 1 || quintePlus;
}

function aDesRangs(c: CourseCandidate): boolean {
  return Array.isArray(c.arrivee_rangs) && c.arrivee_rangs.length > 0;
}

/**
 * Course française avec ex æquo (rangs en base) dont les rapports, déjà en
 * base, n'ont pas encore leurs combinaisons multiples. On leur AJOUTE la clé
 * `combinaisons`, sans toucher aux montants existants. PUR (testé).
 */
export function aCompleterCombinaisons(c: CourseCandidate): boolean {
  const h = Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome;
  if (!h || h.pays !== "France") return false;
  if (!aDesRangs(c)) return false;
  if (!c.numero_reunion || !c.numero_course) return false;
  const a = Array.isArray(c.arrivees) ? c.arrivees[0] : c.arrivees;
  if (!a || a.rapports_pmu == null || typeof a.rapports_pmu !== "object") return false;
  return !("combinaisons" in (a.rapports_pmu as Record<string, unknown>));
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

  // Lecture PAR PAGES : la base renvoie au plus 1 000 lignes par requête. Le
  // 02/10/2026, un remplissage sur 30 jours (≈ 1 400 courses) a ainsi perdu
  // EN SILENCE ses derniers jours (30/09 et 01/10). Ordre stable (date, id)
  // pour qu'aucune ligne ne saute ni ne double d'une page à l'autre.
  const PAGE = 1000;
  const lues: CourseCandidate[] = [];
  for (let debut = 0; ; debut += PAGE) {
    let requete = supabase
      .from("courses")
      .select("id, date_course, numero_reunion, numero_course, nationale, paris_disponibles, arrivee_officielle, arrivee_rangs, hippodrome:hippodromes(pays), arrivees(id, rapports_pmu)")
      .gte("date_course", opts.depuis)
      .lte("date_course", jusqua)
      .not("arrivee_officielle", "is", null);
    // Portée Quinté+ : filtre aussi côté base (moins de lignes à lire) ; le
    // verdict reste celui d'estCandidate.
    if (portee === "quinte") requete = requete.or("nationale.eq.1,paris_disponibles.cs.{QUINTE_PLUS}");
    const { data, error } = await requete
      .order("date_course", { ascending: true })
      .order("id", { ascending: true })
      .range(debut, debut + PAGE - 1);
    if (error) throw new Error(`lecture des courses : ${error.message}`);
    const page = (data ?? []) as unknown as CourseCandidate[];
    for (let i = 0; i < page.length; i++) lues.push(page[i]);
    if (page.length < PAGE) break;
  }

  const exAequo = opts.exAequoSeulement === true;
  let candidates = lues.filter((c) => estCandidate(c, portee) && (!exAequo || aDesRangs(c)));
  // Ex æquo : rapports déjà en base, à compléter de leurs combinaisons.
  let aCompleter = lues.filter((c) => aCompleterCombinaisons(c) && (portee === "toutes" || estQuinte(c)));
  if (opts.limite && opts.limite > 0) {
    candidates = candidates.slice(0, opts.limite);
    aCompleter = aCompleter.slice(0, Math.max(0, opts.limite - candidates.length));
  }

  // Arrivées définitives PMU, un appel par jour : garde-fou d'identité.
  const arriveesParJour = new Map<string, Map<string, ArriveeRangee>>();
  const arriveesDuJour = async (date: string): Promise<Map<string, ArriveeRangee>> => {
    let m = arriveesParJour.get(date);
    if (!m) { m = await fetchPmuArriveesDuJour(date); arriveesParJour.set(date, m); }
    return m;
  };

  let ecrits = 0, indisponibles = 0, echecs = 0, avecPlusieurs = 0, autresCourses = 0;
  for (const c of candidates) {
    const R = c.numero_reunion as number, C = c.numero_course as number;
    const identite = identiteCourse(c.arrivee_officielle, R, C, await arriveesDuJour(c.date_course));
    if (identite === "pmu_indisponible") { indisponibles++; continue; }
    if (identite === "autre_course") {
      autresCourses++;
      console.warn(`[pmu-rapports] ${c.date_course} R${R}C${C} : arrivée différente au PMU, rapports non écrits`);
      continue;
    }
    const brut = await fetchRapportsDefinitifs(c.date_course, R, C);
    const rapports = brut ? parseRapportsDefinitifs(brut, c.arrivee_officielle || []) : null;
    if (!rapports) { indisponibles++; continue; }
    if (rapports.combinaisons && rapports.combinaisons.lignes.length > 0) avecPlusieurs++;
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

  // Les montants en base ne sont JAMAIS réécrits : on ajoute seulement la clé
  // `combinaisons`, prise dans la même source (masse d'enjeux) qu'eux.
  let combinaisonsAjoutees = 0, sourcesInconnues = 0;
  for (const c of aCompleter) {
    const a = (Array.isArray(c.arrivees) ? c.arrivees[0] : c.arrivees) as { id: string; rapports_pmu: unknown };
    const existant = a.rapports_pmu as RapportsPMU;
    const R = c.numero_reunion as number;
    const C = c.numero_course as number;
    const parSource: Partial<Record<SourceRapports, CombinaisonPayee[]>> = {};
    const internet = await fetchRapportsDefinitifs(c.date_course, R, C);
    if (internet) parSource.internet = lignesPrincipales(internet, "internet");
    let source = sourceDesRapports(existant, parSource);
    if (!source) {
      const pdv = await fetchRapportsDefinitifs(c.date_course, R, C, 15000, "points_de_vente");
      if (pdv) parSource.points_de_vente = lignesPrincipales(pdv, "points_de_vente");
      source = sourceDesRapports(existant, parSource);
    }
    if (!parSource.internet && !parSource.points_de_vente) { indisponibles++; continue; }
    if (!source) { sourcesInconnues++; continue; }
    const lignes = combinaisonsMultiples(parSource[source] as CombinaisonPayee[]);
    if (lignes.length > 0) avecPlusieurs++;
    if (dryRun) { combinaisonsAjoutees++; continue; }
    const { data: touchees, error: e } = await supabase
      .from("arrivees")
      .update({ rapports_pmu: { ...existant, combinaisons: { source, lignes } } })
      .eq("id", a.id)
      .not("rapports_pmu", "is", null)
      .select("id");
    if (e || !touchees || touchees.length === 0) {
      echecs++;
      console.warn(`[pmu-rapports] combinaisons ${c.date_course} R${R}C${C} : ${e ? e.message : "aucune ligne modifiée"}`);
    } else combinaisonsAjoutees++;
  }

  return {
    depuis: opts.depuis, jusqua, portee, candidates: candidates.length + aCompleter.length, ecrits, indisponibles, echecs, dry_run: dryRun,
    autres_courses: autresCourses,
    combinaisons_ajoutees: combinaisonsAjoutees, sources_inconnues: sourcesInconnues, avec_plusieurs_combinaisons: avecPlusieurs,
  };
}
