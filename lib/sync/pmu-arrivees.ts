/**
 * lib/sync/pmu-arrivees.ts
 *
 * Arrivées officielles depuis l'API PMU — SOURCE FAISANT AUTORITÉ.
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * `geny-arrivees.ts` scrape une page Geny par course et appelle `parseArrivee`
 * SANS jamais vérifier que la page reçue correspond à la course demandée. Quand
 * Geny sert une page générique — ce qu'il fait volontiers depuis qu'il bloque
 * nos IP — le parseur en extrait l'arrivée qui s'y trouve et l'écrit telle
 * quelle. Constaté le 27/07/2026 : **une même arrivée sur 18 courses de 5
 * hippodromes différents**, et 134 courses contaminées sur 19 jours.
 *
 * Le filtre `validNumbers` ne rattrape rien : une arrivée comme 2-8-1-7-3-5 ne
 * contient que des petits dossards, valides dans presque toutes les courses.
 *
 * ICI, L'AMBIGUÏTÉ EST IMPOSSIBLE : l'API PMU renvoie l'arrivée indexée par
 * réunion/course. Aucun appariement heuristique, aucun scraping.
 *
 * ⚠️ ENDPOINTS — vérifié le 27/07/2026 :
 *   - `/programmeComplet/{YYYYMMDD}`  → **420** (bloqué) : c'est celui
 *     qu'utilise `fetchPmuProgramme`, d'où sa défaillance silencieuse.
 *   - `/programme/{DDMMYYYY}`         → **200**, et porte déjà `ordreArrivee`
 *     + `statut` pour CHAQUE course. Un seul appel couvre toute la journée.
 */

import { couperParRang, rangsAStocker, rangsEffectifs } from "../courses/rangs";

const PMU_DIRECT = "https://online.turfinfo.api.pmu.fr";
const PMU_PROXY  = (process.env.PMU_PROXY_URL || "https://pmu-proxy.manuel-conti2008.workers.dev").replace(/\/$/, "");

const PMU_HEADERS = {
  "Accept":          "application/json, text/plain, */*",
  "Accept-Language": "fr-FR,fr;q=0.9",
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Referer":         "https://www.pmu.fr/",
  "Origin":          "https://www.pmu.fr",
};

/**
 * Seuls ces statuts garantissent une arrivée DÉFINITIVE.
 * Une arrivée provisoire peut encore changer (réclamation, disqualification) :
 * l'écrire puis la laisser figée reproduirait le défaut qu'on corrige.
 */
export const STATUTS_DEFINITIFS = ["ARRIVEE_DEFINITIVE", "ARRIVEE_DEFINITIVE_COMPLETE"];

export function estArriveeDefinitive(statut: unknown, isDefinitive?: unknown): boolean {
  if (isDefinitive === true) return true;
  const s = String(statut == null ? "" : statut).toUpperCase();
  return STATUTS_DEFINITIFS.indexOf(s) !== -1;
}

export interface ArriveeRangee {
  arrivee: number[];
  /** Rang officiel de chaque cheval de `arrivee` : `[1,2,3,4,5,5,7]` (cf. lib/courses/rangs). */
  rangs: number[];
}

/**
 * `ordreArrivee` PMU est un tableau de RANGS, chaque rang étant lui-même un
 * tableau : `[[12],[13],[7]]`. Un rang à plusieurs éléments = ex æquo (dead
 * heat) : `[[1],[5],[8],[4],[15,16],[10]]` → 15 et 16 sont 5es, le 10 est 7e.
 * L'arrivée est aplatie dans l'ordre, et le rang de chaque cheval est gardé à
 * côté — l'aplatir seul faisait passer le 16 pour 6e (constat du 08/10/2026).
 */
export function lireOrdreArrivee(raw: unknown): ArriveeRangee {
  const out: ArriveeRangee = { arrivee: [], rangs: [] };
  if (!Array.isArray(raw)) return out;
  for (const groupe of raw) {
    const items = Array.isArray(groupe) ? groupe : [groupe];
    const rang = out.arrivee.length + 1;
    for (const n of items) {
      const v = Number(n);
      if (Number.isFinite(v) && v > 0) {
        out.arrivee.push(v);
        out.rangs.push(rang);
      }
    }
  }
  return out;
}

