// GET/POST /api/geny/arrivees
// Scrape les arrivées du jour depuis Geny.com et les stocke dans Supabase.
// Cron : toutes les 15 min de 13h à 19h UTC (12 fois).

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";
const USER_AGENT  = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36";

// Regex pour extraire les arrivées depuis le HTML Geny
// Format attendu dans le HTML : "3-7-11-4-9" ou "3 7 11 4 9"
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
  return null;
}

async function scrapeGenyArrivees(): Promise<{ courseId: string; arrivee: number[] }[]> {
  const today = new Date();
  const d = today.toISOString().split("T")[0]; // YYYY-MM-DD

  const supabase = createServiceClient();

  // Récupérer les courses du jour
  const { data: courses } = await supabase
    .from("courses")
    .select("id, numero_reunion, numero_course, hippodrome:hippodromes(pays)")
    .eq("date_course", d)
    .eq("statut", "PROGRAMME");

  if (!courses?.length) return [];

  const results: { courseId: string; arrivee: number[] }[] = [];

  for (const course of courses) {
    try {
      const dateStr = d.replace(/-/g, ""); // YYYYMMDD
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

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    const arrivees = await scrapeGenyArrivees();
    let upserted = 0;

    for (const { courseId, arrivee } of arrivees) {
      const { error } = await supabase
        .from("arrivees")
        .upsert({
          course_id:     courseId,
          ordre_arrivee: arrivee,
          horodatage:    new Date().toISOString(),
        }, { onConflict: "course_id" });

      if (!error) {
        upserted++;
        // Mettre à jour le statut de la course
        await supabase
          .from("courses")
          .update({ statut: "TERMINE", arrivee_officielle: arrivee })
          .eq("id", courseId);
      }
    }

    return NextResponse.json({ ok: true, scraped: arrivees.length, upserted });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // GET = même logique que POST (pour compatibilité cron Vercel GET)
  return POST(req);
}
