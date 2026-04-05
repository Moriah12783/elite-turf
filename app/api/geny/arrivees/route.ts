// GET/POST /api/geny/arrivees?date=YYYY-MM-DD
// Scrape les arrivées depuis Geny.com et les stocke dans Supabase.
// Cron : toutes les 2h de 13h à 19h UTC.
// Accepte un paramètre ?date=YYYY-MM-DD pour le backfill des jours passés.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchPmuResultats } from "@/lib/pmu-api";

export const dynamic = "force-dynamic";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36";

// Extrait une suite de nombres valides (1-99) depuis une chaîne
function extractNums(str: string): number[] {
  return str.split(/[\s\-,\.\/|]+/).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 99);
}

// Regex pour extraire les arrivées depuis le HTML Geny — 10 patterns
function parseArrivee(html: string): number[] | null {
  const patterns: RegExp[] = [
    // P1 : "Arrivée : 3-1-7-5-12" ou "Arrivée officielle : …"
    /[Aa]rriv[eé]e\s*(?:officielle)?\s*:?\s*((?:\d+[\s\-,]+){2,}\d+)/,
    // P2 : attribut JSON "arrivee":"3-1-7"
    /['"arrivee'":\s]+([\d][\d\s\-,]+[\d])/i,
    // P3 : class contenant "arrivee" avec chiffres dedans
    /class="[^"]*arrivee[^"]*"[^>]*>([\d\s\-,]+)/i,
    // P4 : "ordre" avec chiffres "ordre_arrivee":"3 1 7 5 12"
    /ordre[_\-]?arrivee["'\s:]+(["\s\d\-,]+)/i,
    // P5 : balise <strong> ou <b> contenant des chiffres séparés par tirets (résultat typique)
    /<(?:strong|b)[^>]*>((?:\d+\s*[\-–]\s*){2,}\d+)<\/(?:strong|b)>/i,
    // P6 : liste de <td> ou <li> consécutifs avec un seul nombre (colonnes d'arrivée)
    /(?:<td[^>]*>\s*(\d{1,2})\s*<\/td>\s*){3,}/i,
    // P7 : JSON arrivee dans data-* attribut
    /data-(?:arrivee|ordre|result)[^=]*=["'](["\d\s,\-]+)["']/i,
    // P8 : "Résultat" + chiffres
    /[Rr][eé]sultat\s*:?\s*((?:\d+[\s\-,]+){2,}\d+)/,
    // P9 : blocs "1er ... 2e ... 3e ..." avec numéros
    /1[eèr]{1,2}[^>]*?>\s*(\d+)[\s\S]{0,50}2[eèm]{1,2}[^>]*?>\s*(\d+)[\s\S]{0,50}3[eèm]{1,2}[^>]*?>\s*(\d+)/i,
    // P10 : séquence de 5 nombres entre 1 et 20 séparés par tirets (ex: "3-1-7-5-12")
    /\b(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})\b/,
  ];

  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (!m) continue;

    // Pattern 9 capture groupes séparés (1er, 2e, 3e)
    if (pattern === patterns[8] && m[1] && m[2] && m[3]) {
      const nums = [+m[1], +m[2], +m[3]].filter(n => n >= 1 && n <= 99);
      if (nums.length === 3) return nums;
    }
    // Pattern 10 capture 5 groupes séparés
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

  // Récupérer les courses de la date demandée SANS filtre statut
  // (le statut DB peut rester "PROGRAMME" même si la course est terminée)
  const { data: courses } = await supabase
    .from("courses")
    .select("id, numero_reunion, numero_course")
    .eq("date_course", dateISO)
    .is("arrivee_officielle", null); // seulement celles sans arrivée enregistrée

  if (!courses?.length) return [];

  const results: { courseId: string; arrivee: number[] }[] = [];
  const dateStr = dateISO.replace(/-/g, ""); // YYYYMMDD

  for (const course of courses) {
    let arrivee: number[] | null = null;

    // ── Source 1 : Geny.com (scraping HTML) ──────────────────────────
    try {
      const r   = String(course.numero_reunion).padStart(2, "0");
      const c   = String(course.numero_course).padStart(2, "0");
      const url = `https://www.geny.com/resultats-pmu/${dateStr}r${r}c${c}`;

      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const html = await res.text();
        arrivee = parseArrivee(html);
      }
    } catch { /* continue vers fallback */ }

    // ── Source 2 : API PMU (fallback si Geny échoue) ──────────────────
    if (!arrivee) {
      try {
        const pmuResult = await fetchPmuResultats(dateStr, course.numero_reunion, course.numero_course);
        if (pmuResult && pmuResult.arrivee.length >= 3) {
          arrivee = pmuResult.arrivee.slice(0, 5);
        }
      } catch { /* skip */ }
    }

    if (arrivee) {
      results.push({ courseId: course.id, arrivee });
    }
  }

  return results;
}

async function processArrivees(dateISO: string) {
  const supabase = createServiceClient();
  const arrivees = await scrapeGenyArrivees(dateISO);
  let upserted = 0;

  for (const { courseId, arrivee } of arrivees) {
    // Sauvegarder dans la table courses directement (arrivee_officielle)
    const { error } = await supabase
      .from("courses")
      .update({
        arrivee_officielle: arrivee,
        statut: "TERMINE",
      })
      .eq("id", courseId);

    if (!error) {
      upserted++;

      // Upsert dans la table arrivees si elle existe
      await supabase
        .from("arrivees")
        .upsert(
          {
            course_id: courseId,
            ordre_arrivee: arrivee,
            horodatage: new Date().toISOString(),
          },
          { onConflict: "course_id" },
        )
        .then(() => {}); // ignore si table inexistante
    }
  }

  return { scraped: arrivees.length, upserted, date: dateISO };
}

export async function POST(req: NextRequest) {
  try {
    // Accepte un paramètre date pour le backfill
    let dateISO: string;
    try {
      const body = await req.json().catch(() => ({}));
      dateISO = body.date || new Date().toISOString().split("T")[0];
    } catch {
      dateISO = new Date().toISOString().split("T")[0];
    }

    const result = await processArrivees(dateISO);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url  = new URL(req.url);
    const date = url.searchParams.get("date") || new URL(req.url).searchParams.get("date");
    const dateISO = date || new Date().toISOString().split("T")[0];

    const result = await processArrivees(dateISO);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
