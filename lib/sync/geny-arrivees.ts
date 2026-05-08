/**
 * lib/sync/geny-arrivees.ts
 *
 * Scrape les arrivées depuis Geny.com et update Supabase. PMU API est
 * complètement déprécié (rate-limit HTTP 420 chronique sur les IPs
 * Cloudflare/Vercel).
 *
 * Stratégie depuis 2026-05-05 :
 *  - On utilise courses.geny_url (stockée à l'insertion) → on transforme
 *    /partants-pmu/... en /resultats-pmu/... via buildGenyUrlFromStored().
 *    Cette URL avec slug + ID interne est la SEULE forme reconnue par Geny.
 *  - L'ancienne URL pattern `/resultats-pmu/{date}r{R}c{C}` ne fonctionne
 *    plus (404 → "Unexpected end of JSON input" en aval).
 *  - On parse l'arrivée via plusieurs patterns regex (HTML Geny varie selon
 *    galop/trot/obstacle).
 */

import { createServiceClient } from "@/lib/supabase/server";
import { buildGenyUrlFromStored } from "@/lib/geny";
import { todayParisISO } from "@/lib/paris-date";
import {
  parseRapportsPMU,
  parseCommentaire,
  type RapportsPMU,
} from "@/lib/sync/geny-rapports-parser";

export interface GenyArriveesResult {
  ok:        true;
  date:      string;
  scraped:   number;
  upserted:  number;
  skipped:   number;          // courses sans geny_url
  not_found: number;          // page Geny vide ou pas d'arrivée encore
}

const USER_AGENT  = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 8000;
const CONCURRENCY = 4;

function extractNums(str: string): number[] {
  return str.split(/[\s\-,\.\/|]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 99);
}

/**
 * Limite max d'une arrivée scrapée. PMU utilise jusqu'à 7 chevaux pour le
 * Quinté+ Bonus 4 (5 du Quinté + 6e + 7e bonus). Geny affiche souvent 8
 * chevaux (les Dai exclus). On stocke jusqu'à 10 pour être large, l'affichage
 * front choisira combien afficher selon le type de pari.
 */
const MAX_HORSES = 10;

/**
 * Cherche tous les groupes du type "X-Y-Z-..." (au moins 3 numéros 1-99
 * séparés par - ou –) dans une chaîne de caractères. Retourne les groupes
 * triés par longueur décroissante (le plus long en premier = arrivée la
 * plus complète).
 *
 * Pourquoi pas un seul regex match ? Parce que Geny.com peut afficher
 * plusieurs séquences dans la page :
 *   - Un widget en haut "Arrivée : 8-11-9" (3 chevaux, Tiercé seul)
 *   - Un tableau "Arrivée définitive" plus bas "8-11-9-10-4-2-7-12" (8 chevaux)
 *
 * L'ancien parser matchait le PREMIER pattern et s'arrêtait à 3-5 chevaux.
 * Cette version cherche tous les candidats puis garde le plus long.
 */
function findAllArriveeCandidates(text: string): number[][] {
  const candidates: number[][] = [];
  // Pattern : 3+ numéros (1-2 chiffres) séparés par - ou – ou , éventuels espaces
  const re = /\b(\d{1,2}(?:\s*[\-–,]\s*\d{1,2}){2,})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const nums = m[1]
      .split(/\s*[\-–,]\s*/)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 99);
    // Pas de doublons (sinon ce n'est pas une arrivée mais une plage genre "1-1-1")
    if (nums.length >= 3 && new Set(nums).size === nums.length) {
      candidates.push(nums);
    }
  }
  candidates.sort((a, b) => b.length - a.length);
  return candidates;
}

