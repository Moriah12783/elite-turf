/**
 * lib/sync/geny-rapports-backfill.ts
 *
 * Backfill ONE-SHOT des rapports PMU déjà stockés en base.
 *
 * Pourquoi : le fix du parser (`geny-rapports-parser.ts`, 2026-06-29) corrige
 * l'EXTRACTION, mais les lignes `arrivees.rapports_pmu` déjà écrites gardent
 * leurs valeurs erronées (Quinté+ désordre fabriqué ≈ 5 € de médiane, blocs
 * quinte_plus inventés sur des courses sans Quinté+). Le sync quotidien
 * `runGenyArriveesSync` ne les retouche pas : il ne traite que les courses
 * NON encore terminées (`arrivee_officielle IS NULL`).
 *
 * Ce module re-fetch la page arrivée Geny, re-parse avec le NOUVEAU parser, et
 * UPDATE `rapports_pmu` (+ `commentaire`) des lignes `arrivees` existantes.
 * Il ne touche JAMAIS `ordre_arrivee` (l'arrivée elle-même n'est pas en cause).
 *
 * ⚠️ À exécuter sur GitHub Actions : Geny renvoie 403 à l'IP du Worker
 * Cloudflare (cf. lib/sync/geny-arrivees.ts). L'IP Azure des runners passe.
 *
 * Scopes :
 *   - "quinte" (défaut) : courses dont `paris_disponibles` contient QUINTE_PLUS
 *     → corrige les vrais Quinté+ (ce que lit le ROI du banc de mesure). Borné.
 *   - "all" : toutes les courses terminées avec `geny_url` → assainit AUSSI les
 *     blocs quinte_plus fabriqués sur les non-Quinté+ (hygiène complète, plus long).
 */

import { createServiceClient } from "@/lib/supabase/service-client";
import { buildGenyUrlFromStored } from "@/lib/geny";
import { parseRapportsPMU, parseCommentaire } from "@/lib/sync/geny-rapports-parser";

const GENY_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5",
  Referer: "https://www.geny.com/",
};
const FETCH_TIMEOUT_MS = 10000;
const CONCURRENCY = 3;                 // poli : l'IP runner peut être 429 sous charge
const BACKOFF_MS = [5000, 15000, 30000];

export type BackfillScope = "quinte" | "all";

export interface RapportsBackfillOptions {
  scope?: BackfillScope;
  since?: string | null;   // borne basse sur date_course (ISO "YYYY-MM-DD")
  limit?: number | null;   // plafond du nombre de courses traitées
  dryRun?: boolean;        // ne pas écrire, seulement rapporter
}

export interface RapportsBackfillResult {
  ok: true;
  scope: BackfillScope;
  dryRun: boolean;
  candidates: number;
  fetched: number;
  parsedWithQuinte: number;
  updated: number;
  errors: number;
  quinteBefore: number;       // # lignes avec un quinte_plus AVANT
  quinteAfter: number;        // # lignes avec un quinte_plus APRÈS
  desordreMedianBefore: number | null;
  desordreMedianAfter: number | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface CandidateRow {
  course_id: string;
  geny_url: string;
  oldDesordre: number | null;   // ancien quinte_plus.desordre stocké (pour comparaison)
}

/** Lit toutes les lignes (pagination 1000) d'une requête PostgREST déjà filtrée. */
async function fetchAllPaged<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

function extractOldDesordre(arrivees: unknown): number | null {
  // courses(...).arrivees est un tableau (relation 1-N) ; on prend la 1ère ligne.
  const row = Array.isArray(arrivees) ? arrivees[0] : arrivees;
  const v = (row as { rapports_pmu?: { quinte_plus?: { desordre?: unknown } } } | null)
    ?.rapports_pmu?.quinte_plus?.desordre;
  return typeof v === "number" ? v : null;
}

async function loadCandidates(
  supabase: ReturnType<typeof createServiceClient>,
  opts: RapportsBackfillOptions,
): Promise<CandidateRow[]> {
  const scope = opts.scope ?? "quinte";

  const rows = await fetchAllPaged<{
    id: string;
    geny_url: string | null;
    arrivees: unknown;
  }>((from, to) => {
    let q = supabase
      .from("courses")
      .select("id, geny_url, date_course, arrivees(rapports_pmu)")
      .not("geny_url", "is", null)
      .order("date_course", { ascending: false })
      .range(from, to);
    if (scope === "quinte") q = q.contains("paris_disponibles", ["QUINTE_PLUS"]);
    else q = q.not("arrivee_officielle", "is", null); // "all" = courses terminées
    if (opts.since) q = q.gte("date_course", opts.since);
    return q;
  });

  const candidates = rows
    .filter((r) => !!r.geny_url)
    .map((r) => ({
      course_id: r.id,
      geny_url: r.geny_url as string,
      oldDesordre: extractOldDesordre(r.arrivees),
    }));

  return opts.limit && opts.limit > 0 ? candidates.slice(0, opts.limit) : candidates;
}

async function fetchGenyHtml(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < BACKOFF_MS.length + 1; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: GENY_HEADERS, cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) return await res.text();
      if (res.status === 429) { await sleep(BACKOFF_MS[attempt] ?? 30000); continue; }
      return null; // 403 / 404 / 5xx : on abandonne cette course
    } catch {
      clearTimeout(timer);
      return null;
    }
  }
  return null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Pool à `n` workers (même pattern que runGenyArriveesSync). */
