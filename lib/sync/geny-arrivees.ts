/**
 * lib/sync/geny-arrivees.ts
 *
 * Scrape les arrivées depuis Geny.com (fallback PMU API) et update Supabase.
 * Extrait de /api/geny/arrivees/route.ts pour appel direct (sans HTTP).
 */

import { createServiceClient } from "@/lib/supabase/server";
import { fetchPmuResultats } from "@/lib/pmu-api";

export interface GenyArriveesResult {
  ok:        true;
  date:      string;
  scraped:   number;
  upserted:  number;
}

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36";

function extractNums(str: string): number[] {
  return str.split(/[\s\-,\.\/|]+/).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 99);
}

function parseArrivee(html: string): number[] | null {
  const patterns: RegExp[] = [
    /[Aa]rriv[eé]e\s*(?:officielle)?\s*:?\s*((?:\d+[\s\-,]+){2,}\d+)/,
    /['"arrivee'":\s]+([\d][\d\s\-,]+[\d])/i,
    /class="[^"]*arrivee[^"]*"[^>]*>([\d\s\-,]+)/i,
    /ordre[_\-]?arrivee["'\s:]+(["\s\d\-,]+)/i,
    /<(?:strong|b)[^>]*>((?:\d+\s*[\-–]\s*){2,}\d+)<\/(?:strong|b)>/i,
    /(?:<td[^>]*>\s*(\d{1,2})\s*<\/td>\s*){3,}/i,
    /data-(?:arrivee|ordre|result)[^=]*=["'](["\d\s,\-]+)["']/i,
    /[Rr][eé]sultat\s*:?\s*((?:\d+[\s\-,]+){2,}\d+)/,
    /1[eèr]{1,2}[^>]*?>\s*(\d+)[\s\S]{0,50}2[eèm]{1,2}[^>]*?>\s*(\d+)[\s\S]{0,50}3[eèm]{1,2}[^>]*?>\s*(\d+)/i,
    /\b(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})\b/,
  ];

  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (!m) continue;

    if (pattern === patterns[8] && m[1] && m[2] && m[3]) {
      const nums = [+m[1], +m[2], +m[3]].filter(n => n >= 1 && n <= 99);
      if (nums.length === 3) return nums;
    }
    if (pattern === patterns[9] && m[1]) {
      const nums = [+m[1], +m[2], +m[3], +m[4], +m[5]].filter(n => n >= 1 && n <= 99);
      if (nums.length >= 3) return nums.slice(0, 5);
    }

    const nums = extractNums(m[1] ?? m[0]);
    if (nums.length >= 3) return nums.slice(0, 5);
  }

  return null;
}

async function scrapeGenyArrivees(
  dateISO: string,
): Promise<{ courseId: string; arrivee: number[] }[]> {
  const supabase = createServiceClient();

  const { data: courses } = await supabase
    .from("courses")
    .select("id, numero_reunion, numero_course")
    .eq("date_course", dateISO)
    .is("arrivee_officielle", null);

  if (!courses?.length) return [];

  const results: { courseId: string; arrivee: number[] }[] = [];
  const dateStr = dateISO.replace(/-/g, "");

  type CourseRow = { id: string; numero_reunion: number; numero_course: number };
  const seen = new Set<string>();
  const uniqueCourses = (courses as CourseRow[]).filter(c => {
    const key = `${c.numero_reunion}-${c.numero_course}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`[geny-arrivees] ${courses.length} courses → ${uniqueCourses.length} uniques après dédupliq.`);

  for (const course of uniqueCourses) {
    let arrivee: number[] | null = null;

    // Source 1 : Geny.com
    try {
      const r   = String(course.numero_reunion).padStart(2, "0");
      const c   = String(course.numero_course).padStart(2, "0");
      const url = `https://www.geny.com/resultats-pmu/${dateStr}r${r}c${c}`;

      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(10000),
      });

      console.log(`[geny-arrivees] Geny R${r}C${c} → HTTP ${res.status}`);

      if (res.ok) {
        const html = await res.text();
        arrivee = parseArrivee(html);
        if (!arrivee) console.log(`[geny-arrivees] R${r}C${c} : HTML ok mais aucun pattern trouvé (${html.length} chars)`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[geny-arrivees] Geny fetch error R${course.numero_reunion}C${course.numero_course}: ${msg}`);
    }

    // Source 2 : PMU fallback
    if (!arrivee) {
      try {
        const pmuResult = await fetchPmuResultats(dateStr, course.numero_reunion, course.numero_course);
        if (pmuResult && pmuResult.arrivee.length >= 3) {
          arrivee = pmuResult.arrivee.slice(0, 5);
          console.log(`[geny-arrivees] PMU R${course.numero_reunion}C${course.numero_course} → arrivée: ${arrivee}`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[geny-arrivees] PMU fallback error: ${msg}`);
      }
    }

    if (arrivee) {
      results.push({ courseId: course.id, arrivee });
    }
  }

  return results;
}

export async function runGenyArriveesSync(dateISO?: string): Promise<GenyArriveesResult> {
  const date = dateISO || new Date().toISOString().split("T")[0];
  const supabase = createServiceClient();

  const arrivees = await scrapeGenyArrivees(date);

  // Bulk upsert dans courses : on prépare un tableau de updates par id
  // (Supabase upsert avec PK = update if exists)
  if (arrivees.length > 0) {
    const courseUpdates = arrivees.map(({ courseId, arrivee }) => ({
      id:                  courseId,
      arrivee_officielle:  arrivee,
      statut:              "TERMINE",
    }));
    await supabase.from("courses").upsert(courseUpdates);

    // Bulk upsert dans la table arrivees
    const arriveesRows = arrivees.map(({ courseId, arrivee }) => ({
      course_id:     courseId,
      ordre_arrivee: arrivee,
      horodatage:    new Date().toISOString(),
    }));
    try {
      await supabase.from("arrivees").upsert(arriveesRows, { onConflict: "course_id" });
    } catch {
      // Table arrivees inexistante — silencieux
    }
  }

  return {
    ok:       true,
    date,
    scraped:  arrivees.length,
    upserted: arrivees.length,
  };
}
