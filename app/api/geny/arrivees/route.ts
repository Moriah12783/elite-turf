// GET/POST /api/geny/arrivees?date=YYYY-MM-DD
// Scrape les arrivées depuis Geny.com et les stocke dans Supabase.
// Cron : toutes les 2h de 13h à 19h UTC.
// Accepte un paramètre ?date=YYYY-MM-DD pour le backfill des jours passés.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36";

// Regex pour extraire les arrivées depuis le HTML Geny
function parseArrivee(html: string): number[] | null {
  // Pattern 1 : données JSON dans un attribut data
  const jsonMatch = html.match(/arrivee['":\s]+['"]?([\d][\d\s\-,]+[\d])/i);
  if (jsonMatch) {
    const nums = jsonMatch[1].split(/[\s\-,]+/).map(Number).filter(n => n > 0 && n < 30);
    if (nums.length >= 3) return nums.slice(0, 5);
  }
  // Pattern 2 : tirets dans le contenu "Arrivée : 3-7-11-4-9"
  const textMatch = html.match(/rrivée\s*:\s*([\d][\d\-]+[\d])/i);
  if (textMatch) {
    const nums = textMatch[1].split("-").map(Number).filter(n => n > 0 && n < 30);
    if (nums.length >= 3) return nums.slice(0, 5);
  }
  // Pattern 3 : balise <td> ou <span> contenant "1er 2e 3e …"
  const ordreMatch = html.match(/class="[^"]*arrivee[^"]*"[^>]*>([\d\s\-]+)</i);
  if (ordreMatch) {
    const nums = ordreMatch[1].split(/[\s\-]+/).map(Number).filter(n => n > 0 && n < 30);
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
    try {
      const r = String(course.numero_reunion).padStart(2, "0");
      const c = String(course.numero_course).padStart(2, "0");
      const url = `https://www.geny.com/resultats-pmu/${dateStr}r${r}c${c}`;

      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept": "text/html" },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;
      const html = await res.text();
      const arrivee = parseArrivee(html);
      if (arrivee) {
        results.push({ courseId: course.id, arrivee });
      }
    } catch {
      // Course non disponible, on continue
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
