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

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#0*39;/g, "'")
    .replace(/&#0*34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

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
  genyUrl:       string | null;  // "/partants-pmu/2026-04-23-parislongchamp-pmu-..._c1647206"
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

  // ── 1. Séparer par ancre de réunion ──────────────────────────────────────
  // Structure réelle : <a name="reunionN"> suivi de div.cartoucheReunion
  // puis alternance de div.courseParis / div.courseLiens
  const reunionBlocks = html.split(/<a\s+name="reunion(\d+)"/i);

  for (let i = 1; i < reunionBlocks.length; i += 2) {
    const reunionNum = parseInt(reunionBlocks[i]);
    const block = reunionBlocks[i + 1] || "";

    // ── 2. Hippodrome depuis cartoucheReunion ─────────────────────────────
    // Texte type : "samedi : Vincennes (R1) Début des opérations..."
    //           ou "dimanche : Berlin-Hoppegarten (Allemagne) (R2) Début..."
    const cartoucheMatch = block.match(
      /class="[^"]*cartoucheReunion[^"]*"[^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/
    );
    let hipNomRaw = `Réunion ${reunionNum}`;
    if (cartoucheMatch) {
      const text = cartoucheMatch[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      // Capturer tout entre "jour :" et "(R\d+)"
      const m = text.match(
        /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*:\s*(.+?)\s*\(R\d+\)/i
      );
      hipNomRaw = m
        ? m[1].trim()
        : text.split(/Jouer|D[ée]but/)[0].replace(/^.*:\s*/, "").trim();
    }
    const hipNom = cleanHippodromeName(hipNomRaw);
    const hipPays = extractPaysFromHippodrome(hipNomRaw);

    // ── 3. Numéros et libellés depuis div.nomCourse ───────────────────────
    // HTML : <div class="yui-u first nomCourse">N - Libellé de la course</div>
    const nomRe = /class="[^"]*nomCourse[^"]*"[^>]*>\s*(\d+)\s*-\s*([^<\r\n]+)/g;
    const nomMatches = Array.from(block.matchAll(nomRe));

    // ── 4. Lien partants + classe btn (btnQuinte / btnMulti / btnCourse) ──
    // HTML : <a class=" btnQuinte" href="/partants-pmu/YYYY-MM-DD-..._cID">
    // Un seul lien /partants-pmu/ par course (casaques/cotes ont d'autres href)
    const linkRe = /<a[^>]+class="([^"]*btn(?:Quinte|Multi|Course)[^"]*)"[^>]*href="(\/partants-pmu\/[^"]+)"/g;
    const linkMatches = Array.from(block.matchAll(linkRe));

    // ── 5. Blocs btnArrivee : "9 Partants - 13h58" (futur) ou arrivée ────
    const arriveeRe = /class="btnArrivee[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    const arriveeMatches = Array.from(block.matchAll(arriveeRe));

    // ── 6. Assembler — les 3 tableaux sont dans le même ordre ────────────
    const count = Math.min(nomMatches.length, linkMatches.length);
    for (let j = 0; j < count; j++) {
      const courseNum   = parseInt(nomMatches[j][1]);
      const libelle     = decodeHtmlEntities(nomMatches[j][2].trim());
      const btnClass    = linkMatches[j][1];
      const genyHref    = linkMatches[j][2];  // ex: "/partants-pmu/2026-04-23-parislongchamp-pmu-..._c1647206"
      const arriveeText = (arriveeMatches[j]?.[1] ?? "")
        .replace(/<[^>]+>/g, "")
        .trim();

      courses.push({
        reunionNum,
        hippodromeNom:    hipNom,
        hippodromePays:   hipPays,
        courseNum,
        libelle,
        heureDepart:      parseHeure(arriveeText),
        nbPartants:       parsePartants(arriveeText),
        parisDisponibles: classToParisDisponibles(btnClass),
        dateCourse:       dateISO,
        genyUrl:          genyHref || null,
      });
    }
  }

  return courses;
}

// ── Upsert Supabase ───────────────────────────────────────────────────────