export function parseArrivee(html: string): number[] | null {
  // ── Stratégie 1 (priorité) : section "Arrivée définitive/officielle" ────
  // On isole d'abord les blocs HTML qui contiennent explicitement le label
  // "Arrivée définitive" ou "Arrivée officielle". Ces sections ont les 5+
  // premiers chevaux dans un tableau structuré.
  const sectionPatterns: RegExp[] = [
    /[Aa]rriv[eé]e\s*d[eé]finitive[\s\S]{0,3000}/,
    /[Aa]rriv[eé]e\s*officielle[\s\S]{0,3000}/,
  ];

  for (const sectionRe of sectionPatterns) {
    const sectionMatch = html.match(sectionRe);
    if (!sectionMatch) continue;

    const candidates = findAllArriveeCandidates(sectionMatch[0]);
    if (candidates.length > 0) {
      return candidates[0].slice(0, MAX_HORSES);
    }
  }

  // ── Stratégie 2 : data-attributes structurés ────────────────────────────
  const dataMatch = html.match(/data-(?:arrivee|ordre|result)[^=]*=["']([\d\s,\-–]+)["']/i);
  if (dataMatch) {
    const nums = extractNums(dataMatch[1]);
    if (nums.length >= 3) {
      return nums.slice(0, MAX_HORSES);
    }
  }

  // ── Stratégie 3 (fallback global) : la plus longue séquence du HTML ─────
  // Si aucune section explicite, on prend la séquence la plus longue de la
  // page entière. Risque : capter des numéros non-arrivée (ex: téléphones
  // "01-23-45-67-89") mais filtre n >= 1 && n <= 99 limite la casse.
  const allCandidates = findAllArriveeCandidates(html);
  if (allCandidates.length > 0 && allCandidates[0].length >= 3) {
    return allCandidates[0].slice(0, MAX_HORSES);
  }

  return null;
}

interface CourseRow {
  id:             string;
  numero_reunion: number;
  numero_course:  number;
  geny_url:       string | null;
}

interface FetchedArrivee {
  arrivee:     number[];
  rapports:    RapportsPMU | null;
  commentaire: string | null;
}

async function fetchArriveeForCourse(course: CourseRow): Promise<FetchedArrivee | null> {
  if (!course.geny_url) return null;

  // Transforme /partants-pmu/... en /resultats-pmu/...
  const url = buildGenyUrlFromStored(course.geny_url, "resultats");

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        "User-Agent":      USER_AGENT,
        "Accept":          "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Referer":         "https://www.geny.com/",
      },
      cache:  "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const html = await res.text();

    const arrivee = parseArrivee(html);
    if (!arrivee) return null;

    // Bonus : rapports PMU complets + commentaire d'arrivée (best-effort)
    let rapports: RapportsPMU | null = null;
    let commentaire: string | null = null;
    try {
      const r = parseRapportsPMU(html);
      // Considère "non vide" si au moins une clé existe
      if (r && Object.keys(r).length > 0) rapports = r;
    } catch {
      // Parser défensif : on ne casse pas la sync si parsing rapports échoue
    }
    try {
      commentaire = parseCommentaire(html);
    } catch {
      // idem
    }

    return { arrivee, rapports, commentaire };
  } catch {
    return null;
  }
}

/** Limite la concurrence à `n` workers. */
async function processInPool<T, R>(
  items: T[],
  workerCount: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function next(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, () => next()));
  return results;
}

export async function runGenyArriveesSync(dateISO?: string): Promise<GenyArriveesResult> {
  // Default = "aujourd'hui Paris" (pas UTC) — sinon entre minuit-2h Paris on
  // chercherait les arrivées de la veille au lieu du jour actuel.
  const date = dateISO || todayParisISO();
  const supabase = createServiceClient();

  const { data: courses } = await supabase
    .from("courses")
    .select("id, numero_reunion, numero_course, geny_url")
    .eq("date_course", date)
    .is("arrivee_officielle", null);

  if (!courses?.length) {
    return { ok: true, date, scraped: 0, upserted: 0, skipped: 0, not_found: 0 };
  }

  // Dédupliquer par (R, C) au cas où
  const seen = new Set<string>();
  const unique = (courses as CourseRow[]).filter((c) => {
    const key = `${c.numero_reunion}-${c.numero_course}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Skipper celles sans geny_url (LONACI Afrique sans équivalent Geny)
  const withGeny    = unique.filter((c) => !!c.geny_url);
  const withoutGeny = unique.length - withGeny.length;

  console.log(`[geny-arrivees] ${unique.length} courses (avec geny_url: ${withGeny.length}, sans: ${withoutGeny})`);

  // Scraper en parallèle (4 workers)
  const scraped = await processInPool(withGeny, CONCURRENCY, async (course) => {
    const data = await fetchArriveeForCourse(course);
    return data ? { courseId: course.id, ...data } : null;
  });

  const valid = scraped.filter(
    (s): s is { courseId: string } & FetchedArrivee => s !== null,
  );

  // Upsert dans courses (arrivee_officielle + statut TERMINE)
  if (valid.length > 0) {
    const courseUpdates = valid.map(({ courseId, arrivee }) => ({
      id:                 courseId,
      arrivee_officielle: arrivee,
      statut:             "TERMINE",
    }));
    await supabase.from("courses").upsert(courseUpdates);

    // Upsert dans table arrivees (best-effort, table optionnelle)
    // Inclut désormais rapports_pmu (JSONB) + commentaire (TEXT)
    const arriveesRows = valid.map(({ courseId, arrivee, rapports, commentaire }) => ({
      course_id:     courseId,
      ordre_arrivee: arrivee,
      rapports_pmu: rapports ?? null,
      commentaire:  commentaire ?? null,
      horodatage:    new Date().toISOString(),
    }));
    try {
      await supabase.from("arrivees").upsert(arriveesRows, { onConflict: "course_id" });
    } catch {
      // Table arrivees absente — silencieux
    }

    const withRapports = valid.filter((v) => v.rapports !== null).length;
    console.log(
      `[geny-arrivees] upserted ${valid.length} arrivées (rapports PMU: ${withRapports})`,
    );
  }

  return {
    ok:        true,
    date,
    scraped:   valid.length,
    upserted:  valid.length,
    skipped:   withoutGeny,
    not_found: withGeny.length - valid.length,
  };
}
