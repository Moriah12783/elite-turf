/**
 * lib/sync/geny-programme.ts
 *
 * Logique de scraping Geny.com + sync Supabase, extraite de
 * /api/geny/programme/route.ts pour être appelable directement
 * (sans fetch HTTP) depuis d'autres endpoints Cloudflare Worker.
 *
 * Pourquoi : Cloudflare Workers interdisent aux Workers de fetch
 * leur propre custom domain (loop de routing → HTTP 522 instantané).
 * Donc force-sync et autres ne peuvent pas appeler /api/geny/programme
 * via fetch ; ils doivent appeler runGenyProgrammeSync() directement.
 */

// ⚠️ Import depuis le module PUR (sans next/headers) pour que ce sync soit
// bundlable en Node sur GitHub Actions (scripts/geny-programme-cli.ts).
import { createServiceClient } from "@/lib/supabase/service-client";
import { todayParisISO, tomorrowParisISO } from "@/lib/paris-date";
import { runPmuProgrammeSync } from "./pmu-programme";
import { runLonaciProgrammeSync } from "./lonaci-programme";
import { runGenybetProgrammeSync } from "./genybet-programme";
import { runGenybetDisciplineSync } from "./genybet-discipline";
import { runPmuDistanceSync } from "./pmu-distance";

// ── Types ──────────────────────────────────────────────────────────────────

export interface GenyCourse {
  reunionNum:       number;
  hippodromeNom:    string;
  hippodromePays:   string;
  courseNum:        number;
  libelle:          string;
  heureDepart:      string | null;
  nbPartants:       number;
  parisDisponibles: string[];
  dateCourse:       string;
  genyUrl:          string | null;
}

export interface GenyProgrammeResult {
  ok:            true;
  date:          string;
  courses:       number;
  filtered_out:  number;
  reunions:      number;
  inserted:      number;
  updated:       number;
  hippodromes:   number;
  message?:      string;
  /** "geny" · "pmu-fallback" · "lonaci-fallback" · "genybet-fallback" (J+1 / filet ultime) */
  source?:       string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

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

function genyUrl(dateISO: string): string {
  // ⚠️ Geny.com fonctionne en heure de Paris ; nos workers Cloudflare en UTC.
  // On compare la date demandée à "aujourd'hui Paris" et "demain Paris" pour
  // éviter le bug de décalage 1-jour entre minuit Paris et 1-2h Paris (où UTC
  // est encore "hier"). Voir lib/paris-date.ts pour le contexte complet.
  if (dateISO === todayParisISO()) return "https://www.geny.com/reunions-courses-pmu/_daujourdhui";
  if (dateISO === tomorrowParisISO()) {
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
  return nom
    .replace(/\s*\(R\d+\)/g, "")
    .replace(/\s*\([^)]+\)\s*$/, "")
    .replace(/\[.*?\]/g, "")
    .trim();
}

function parseHeure(raw: string): string | null {
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

// ── Scraping Geny ──────────────────────────────────────────────────────────

// Timeout + retry sur le fetch upstream Geny.com (defense-in-depth).
// Sans borne explicite, un fetch qui "pend" (Geny lent/instable certains
// soirs) bloquait la route jusqu'au timeout d'origine Cloudflare (~100s),
// renvoyé au caller en "error code: 522". On borne donc chaque tentative et
// on retente 1 fois sur timeout / 5xx / 429 / erreur réseau (mais pas sur un
// 4xx déterministe, inutile à retenter).
const GENY_FETCH_TIMEOUT_MS = 12_000;   // 1 page HTML — large marge
const GENY_FETCH_ATTEMPTS   = 2;        // 1 retry
const GENY_RETRY_DELAY_MS   = 1_500;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchGenyHtml(url: string): Promise<string> {
  let lastError = "";
  for (let attempt = 1; attempt <= GENY_FETCH_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GENY_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":      UA,
          "Accept":          "text/html,application/xhtml+xml",
          "Accept-Language": "fr-FR,fr;q=0.9",
          "Referer":         "https://www.geny.com/",
        },
        cache:  "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) return await res.text();

      // 4xx déterministe (hors 429) → inutile de retenter
      lastError = `Geny HTTP ${res.status} pour ${url}`;
      if (res.status < 500 && res.status !== 429) throw new Error(lastError);
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.message.startsWith("Geny HTTP 4")) throw err;
      lastError = err instanceof Error && err.name === "AbortError"
        ? `Geny timeout après ${GENY_FETCH_TIMEOUT_MS}ms pour ${url}`
        : err instanceof Error ? err.message : String(err);
    }
    if (attempt < GENY_FETCH_ATTEMPTS) await sleep(GENY_RETRY_DELAY_MS);
  }
  throw new Error(`Geny fetch échoué (${GENY_FETCH_ATTEMPTS} tentatives) : ${lastError}`);
}