async function syncCoursesToDB(courses: GenyCourse[]) {
  const supabase = createServiceClient();
  const hipNoms  = Array.from(new Set(courses.map(c => c.hippodromeNom)));
  const hipMap: Record<string, string> = {};

  // ── 1. HIPPODROMES — 1 SELECT bulk + 1 INSERT bulk (vs. 2N appels) ────
  // a) Récupère TOUS les hippodromes existants en 1 appel
  const { data: existingHips } = await supabase
    .from("hippodromes")
    .select("id, nom")
    .in("nom", hipNoms);

  for (const hip of existingHips ?? []) {
    hipMap[hip.nom] = hip.id;
  }

  // b) Insère les manquants en 1 appel (bulk insert)
  const missingHips = hipNoms
    .filter((nom) => !hipMap[nom])
    .map((nom) => ({
      nom,
      pays:           courses.find((c) => c.hippodromeNom === nom)?.hippodromePays || "France",
      ville:          nom,
      fuseau_horaire: "Europe/Paris",
      actif:          true,
    }));

  if (missingHips.length > 0) {
    const { data: insertedHips } = await supabase
      .from("hippodromes")
      .insert(missingHips)
      .select("id, nom");
    for (const hip of insertedHips ?? []) {
      hipMap[hip.nom] = hip.id;
    }
  }

  // ── 2. COURSES — 1 SELECT bulk + 1 INSERT bulk + 1 UPSERT bulk ───────
  // a) Récupère TOUTES les courses existantes pour ces dates+hippodromes
  const dates  = Array.from(new Set(courses.map((c) => c.dateCourse)));
  const hipIds = Object.values(hipMap);

  type ExistingCourse = {
    id: string;
    hippodrome_id:  string;
    date_course:    string;
    numero_reunion: number;
    numero_course:  number;
  };

  let existingCourses: ExistingCourse[] = [];
  if (hipIds.length > 0 && dates.length > 0) {
    const { data } = await supabase
      .from("courses")
      .select("id, hippodrome_id, date_course, numero_reunion, numero_course")
      .in("hippodrome_id", hipIds)
      .in("date_course", dates);
    existingCourses = (data as ExistingCourse[]) ?? [];
  }

  // Lookup map "hipId|date|reunion|course" → courseId
  const courseKey = (hipId: string, date: string, reunion: number, course: number) =>
    `${hipId}|${date}|${reunion}|${course}`;

  const existingCourseMap = new Map<string, string>();
  for (const c of existingCourses) {
    existingCourseMap.set(
      courseKey(c.hippodrome_id, c.date_course, c.numero_reunion, c.numero_course),
      c.id
    );
  }

  // b) Sépare en INSERT (nouvelles) vs UPSERT-by-id (existantes)
  const toInsert: Record<string, unknown>[] = [];
  const toUpsert: Record<string, unknown>[] = [];

  for (const c of courses) {
    const hippodromeId = hipMap[c.hippodromeNom];
    if (!hippodromeId) continue;

    const existingId = existingCourseMap.get(
      courseKey(hippodromeId, c.dateCourse, c.reunionNum, c.courseNum)
    );

    if (existingId) {
      toUpsert.push({
        id:                existingId,
        nb_partants:       c.nbPartants,
        libelle:           c.libelle,
        paris_disponibles: c.parisDisponibles,
        ...(c.heureDepart ? { heure_depart: c.heureDepart } : {}),
        ...(c.genyUrl     ? { geny_url: c.genyUrl }         : {}),
      });
    } else {
      toInsert.push({
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
        geny_url:          c.genyUrl || null,
      });
    }
  }

  // c) Bulk INSERT (1 appel)
  if (toInsert.length > 0) {
    await supabase.from("courses").insert(toInsert);
  }

  // d) Bulk UPSERT par PK (1 appel) — Supabase détecte le conflit sur `id` et UPDATE
  if (toUpsert.length > 0) {
    await supabase.from("courses").upsert(toUpsert);
  }

  return {
    inserted:    toInsert.length,
    updated:     toUpsert.length,
    hippodromes: Object.keys(hipMap).length,
  };
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

    const allCourses = await scrapeGenyProgramme(dateISO);

    // Filtre : courses françaises et marocaines (jouables via LONACI/PMU-CI)
    const courses = allCourses.filter(
      c => c.hippodromePays === "France" || c.hippodromePays === "Maroc"
    );

    if (!courses.length) {
      return NextResponse.json({
        ok: true,
        message: `Aucune course France/Maroc trouvée pour ${dateISO}`,
        inserted: 0,
        filtered_out: allCourses.length,
      });
    }

    const result = await syncCoursesToDB(courses);
    console.log(`[Geny Programme] ${dateISO} → ${result.inserted} insérées, ${result.updated} mises à jour`);

    return NextResponse.json({
      ok:           true,
      date:         dateISO,
      courses:      courses.length,
      filtered_out: allCourses.length - courses.length,
      reunions:     Array.from(new Set(courses.map(c => c.reunionNum))).length,
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
