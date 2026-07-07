/**
 * lib/cotes/pmu-csv.ts
 *
 * Source de COTES PMU officielles via un CSV public Google Sheets, alimenté par
 * un Google Apps Script (IP Google, NON bloquée par PMU/Geny contrairement aux
 * IP datacenter Cloudflare/Azure d'Elite). Rafraîchi chaque heure, il couvre
 * toutes les courses du programme PMU du jour (~40 courses).
 *
 * Ce sont des rapports pari-mutuel unifiés (Masse Commune Internationale) →
 * identiques LONACI/LONASE → justes pour le public africain.
 *
 * PUR (fetch global, aucun import next/headers) → bundlable Node (GitHub Actions)
 * ET utilisable côté Worker (Google ne bloque pas le Worker).
 *
 * Colonnes CSV : date,reunion,course,hippodrome,course_nom,discipline,heure,
 *   num,cheval,statut,cote_reference,cote_directe,favori,source,maj
 * Notes : reunion="R1", course="C8" (préfixes) ; cotes en décimal VIRGULE et
 *   entre guillemets quand elles contiennent la virgule ("9,8") ; statut=NP =
 *   non-partant (cotes vides).
 */

const DEFAULT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSy_qcQdWP6smW5vrxvZi5oJPcLLzg78_hH5ke2aZBhfeGwPT1P7r-0b1LoZAh_dyJvtEPi-bso9BA9/pub?gid=2124698538&single=true&output=csv";

/** URL du CSV (surchargée par PMU_COTES_CSV_URL si besoin). */
export function pmuCotesCsvUrl(): string {
  return process.env.PMU_COTES_CSV_URL || DEFAULT_CSV_URL;
}

export interface PmuCoteRow {
  date:           string;  // "AAAA-MM-JJ" (jour du programme PMU)
  reunion:        number;  // "R1" -> 1
  course:         number;  // "C8" -> 8
  num:            number;  // dossard
  cheval:         string;  // nom (MAJUSCULES dans le CSV)
  statut:         string;  // "PARTANT" | "NP" | ...
  coteDirecte?:   number;  // cote live (rafraîchie chaque heure) — PRIORITAIRE
  coteReference?: number;  // cote de référence (repli)
  nonPartant:     boolean;
}

/** Découpe une ligne CSV en respectant les guillemets (virgule décimale à l'intérieur). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // guillemet échappé ""
        else inQ = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Cote décimale FR ("9,8") ou entière ("16") -> number ; vide/0/négatif -> undefined. */
export function toCote(raw: string | undefined): number | undefined {
  const s = (raw || "").trim().replace(/^"|"$/g, "").replace(",", ".");
  if (!s) return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Extrait le 1er entier d'un token (« R1 » -> 1, « C8 » -> 8). */
function toIntLoose(raw: string | undefined): number {
  const m = (raw || "").match(/\d+/);
  return m ? parseInt(m[0], 10) : NaN;
}

/**
 * Parse le CSV PMU -> lignes typées. PURE (testable). Ignore les lignes
 * inexploitables (réunion/course/num non numériques). Robuste à l'ordre des
 * colonnes (indexé par en-tête).
 */
export function parsePmuCotesCsv(csv: string): PmuCoteRow[] {
  const lines = (csv || "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iDate = col("date"),
        iR = col("reunion"), iC = col("course"), iN = col("num"),
        iCh = col("cheval"), iS = col("statut"),
        iRef = col("cote_reference"), iDir = col("cote_directe");
  if (iR < 0 || iC < 0 || iN < 0) return [];

  const out: PmuCoteRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i]);
    const reunion = toIntLoose(c[iR]);
    const course = toIntLoose(c[iC]);
    const num = toIntLoose(c[iN]);
    if (!Number.isFinite(reunion) || !Number.isFinite(course) || !Number.isFinite(num)) continue;

    const statut = (c[iS] || "").trim().toUpperCase();
    out.push({
      date:          iDate >= 0 ? (c[iDate] || "").trim() : "",
      reunion, course, num,
      cheval:        (c[iCh] || "").trim(),
      statut,
      coteDirecte:   toCote(c[iDir]),
      coteReference: toCote(c[iRef]),
      nonPartant:    /^NON[- ]?PARTANT$|^NP$/.test(statut),
    });
  }
  return out;
}

/**
 * Cote retenue pour une ligne : directe (rafraîchie) en priorité, sinon la
 * référence. NULL si non-partant ou aucune cote (JAMAIS de valeur inventée).
 */
export function resolvePmuCote(row: PmuCoteRow): number | null {
  if (row.nonPartant) return null;
  return row.coteDirecte ?? row.coteReference ?? null;
}

/** Nom de cheval normalisé (sans accents/ponctuation, MAJUSCULES) pour matcher. */
export function normalizeHorseName(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Garde-fou anti-décalage : le même dossard (num) désigne-t-il bien le même
 * cheval des deux côtés (CSV PMU vs partant en base) ? Tolère troncature/variante.
 * Un nom manquant ne bloque pas (on fait confiance au num).
 */
export function sameHorse(a: string, b: string): boolean {
  const na = normalizeHorseName(a);
  const nb = normalizeHorseName(b);
  if (!na || !nb) return true;
  if (na === nb) return true;
  const short = na.length <= nb.length ? na : nb;
  const long = na.length <= nb.length ? nb : na;
  return short.length >= 4 && long.includes(short);
}

/**
 * Récupère le CSV PMU -> map `${reunion}|${course}|${num}` -> ligne. Une seule
 * requête. Ne throw jamais (map vide si KO).
 *
 * @param dateISO Si fourni ("AAAA-MM-JJ"), ne garde QUE les lignes de ce jour →
 *   garantit qu'on n'applique jamais les cotes d'un autre jour (les numéros
 *   R1C8… se répètent chaque jour). Une course d'un jour absent du CSV (ex. J+1,
 *   cotes pas encore ouvertes) donne une map vide → repli LONACI, pas d'erreur.
 */
export async function fetchPmuCotesMap(dateISO?: string): Promise<Map<string, PmuCoteRow>> {
  const map = new Map<string, PmuCoteRow>();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(pmuCotesCsvUrl(), { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return map;
    const rows = parsePmuCotesCsv(await res.text());
    for (const r of rows) {
      if (dateISO && r.date && r.date !== dateISO) continue; // seulement le jour ciblé
      map.set(`${r.reunion}|${r.course}|${r.num}`, r);
    }
  } catch {
    // Google KO / timeout -> pas de cotes PMU (map vide, l'appelant retombe sur LONACI)
  }
  return map;
}