async function processInPool<T>(items: T[], n: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function next(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => next()));
}

export async function runRapportsBackfill(
  opts: RapportsBackfillOptions = {},
): Promise<RapportsBackfillResult> {
  const scope = opts.scope ?? "quinte";
  const dryRun = !!opts.dryRun;
  const supabase = createServiceClient();

  const candidates = await loadCandidates(supabase, opts);
  console.log(
    `[backfill-rapports] scope=${scope} since=${opts.since ?? "—"} limit=${opts.limit ?? "—"} ` +
      `dryRun=${dryRun} → ${candidates.length} courses candidates`,
  );

  const beforeDesordre = candidates.map((c) => c.oldDesordre).filter((n): n is number => n != null);
  const afterDesordre: number[] = [];
  let fetched = 0, parsedWithQuinte = 0, updated = 0, errors = 0, quinteAfter = 0;

  await processInPool(candidates, CONCURRENCY, async (c) => {
    const url = buildGenyUrlFromStored(c.geny_url, "resultats");
    const html = await fetchGenyHtml(url);
    if (!html) { errors++; return; }
    fetched++;

    let rapports: ReturnType<typeof parseRapportsPMU> | null = null;
    let commentaire: string | null = null;
    try {
      const r = parseRapportsPMU(html);
      if (r && Object.keys(r).length > 0) rapports = r;
    } catch { /* parser défensif */ }
    try { commentaire = parseCommentaire(html); } catch { /* idem */ }

    const newDesordre = rapports?.quinte_plus?.desordre;
    if (typeof newDesordre === "number") { parsedWithQuinte++; afterDesordre.push(newDesordre); }
    if (rapports?.quinte_plus) quinteAfter++;

    if (!dryRun) {
      // UPDATE seulement (jamais d'insert) : on n'écrit que sur des lignes
      // `arrivees` existantes, sans toucher ordre_arrivee. rapports_pmu peut
      // repasser à null si la course n'a en fait aucun rapport ordonné valide.
      const { data, error } = await supabase
        .from("arrivees")
        .update({ rapports_pmu: rapports ?? null, commentaire: commentaire ?? null })
        .eq("course_id", c.course_id)
        .select("course_id");
      if (error) { errors++; return; }
      if (data && data.length > 0) updated++;
    }
  });

  const result: RapportsBackfillResult = {
    ok: true,
    scope,
    dryRun,
    candidates: candidates.length,
    fetched,
    parsedWithQuinte,
    updated,
    errors,
    quinteBefore: beforeDesordre.length,
    quinteAfter,
    desordreMedianBefore: median(beforeDesordre),
    desordreMedianAfter: median(afterDesordre),
  };
  console.log(`[backfill-rapports] ✅ ${JSON.stringify(result)}`);
  return result;
}
