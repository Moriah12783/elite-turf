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

function parseArrivee(html: string): number[] | null {
  // Pattern principal : section arrivée explicite
  const patterns: RegExp[] = [
    // "Arrivée officielle : 4-9-12-7-1"
    /[Aa]rriv[eé]e\s*(?:officielle)?\s*:?\s*((?:\d+[\s\-,]+){2,}\d+)/,
    // <strong>4 - 9 - 12 - 7 - 1</strong>
    /<(?:strong|b)[^>]*>((?:\d+\s*[\-–]\s*){2,}\d+)<\/(?:strong|b)>/i,
    // data-arrivee="4-9-12-7-1"
    /data-(?:arrivee|ordre|result)[^=]*=["']([\d\s,\-]+)["']/i,
    // class="arrivee" ... "4 9 12 7 1"
    /class="[^"]*arriv[eé]e[^"]*"[^>]*>([\d\s\-,]+)/i,
    // "Résultat: 4-9-12-7-1"
    /[Rr][eé]sultat\s*:?\s*((?:\d+[\s\-,]+){2,}\d+)/,
    // Format compact final 5 chiffres collés
    /\b(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})\b/,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const m = html.match(patterns[i]);
    if (!m) continue;

    // Pattern dernier (5 chiffres séparés)
    if (i === 5 && m[1] && m[2] && m[3] && m[4] && m[5]) {
      const nums = [+m[1], +m[2], +m[3], +m[4], +m[5]].filter((n) => n >= 1 && n <= 99);
      if (nums.length === 5) return nums;
    }

    const nums = extractNums(m[1] ?? m[0]);
    if (nums.length >= 3) return nums.slice(0, 5);
  }

  return null;
}

interface CourseRow {
  id:             string;
  numero_reunion: number;
  numero_course:  number;
  geny_url:       string | null;
}

async function fetchArriveeForCourse(course: CourseRow): Promise<number[] | null> {
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
    return parseArrivee(html);
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
  const date = dateISO || new Date().toISOString().split("T")[0];
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
    const arrivee = await fetchArriveeForCourse(course);
    return arrivee ? { courseId: course.id, arrivee } : null;
  });

  const valid = scraped.filter((s): s is { courseId: string; arrivee: number[] } => s !== null);

  // Upsert dans courses (arrivee_officielle + statut TERMINE)
  if (valid.length > 0) {
    const courseUpdates = valid.map(({ courseId, arrivee }) => ({
      id:                 courseId,
      arrivee_officielle: arrivee,
      statut:             "TERMINE",
    }));
    await supabase.from("courses").upsert(courseUpdates);

    // Upsert dans table arrivees (best-effort, table optionnelle)
    const arriveesRows = valid.map(({ courseId, arrivee }) => ({
      course_id:     courseId,
      ordre_arrivee: arrivee,
      horodatage:    new Date().toISOString(),
    }));
    try {
      await supabase.from("arrivees").upsert(arriveesRows, { onConflict: "course_id" });
    } catch {
      // Table arrivees absente — silencieux
    }
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
