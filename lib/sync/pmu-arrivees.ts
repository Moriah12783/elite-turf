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

/**
 * `ordreArrivee` PMU est un tableau de RANGS, chaque rang étant lui-même un
 * tableau : `[[12],[13],[7]]`. Un rang à plusieurs éléments = ex æquo (dead
 * heat), cas rare mais réel — on aplatit en préservant l'ordre d'arrivée.
 */
export function aplatirOrdreArrivee(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const rang of raw) {
    const items = Array.isArray(rang) ? rang : [rang];
    for (const n of items) {
      const v = Number(n);
      if (Number.isFinite(v) && v > 0) out.push(v);
    }
  }
  return out;
}

/** "2026-07-27" → "27072026" (format exigé par /programme/{date}). */
export function isoVersDdmmyyyy(iso: string): string {
  const m = String(iso == null ? "" : iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Date ISO invalide : ${iso}`);
  return `${m[3]}${m[2]}${m[1]}`;
}

export interface ArriveePmu {
  reunion:    number;
  course:     number;
  arrivee:    number[];
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

      const arrivee = aplatirOrdreArrivee(c?.ordreArrivee);
      if (arrivee.length < 3) continue;   // trop court pour être exploitable

      out.push({ reunion: numR, course: numC, arrivee, definitive: true });
    }
  }
  return out;
}

/** Clé d'indexation réunion/course, unique pour une journée donnée. */
export function cleRC(reunion: number, course: number): string {
  return `${reunion}|${course}`;
}

/**
 * Récupère les arrivées définitives du jour. Un seul appel réseau.
 * Renvoie une Map indexée par `R|C`. Map VIDE si l'API est indisponible —
 * l'appelant NE DOIT PAS interpréter cela comme « aucune arrivée ».
 */
export async function fetchPmuArriveesDuJour(dateISO: string, timeoutMs = 15000): Promise<Map<string, number[]>> {
  const d = isoVersDdmmyyyy(dateISO);
  const urls = [
    `${PMU_PROXY}/rest/client/61/programme/${d}`,
    `${PMU_DIRECT}/rest/client/61/programme/${d}`,
    `${PMU_PROXY}/rest/client/1/programme/${d}`,
  ];

  for (const url of urls) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: PMU_HEADERS, cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = await res.json();
      const rows = parseArriveesProgramme(json);
      if (rows.length > 0) {
        const map = new Map<string, number[]>();
        for (const r of rows) map.set(cleRC(r.reunion, r.course), r.arrivee);
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