/** L'arrivée seule, aplatie dans l'ordre (sans les rangs). */
export function aplatirOrdreArrivee(raw: unknown): number[] {
  return lireOrdreArrivee(raw).arrivee;
}

/** "2026-07-27" → "27072026" (format exigé par /programme/{date}). */
export function isoVersDdmmyyyy(iso: string): string {
  const m = String(iso == null ? "" : iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Date ISO invalide : ${iso}`);
  return `${m[3]}${m[2]}${m[1]}`;
}

export interface ArriveePmu extends ArriveeRangee {
  reunion:    number;
  course:     number;
  definitive: boolean;
}

/**
 * Extrait les arrivées d'un payload `/programme/{DDMMYYYY}`. PUR — testable
 * sans réseau. Ne retient QUE les arrivées définitives et non vides.
 */
export function parseArriveesProgramme(json: unknown): ArriveePmu[] {
  const prog = json as { programme?: { reunions?: unknown[] } } | null;
  const reunions = prog && prog.programme ? prog.programme.reunions : null;
  if (!Array.isArray(reunions)) return [];

  const out: ArriveePmu[] = [];
  for (const r of reunions as any[]) {
    // numOfficiel est le numéro affiché (R1, R2…) ; numOrdre peut différer.
    const numR = Number(r?.numOfficiel ?? r?.numExterne ?? r?.numOrdre);
    if (!Number.isFinite(numR)) continue;

    const courses = Array.isArray(r?.courses) ? r.courses : [];
    for (const c of courses as any[]) {
      const numC = Number(c?.numOrdre ?? c?.numExterne);
      if (!Number.isFinite(numC)) continue;
      if (!estArriveeDefinitive(c?.statut, c?.isArriveeDefinitive)) continue;

      const { arrivee, rangs } = lireOrdreArrivee(c?.ordreArrivee);
      if (arrivee.length < 3) continue;   // trop court pour être exploitable

      out.push({ reunion: numR, course: numC, arrivee, rangs, definitive: true });
    }
  }
  return out;
}

/** Clé d'indexation réunion/course, unique pour une journée donnée. */
export function cleRC(reunion: number, course: number): string {
  return `${reunion}|${course}`;
}

/** Cascade d'URL du programme du jour : proxy d'abord (l'IP du Worker est bloquée en direct). */
function urlsProgramme(dateISO: string): string[] {
  const d = isoVersDdmmyyyy(dateISO);
  return [
    `${PMU_PROXY}/rest/client/61/programme/${d}`,
    `${PMU_DIRECT}/rest/client/61/programme/${d}`,
    `${PMU_PROXY}/rest/client/1/programme/${d}`,
  ];
}

/**
 * Programme PMU BRUT du jour (arrivées, statuts, heures de départ). null si
 * l'API est indisponible : l'appelant NE DOIT PAS en conclure « aucune course ».
 */
export async function fetchProgrammeDuJour(dateISO: string, timeoutMs = 15000): Promise<unknown | null> {
  for (const url of urlsProgramme(dateISO)) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: PMU_HEADERS, cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = (await res.json()) as { programme?: { reunions?: unknown[] } } | null;
      const reunions = json && json.programme ? json.programme.reunions : null;
      if (Array.isArray(reunions) && reunions.length > 0) return json;
    } catch {
      clearTimeout(timer);
      /* URL suivante */
    }
  }
  return null;
}

/**
 * Récupère les arrivées définitives du jour. Un seul appel réseau.
 * Renvoie une Map indexée par `R|C`. Map VIDE si l'API est indisponible —
 * l'appelant NE DOIT PAS interpréter cela comme « aucune arrivée ».
 */
export async function fetchPmuArriveesDuJour(dateISO: string, timeoutMs = 15000): Promise<Map<string, ArriveeRangee>> {
  for (const url of urlsProgramme(dateISO)) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: PMU_HEADERS, cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = await res.json();
      const rows = parseArriveesProgramme(json);
      if (rows.length > 0) {
        const map = new Map<string, ArriveeRangee>();
        for (const r of rows) map.set(cleRC(r.reunion, r.course), { arrivee: r.arrivee, rangs: r.rangs });
        return map;
      }
    } catch {
      clearTimeout(timer);
      /* URL suivante */
    }
  }
  return new Map();
}

/**
 * Cap du nombre de chevaux retenus, aligné sur `geny-arrivees` :
 * Quinté+ = 7 (Bonus 3), sinon 6.
 */
export function capPourParis(paris: string[] | null | undefined): number {
  const p = Array.isArray(paris) ? paris : [];
  for (const x of p) {
    if (String(x).toUpperCase().indexOf("QUINTE") !== -1) return 7;
  }
  return 6;
}

/**
 * Ce qu'on écrit en base d'une arrivée PMU : les chevaux classés jusqu'au rang
 * `cap` (un ex æquo au rang du cap est gardé en entier) et leurs rangs — NULL
 * sans ex æquo, comme tout l'historique (cf. lib/courses/rangs).
 */
export function arriveeARetenir(
  off: ArriveeRangee,
  cap: number,
): { arrivee: number[]; rangs: number[] | null } {
  const coupee = couperParRang(off.arrivee, off.rangs, cap);
  return { arrivee: coupee.arrivee, rangs: rangsAStocker(coupee.rangs) };
}

/**
 * Rangs à poser sur une arrivée DÉJÀ en base (backfill), d'après l'arrivée PMU.
 * Garde-fou d'identité : chaque cheval de la base doit être au PMU au rang de
 * sa place (deux ex æquo peuvent être dans l'autre ordre). Sinon ce n'est pas
 * la même arrivée → null, on n'écrit rien. null aussi sans ex æquo dans la
 * partie enregistrée : NULL en base veut déjà dire « ordre strict ».
 */
export function rangsPourArriveeEnBase(
  base: number[] | null | undefined,
  off: ArriveeRangee,
): number[] | null {
  if (!Array.isArray(base) || !concordeAvecPmu(base, off)) return null;
  const r = rangsEffectifs(off.arrivee, off.rangs);
  const out: number[] = [];
  for (let i = 0; i < base.length; i++) out.push(r[off.arrivee.indexOf(base[i])]);
  return rangsAStocker(out);
}

/** L'arrivée en base est-elle celle du PMU (au rang près, deux ex æquo pouvant être inversés) ? */
export function concordeAvecPmu(base: number[], off: ArriveeRangee): boolean {
  if (base.length < 3 || base.length > off.arrivee.length) return false;
  const r = rangsEffectifs(off.arrivee, off.rangs);
  for (let i = 0; i < base.length; i++) {
    const j = off.arrivee.indexOf(base[i]);
    if (j === -1 || r[j] !== r[i]) return false;
  }
  return true;
}

export interface CourseACorriger {
  id:                 string;
  numero_reunion:     number;
  numero_course:      number;
  paris_disponibles:  string[] | null;
  arrivee_officielle: number[] | null;
}

export interface DiffArrivee {
  id:        string;
  avant:     number[] | null;
  apres:     number[];
  identique: boolean;
}

/**
 * Compare les arrivées en base à celles de PMU et calcule les corrections.
 * PUR : aucune I/O, l'appelant décide d'écrire ou non (mode audit possible).
 * Une course absente de la Map PMU est IGNORÉE — jamais effacée.
 */
export function calculerCorrections(
  courses: CourseACorriger[],
  arriveesPmu: Map<string, number[]>,
): DiffArrivee[] {
  const out: DiffArrivee[] = [];
  for (const c of courses) {
    const officielle = arriveesPmu.get(cleRC(c.numero_reunion, c.numero_course));
    if (!officielle || officielle.length < 3) continue;

    const apres = officielle.slice(0, capPourParis(c.paris_disponibles));
    const avant = Array.isArray(c.arrivee_officielle) ? c.arrivee_officielle : null;
    const identique = avant != null
      && avant.length === apres.length
      && avant.every((n, i) => n === apres[i]);

    out.push({ id: c.id, avant, apres, identique });
  }
  return out;
}
