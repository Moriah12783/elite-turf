/**
 * POST /api/geny/programme
 *
 * Scrape le programme PMU depuis Geny.com (alternative au blocage HTTP 420 de l'API PMU).
 * Geny.com est accessible depuis tous les pays sans restriction IP.
 *
 * Body JSON optionnel : { date: "YYYY-MM-DD" | "demain" }
 * Sans body → programme du jour
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// ── Types ──────────────────────────────────────────────────────────────────

interface GenyCourse {
  reunionNum:    number;
  hippodromeNom: string;
  hippodromePays: string;
  courseNum:     number;
  libelle:       string;
  heureDepart:   string | null;  // "13:58:00" ou null
  nbPartants:    number;
  parisDisponibles: string[];
  dateCourse:    string;         // "YYYY-MM-DD"
}

// ── Scraping Geny ─────────────────────────────────────────────────────────

function parseGenyDate(dateStr: string): string {
  // "demain" → YYYY-MM-DD de demain
  if (dateStr === "demain") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }
  return dateStr;
}

function genyUrl(dateISO: string): string {
  // Format Geny : /reunions-courses-pmu/_daujourdhui ou /2026-04-05_d2026-04-05
  const today = new Date().toISOString().split("T")[0];
  if (dateISO === today) return "https://www.geny.com/reunions-courses-pmu/_daujourdhui";
  const d = new Date(dateISO);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateISO === tomorrow.toISOString().split("T")[0]) {
    return "https://www.geny.com/reunions-courses-pmu/_ddemain";
  }
  return `https://www.geny.com/reunions-courses-pmu/${dateISO}_d${dateISO}`;
}

function extractPaysFromHippodrome(nom: string): string {
  if (nom.includes("Suisse"))         return "Suisse";
  if (nom.includes("Grande-Bretagne") || nom.includes("Royaume-Uni")) return "Grande-Bretagne";
  if (nom.includes("Allemagne"))      return "Allemagne";
  if (nom.includes("Italie"))         return "Italie";
  if (nom.includes("Etats-Unis") || nom.includes("États-Unis") || nom.includes("Etats Unis")) return "États-Unis";
  if (nom.includes("Belgique"))       return "Belgique";
  if (nom.includes("Argentine"))      return "Argentine";
  if (nom.includes("Uruguay"))        return "Uruguay";
  if (nom.includes("Maroc"))          return "Maroc";
  if (nom.includes("Espagne"))        return "Espagne";
  if (nom.includes("Suède") || nom.includes("Suede")) return "Suède";
  if (nom.includes("Autriche"))       return "Autriche";
  return "France";
}

function cleanHippodromeName(nom: string): string {
  // Retire "(R3)" et le pays entre parenthèses
  return nom
    .replace(/\s*\(R\d+\)/g, "")
    .replace(/\s*\([^)]+\)\s*$/, "")
    .replace(/\[.*?\]/g, "")
    .trim();
}

function parseHeure(raw: string): string | null {
  // "9 Partants - 13h58" → "13:58:00"
  const m = raw.match(/(\d{1,2})h(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}:00`;
}

function parsePartants(raw: string): number {
  const m = raw.match(/(\d+)\s*[Pp]artant/);
  return m ? parseInt(m[1]) : 0;
}

function classToParisDisponibles(btnClass: string): string[] {
  if (btnClass.includes("Quinte"))  return ["QUINTE_PLUS", "QUARTE_PLUS", "TIERCE", "COUPLE_GAGNANT", "COUPLE_PLACE", "TRIO"];
  if (btnClass.includes("Multi"))   return ["MULTI", "COUPLE_GAGNANT", "SIMPLE_GAGNANT"];
  return ["SIMPLE_GAGNANT", "SIMPLE_PLACE"];
}

async function scrapeGenyProgramme(dateISO: string): Promise<GenyCourse[]> {
  const url = genyUrl(dateISO);
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "fr-FR,fr;q=0.9",
      "Referer": "https://www.geny.com/",
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Geny HTTP ${res.status} pour ${url}`);
  const html = await res.text();
  const courses: GenyCourse[] = [];

  // ── 1. Séparer les blocs de réunion ──────────────────────────────────
  // Chaque réunion est délimitée par <a name="reunionN">
  const reunionBlocks = html.split(/<a\s+name="reunion(\d+)"/i);

  for (let i = 1; i < reunionBlocks.length; i += 2) {
    const reunionNum = parseInt(reunionBlocks[i]);
    const block = reunionBlocks[i + 1] || "";

    // ── 2. Extraire le nom de l'hippodrome ───────────────────────────────
    // Pattern : "Vincennes (R1)" ou "<...>Nancy</..."
    const hipMatch = block.match(/([A-ZÀ-Ÿa-zà-ÿ][^<\n]{2,60}?)\s*(?:\(R\d+\))?<\/(?:div|h[123456]|span|a)>/);
    // Alternative: chercher dans le texte suivant immédiatement l'ancre
    const hipRaw = block.match(/>\s*([A-ZÀ-Ÿ][^\n<]{3,60}?)(?:\s*\(R\d+\))?\s*<\/(?:div|span|h\d)/)?.[1]
      || block.match(/Pariez sur la r[eé]union\s+([^\n<]{3,60})/i)?.[1]
      || block.match(/href="[^"]*#reunion\d+"[^>]*>([^<]{3,60})<\/a>\s*(?:&nbsp;|\s)*<\/(?:div|li|td)/i)?.[1]
      || `Réunion ${reunionNum}`;

    const hipNomComplet = hipRaw.trim();
    const hipNom = cleanHippodromeName(hipNomComplet);
    const hipPays = extractPaysFromHippodrome(hipNomComplet);

    // ── 3. Extraire les courses de cette réunion ─────────────────────────
    // On cherche les liens partants-pmu avec accesskey (= numéro de course PMU)
    const courseRegex = /href="\/partants-pmu\/[^"]*"\s+accesskey="(\d+)"/g;
    // Pattern pour extraire le libellé depuis l'URL
    const courseUrlRegex = /href="(\/partants-pmu\/(\d{4}-\d{2}-\d{2})-([^-]+(?:-[^-_]+)*)-pmu-([^_]+)_c\d+)"\s+accesskey="(\d+)"/g;

    // On cherche aussi les blocs btnArrivee pour heures et partants
    // Structure : les blocs btnArrivee apparaissent dans l'ordre des courses
    const arriveeBlocks = Array.from(block.matchAll(/<div[^>]+class="btnArrivee"[^>]*>([\s\S]*?)<\/div>/g));

    let match;
    let courseIndex = 0;
    const courseUrlRe = /href="(\/partants-pmu\/([\d]{4}-\d{2}-\d{2})-([^_]+)_c\d+)"\s+accesskey="(\d+)"/g;

    while ((match = courseUrlRe.exec(block)) !== null) {
      const fullPath  = match[1];
      const dateSlug  = match[2];
      const nameSlug  = match[3];
      const courseNum = parseInt(match[4]);

      // Extraire le libellé depuis le slug : "vincennes-pmu-prix-du-gers" → "Prix du Gers"
      const namePart = nameSlug.replace(/^[^-]+-pmu-/, "").replace(/-/g, " ");
      const libelle  = namePart.charAt(0).toUpperCase() + namePart.slice(1);

      // Extraire la classe du btn (quinte/multi/course) depuis le contexte de l'URL
      const ctxStart = block.indexOf(fullPath) - 200;
      const ctx = block.slice(Math.max(0, ctxStart), block.indexOf(fullPath) + 200);
      const btnClass = ctx.match(/class="([^"]*btn(?:Quinte|Multi|Course)[^"]*)"/i)?.[1] || "";

      // Associer le bloc arrivee (heures/partants) par ordre
      const arriveeText = arriveeBlocks[courseIndex]?.[1] || "";
      const heureDepart = parseHeure(arriveeText);
      const nbPartants  = parsePartants(arriveeText);

      courses.push({
        reunionNum,
        hippodromeNom: hipNom,
        hippodromePays: hipPays,
        courseNum,
        libelle,
        heureDepart,
        nbPartants,
        parisDisponibles: classToParisDisponibles(btnClass),
        dateCourse: dateISO,
      });

      courseIndex++;
    }
  }

  return courses;
}

// ── Upsert Supabase ───────────────────────────────────────────────────────

async function syncCoursesToDB(courses: GenyCourse[]) {
  const supabase = createServiceClient();
  const hipNoms  = [...new Set(courses.map(c => c.hippodromeNom))];
  const hipMap: Record<string, string> = {};

  for (const nom of hipNoms) {
    const pays = courses.find(c => c.hippodromeNom === nom)?.hippodromePays || "France";
    const { data: existing } = await supabase.from("hippodromes").select("id").eq("nom", nom).single();
    if (existing) {
      hipMap[nom] = existing.id;
    } else {
      const { data: ins } = await supabase.from("hippodromes")
        .insert({ nom, pays, ville: nom, fuseau_horaire: "Europe/Paris", actif: true })
        .select("id").single();
      if (ins) hipMap[nom] = ins.id;
    }
  }

  let inserted = 0, updated = 0;

  for (const c of courses) {
    const hippodromeId = hipMap[c.hippodromeNom];
    if (!hippodromeId) continue;

    const { data: existing } = await supabase.from("courses").select("id")
      .eq("hippodrome_id", hippodromeId)
      .eq("date_course", c.dateCourse)
      .eq("numero_reunion", c.reunionNum)
      .eq("numero_course", c.courseNum)
      .single();

    if (existing) {
      await supabase.from("courses").update({
        nb_partants:       c.nbPartants,
        libelle:           c.libelle,
        paris_disponibles: c.parisDisponibles,
        ...(c.heureDepart ? { heure_depart: c.heureDepart } : {}),
      }).eq("id", existing.id);
      updated++;
    } else {
      await supabase.from("courses").insert({
        hippodrome_id:     hippodromeId,
        date_course:       c.dateCourse,
        heure_depart:      c.heureDepart || "12:00:00",
        numero_reunion:    c.reunionNum,
        numero_course:     c.courseNum,
        libelle:           c.libelle,
        distance_metres:   0,
        categorie:         "PLAT",
        nb_partants:       c.nbPartants,
        statut:            "PROGRAMME",
        paris_disponibles: c.parisDisponibles,
      });
      inserted++;
    }
  }

  return { inserted, updated, hippodromes: Object.keys(hipMap).length };
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawDate = body?.date || "today";
    const dateISO = rawDate === "today" || rawDate === "aujourd'hui"
      ? new Date().toISOString().split("T")[0]
      : rawDate === "demain"
        ? (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })()
        : rawDate;

    const courses = await scrapeGenyProgramme(dateISO);

    if (!courses.length) {
      return NextResponse.json({ ok: true, message: `Aucune course Geny trouvée pour ${dateISO}`, inserted: 0 });
    }

    const result = await syncCoursesToDB(courses);
    console.log(`[Geny Programme] ${dateISO} → ${result.inserted} insérées, ${result.updated} mises à jour`);

    return NextResponse.json({
      ok:       true,
      date:     dateISO,
      courses:  courses.length,
      reunions: [...new Set(courses.map(c => c.reunionNum))].length,
      ...result,
    });
  } catch (err: any) {
    console.error("[Geny Programme] Erreur:", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || "today";
  return POST(new NextRequest(req.url, {
    method: "POST",
    body: JSON.stringify({ date }),
    headers: { "Content-Type": "application/json" },
  }));
}