export async function scrapeGenyProgramme(dateISO: string): Promise<GenyCourse[]> {
  const url = genyUrl(dateISO);
  const html = await fetchGenyHtml(url);
  const courses: GenyCourse[] = [];

  const reunionBlocks = html.split(/<a\s+name="reunion(\d+)"/i);

  for (let i = 1; i < reunionBlocks.length; i += 2) {
    const reunionNum = parseInt(reunionBlocks[i]);
    const block = reunionBlocks[i + 1] || "";

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
      const m = text.match(
        /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*:\s*(.+?)\s*\(R\d+\)/i
      );
      hipNomRaw = m
        ? m[1].trim()
        : text.split(/Jouer|D[ée]but/)[0].replace(/^.*:\s*/, "").trim();
    }
    const hipNom  = cleanHippodromeName(hipNomRaw);
    const hipPays = extractPaysFromHippodrome(hipNomRaw);

    const nomRe = /class="[^"]*nomCourse[^"]*"[^>]*>\s*(\d+)\s*-\s*([^<\r\n]+)/g;
    const nomMatches = Array.from(block.matchAll(nomRe));

    const linkRe = /<a[^>]+class="([^"]*btn(?:Quinte|Multi|Course)[^"]*)"[^>]*href="(\/partants-pmu\/[^"]+)"/g;
    const linkMatches = Array.from(block.matchAll(linkRe));

    const arriveeRe = /class="btnArrivee[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    const arriveeMatches = Array.from(block.matchAll(arriveeRe));

    const count = Math.min(nomMatches.length, linkMatches.length);
    for (let j = 0; j < count; j++) {
      const courseNum   = parseInt(nomMatches[j][1]);
      const libelle     = decodeHtmlEntities(nomMatches[j][2].trim());
      const btnClass    = linkMatches[j][1];
      const genyHref    = linkMatches[j][2];
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

// ── Sync Supabase (bulk) ──────────────────────────────────────────────────

export async function syncCoursesToDB(
  courses: GenyCourse[],
): Promise<{ inserted: number; updated: number; hippodromes: number }> {
  const supabase = createServiceClient();
  const hipNoms  = Array.from(new Set(courses.map((c) => c.hippodromeNom)));
  const hipMap: Record<string, string> = {};

  // 1. Hippodromes — 1 SELECT bulk + 1 INSERT bulk
  const { data: existingHips } = await supabase
    .from("hippodromes")
    .select("id, nom")
    .in("nom", hipNoms);

  for (const hip of existingHips ?? []) {
    hipMap[hip.nom] = hip.id;
  }

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

  // 2. Courses — 1 SELECT bulk + 1 INSERT bulk + 1 UPSERT bulk
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

  const courseKey = (hipId: string, date: string, reunion: number, course: number) =>
    `${hipId}|${date}|${reunion}|${course}`;

  const existingCourseMap = new Map<string, string>();
  for (const c of existingCourses) {
    existingCourseMap.set(
      courseKey(c.hippodrome_id, c.date_course, c.numero_reunion, c.numero_course),
      c.id
    );
  }

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

  if (toInsert.length > 0) {
    await supabase.from("courses").insert(toInsert);
  }
  if (toUpsert.length > 0) {
    await supabase.from("courses").upsert(toUpsert);
  }

  return {
    inserted:    toInsert.length,
    updated:     toUpsert.length,
    hippodromes: Object.keys(hipMap).length,
  };
}

// ── Orchestrateur (utilisable par route handler ET force-sync) ─────────────

/**
 * Lance le scraping Geny + sync Supabase pour une date donnée.
 * Utilisable directement (sans HTTP) depuis un autre endpoint du Worker.
 *
 * @param rawDate "today", "aujourd'hui", "demain", ou "YYYY-MM-DD"
 */
export async function runGenyProgrammeSync(rawDate: string = "today"): Promise<GenyProgrammeResult> {
  // Résolution des keywords "today"/"demain" en heure de PARIS (pas UTC).
  // Sinon Cloudflare Worker (UTC) calcule mal le jour entre minuit-2h Paris.
  const dateISO = rawDate === "today" || rawDate === "aujourd'hui"
    ? todayParisISO()
    : rawDate === "demain"
      ? tomorrowParisISO()
      : rawDate;

  const result = await loadGenyProgramme(dateISO);

  // ── Overlay discipline (correctif « tout en Plat ») ──────────────────────
  // Quelle que soit la source qui a inséré (Geny/PMU/LONACI hard-codent souvent
  // "PLAT"), on rejoue la discipline depuis GenyBet (non bloqué) et on corrige
  // `courses.categorie`. Best-effort : un incident GenyBet ne casse jamais le
  // chargement du programme.
  if (result.courses > 0) {
    try {
      const d = await runGenybetDisciplineSync(dateISO);
      console.log(
        `[Programme] discipline overlay ${dateISO} → ${d.updated} corrigées ` +
        `(${d.matched} matchées, ${d.unmatched_hippodrome + d.unmatched_course} non matchées)`,
      );
    } catch (e) {
      console.warn(`[Programme] discipline overlay KO (${e instanceof Error ? e.message : String(e)}) — categorie non corrigée`);
    }

    // ── Overlay distance (correctif « 0m partout ») ────────────────────────
    // Même mécanisme : Geny et GenyBet insèrent `distance_metres: 0` en dur et
    // rien ne le corrigeait ensuite. L'API PMU (via proxy) fournit la vraie
    // distance. Best-effort et indépendant de l'overlay discipline : si l'un
    // échoue, l'autre s'applique quand même.
    try {
      const d = await runPmuDistanceSync(dateISO);
      console.log(
        `[Programme] distance overlay ${dateISO} → ${d.updated} corrigées ` +
        `(${d.matched} matchées, ${d.unmatched_hippodrome + d.unmatched_course} non matchées, ` +
        `${d.source_sans_distance} sans distance source)`,
      );
    } catch (e) {
      console.warn(`[Programme] distance overlay KO (${e instanceof Error ? e.message : String(e)}) — distance_metres non corrigée`);
    }
  }

  return result;
}

/**
 * Charge le programme d'une date via la chaîne Geny → PMU → LONACI → GenyBet et
 * l'upsert. Extrait de runGenyProgrammeSync pour que l'overlay discipline
 * s'applique APRÈS, quelle que soit la source ayant inséré.
 */
async function loadGenyProgramme(dateISO: string): Promise<GenyProgrammeResult> {
  // Geny bloque désormais l'IP du Worker ET de GitHub Actions (429, constaté
  // 03/07). On tente Geny (données riches), et on BASCULE sur PMU.fr (API
  // officielle via le proxy `pmu-proxy`, non bloquée) si le scrape échoue ou
  // revient vide → le programme se charge quand même.
  let allCourses: GenyCourse[];
  try {
    allCourses = await scrapeGenyProgramme(dateISO);
  } catch (err) {
    console.warn(`[Geny Programme] scrape KO (${err instanceof Error ? err.message : String(err)}) → fallback PMU.fr`);
    return await programmeFallback(dateISO);
  }

  // Filtre : courses françaises et marocaines (jouables via LONACI/PMU-CI)
  const courses = allCourses.filter(
    (c) => c.hippodromePays === "France" || c.hippodromePays === "Maroc"
  );

  if (!courses.length) {
    // Geny a répondu mais 0 course exploitable (structure changée ?) → PMU.fr.
    console.warn(`[Geny Programme] 0 course France/Maroc via Geny pour ${dateISO} → tentative PMU.fr`);
    const pmu = await programmeFallback(dateISO);
    if (pmu.courses > 0) return pmu;
    return {
      ok:            true,
      date:          dateISO,
      message:       `Aucune course France/Maroc trouvée pour ${dateISO} (Geny + PMU.fr)`,
      source:        "pmu-fallback",
      courses:       0,
      filtered_out:  allCourses.length,
      reunions:      0,
      inserted:      0,
      updated:       0,
      hippodromes:   0,
    };
  }

  const result = await syncCoursesToDB(courses);
  console.log(`[Geny Programme] ${dateISO} → ${result.inserted} insérées, ${result.updated} mises à jour`);

  return {
    ok:            true,
    date:          dateISO,
    source:        "geny",
    courses:       courses.length,
    filtered_out:  allCourses.length - courses.length,
    reunions:      Array.from(new Set(courses.map((c) => c.reunionNum))).length,
    ...result,
  };
}

/**
 * Chaîne de secours quand Geny échoue (429/403) ou renvoie 0 course : PMU.fr
 * d'abord (API officielle, données riches), puis LONACI (opérateur africain qui
 * relaie le PMU — accessible même quand PMU direct bloque, constaté le 04/07).
 * Renvoie la 1re source qui charge des courses. Si les 3 sont KO, l'exception (ou
 * 0 course) remonte → la CLI/cron marque l'anomalie (alerte anti-silent-failure).
 */
async function programmeFallback(dateISO: string): Promise<GenyProgrammeResult> {
  const dateStr = dateISO.replace(/-/g, "");

  // 1) PMU.fr (API officielle via le proxy pmu-proxy)
  try {
    const r = await runPmuProgrammeSync(dateStr);
    if (r.courses > 0) {
      console.log(`[Programme] FALLBACK PMU.fr ${dateISO} → ${r.courses} courses (${r.inserted} ins, ${r.updated} maj)`);
      return { ok: true, date: dateISO, source: "pmu-fallback", courses: r.courses, filtered_out: 0, reunions: r.reunions, inserted: r.inserted, updated: r.updated, hippodromes: r.hippodromes };
    }
    console.warn(`[Programme] PMU.fr 0 course pour ${dateISO} → LONACI`);
  } catch (e) {
    console.warn(`[Programme] PMU.fr KO (${e instanceof Error ? e.message : String(e)}) → LONACI`);
  }

  // 2) LONACI (Nationales relayées — couvre surtout le JOUR courant, pas le J+1).
  //    On le garde prioritaire sur GenyBet car il marque correctement le Quinté+
  //    (course vedette) via augmentParisFromNationale.
  try {
    const l = await runLonaciProgrammeSync(dateISO);
    if (l.courses > 0) {
      console.log(`[Programme] FALLBACK LONACI ${dateISO} → ${l.courses} courses (${l.inserted} ins, ${l.updated} maj)`);
      return { ok: true, date: dateISO, source: "lonaci-fallback", courses: l.courses, filtered_out: 0, reunions: l.reunions, inserted: l.inserted, updated: l.updated, hippodromes: l.hippodromes };
    }
    console.warn(`[Programme] LONACI 0 course pour ${dateISO} (ex. J+1 non relayé) → GenyBet`);
  } catch (e) {
    console.warn(`[Programme] LONACI KO (${e instanceof Error ? e.message : String(e)}) → GenyBet`);
  }

  // 3) GenyBet (site betting sœur de Geny, MÊMES données mais domaine NON bloqué)
  //    = dernier filet. Couvre le J+1 que LONACI ne relaie pas, et sert de secours
  //    ultime quand tout le reste est KO. Si GenyBet échoue aussi, l'exception
  //    remonte → la CLI/cron marque l'anomalie (anti-silent-failure).
  const g = await runGenybetProgrammeSync(dateISO);
  console.log(`[Programme] FALLBACK GenyBet ${dateISO} → ${g.courses} courses (${g.inserted} ins, ${g.updated} maj)`);
  return { ok: true, date: dateISO, source: "genybet-fallback", courses: g.courses, filtered_out: g.filteredOut, reunions: g.reunions, inserted: g.inserted, updated: g.updated, hippodromes: g.hippodromes };
}
