/**
 * scripts/geny-enrich-cli.ts
 *
 * Enrichissement des partants + COTES depuis Geny, exécuté par GitHub Actions.
 *
 * POURQUOI : depuis le 2026-06-06, Geny.com renvoie HTTP 403 à l'IP datacenter
 * du Worker Cloudflare (anti-bot), donc le cron `enrichir-partants` ne ramène
 * plus aucune cote (silent failure : 403 → 0 partant → "no_data"). Les runners
 * GitHub Actions (IP Azure) reçoivent eux un HTTP 200 normal (vérifié). On
 * déplace donc le scraping ici : gratuit, autonome, IP propre.
 *
 * Réutilise le parser de `lib/geny.ts` (aucune duplication de logique de parse).
 *
 * Env requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Option     : TARGET_DATE=YYYY-MM-DD (défaut : aujourd'hui, UTC)
 */
import { createClient } from "@supabase/supabase-js";
import {
  fetchGenyPartantsWithMeta,
  safeCote,
  safePoids,
  safeSmallInt,
} from "@/lib/geny";
import { isCourseEligible, hasPariNational } from "@/lib/turf/course-eligibility";
import { fetchLonaciPartantsMap } from "@/lib/sync/lonaci-partants";
import { fetchGenybetPartantsMap } from "@/lib/sync/genybet-partants";
import { fetchPmuCotesMap, resolvePmuCote, sameHorse } from "@/lib/cotes/pmu-csv";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const FETCH_TIMEOUT_MS = 8000;
// Geny rate-limite (~10 req puis HTTP 429). On scrape donc en SÉQUENTIEL avec
// un pacing poli + retry/backoff sur les courses vides (souvent un 429 transitoire).
const PACING_MS = 800;
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface CourseRow {
  id: string;
  numero_reunion: number;
  numero_course: number;
  libelle: string;
  statut: string;
  geny_url: string | null;
  date_course: string;
}

async function main(): Promise<void> {
  const targetDate = process.env.TARGET_DATE || new Date().toISOString().split("T")[0];

  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, numero_reunion, numero_course, libelle, statut, geny_url, date_course, nb_partants, paris_disponibles, hippodrome:hippodromes(nom), pronostics(publie)")
    .eq("date_course", targetDate)
    .neq("statut", "ANNULE");
  // NB : on ne filtre PLUS sur geny_url — les courses chargées via PMU/LONACI
  // n'en ont pas, mais doivent quand même être enrichies (par le fallback LONACI).

  if (error) {
    console.error("❌ Query courses :", error.message);
    process.exit(1);
  }

  // Curation : on garde tout (France, Europe, Maghreb, DOM-TOM…) SAUF le
  // lointain étranger (HK, Chili, USA, Australie…) qui n'intéresse pas
  // l'audience — ou toute course pronostiquée (garde-fou).
  const tous = (courses ?? []) as any[];
  const list = tous.filter((c) => {
    const h = Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome;
    const aPronostic = (c.pronostics ?? []).some((p: any) => p.publie);
    return isCourseEligible({
      hippodromeNom: h?.nom,
      nbPartants: c.nb_partants,
      aPronostic,
      aPariNational: hasPariNational(c.paris_disponibles),
    });
  }) as CourseRow[];
  console.log(`Gardées : ${list.length}/${tous.length} courses (hors lointain étranger)`);
  if (list.length === 0) {
    console.log(`ℹ️  Aucune course éligible pour ${targetDate}`);
    return;
  }

  // Sharding : chaque job GitHub Actions (matrix) traite 1/CHUNK_TOTAL des
  // courses depuis SA propre IP Azure. Geny laisse passer ~10 requêtes par IP
  // fraîche avant un HTTP 429 → on garde chaque lot sous ce seuil.
  const chunkTotal = Math.max(1, parseInt(process.env.CHUNK_TOTAL || "1", 10));
  const chunkIndex = Math.max(0, parseInt(process.env.CHUNK_INDEX || "0", 10));
  const slice = chunkTotal <= 1 ? list : list.filter((_, i) => i % chunkTotal === chunkIndex);
  console.log(`Chunk ${chunkIndex + 1}/${chunkTotal} → ${slice.length}/${list.length} courses`);

  // 1. Scrape Geny SÉQUENTIEL avec pacing + retry (anti rate-limit 429).
  const ok: { c: CourseRow; partants: any[] }[] = [];
  for (const c of slice) {
    let partants: any[] = [];
    // Geny seulement si on a une URL (les courses PMU/LONACI n'en ont pas →
    // elles passent directement par le fallback LONACI ci-dessous).
    if (c.geny_url) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const r = await fetchGenyPartantsWithMeta(
            c.date_course, c.numero_reunion, c.numero_course, FETCH_TIMEOUT_MS, c.geny_url,
          );
          partants = r.partants;
        } catch {
          partants = [];
        }
        if (partants.length > 0) break;
        // Vide = souvent un 429 transitoire → backoff croissant avant de réessayer.
        if (attempt < MAX_ATTEMPTS) await sleep(PACING_MS * 2 * attempt);
      }
      await sleep(PACING_MS); // pacing poli entre deux courses Geny
    }
    if (partants.length > 0) ok.push({ c, partants });
  }

  // Fallback LONACI : combler les courses que Geny n'a pas enrichies (429, ou
  // pas de geny_url car chargées via PMU/LONACI). UNE seule requête LONACI pour
  // toutes les courses ; match par (réunion, course). LONACI = jour courant.
  const failed = slice.filter((c) => !ok.some((o) => o.c.id === c.id));
  if (failed.length > 0) {
    try {
      const lonaciMap = await fetchLonaciPartantsMap(targetDate);
      let filled = 0;
      for (const c of failed) {
        const parts = lonaciMap.get(`${c.numero_reunion}|${c.numero_course}`);
        if (parts && parts.length > 0) { ok.push({ c, partants: parts }); filled++; }
      }
      if (filled > 0) console.log(`🔁 Fallback LONACI : ${filled}/${failed.length} courses comblées (cotes)`);
    } catch (e) {
      console.warn(`Fallback LONACI KO : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // GenyBet — deux rôles, un seul passage (1 fetch programme + 1/course voulue) :
  //  (a) SOURCE PRIMAIRE des partants pour les courses SANS aucun partant (Geny
  //      bloqué + LONACI ne relaie pas, ex. J+1) → insertion standalone de la
  //      FORME (nom/jockey/entraîneur/musique/âge/sexe/poids/corde). Pas de cote
  //      (cotes GenyBet = WebSocket, non scrapables) → cote NULL, remplie le
  //      jour J par LONACI. C'est le levier « aperçu J+1 » (SEO).
  //  (b) ENRICHISSEMENT forme des partants LONACI (qui portent la cote mais pas
  //      la musique/forme). Non destructif : ne complète que si champ manquant,
  //      ne touche JAMAIS la cote.
  const stillFailed = slice.filter((c) => !ok.some((o) => o.c.id === c.id));
  const needRich = ok.filter((o) => o.partants.some((g: any) => g.musique == null));
  if (stillFailed.length > 0 || needRich.length > 0) {
    try {
      const wanted = new Set(
        stillFailed.map((c) => `${c.numero_reunion}|${c.numero_course}`)
          .concat(needRich.map((o) => `${o.c.numero_reunion}|${o.c.numero_course}`)),
      );
      const gbMap = await fetchGenybetPartantsMap(targetDate, wanted);

      // (a) primaire : insère les partants GenyBet des courses sans partants
      let gbPrimary = 0;
      for (const c of stillFailed) {
        const parts = gbMap.get(`${c.numero_reunion}|${c.numero_course}`);
        if (parts && parts.length > 0) { ok.push({ c, partants: parts }); gbPrimary++; }
      }
      if (gbPrimary > 0) console.log(`🟢 GenyBet partants (source primaire, sans cote) : ${gbPrimary}/${stillFailed.length} courses`);

      // (b) enrichissement forme sur les partants LONACI existants
      let gbEnriched = 0;
      for (const o of needRich) {
        const rich = gbMap.get(`${o.c.numero_reunion}|${o.c.numero_course}`);
        if (!rich || rich.length === 0) continue;
        const byNum = new Map(rich.map((r) => [r.numPmu, r] as const));
        for (const g of o.partants as any[]) {
          const r = byNum.get(g.numPmu);
          if (!r) continue;
          if (g.musique == null && r.musique != null) g.musique = r.musique;
          if (g.age == null && r.age != null) g.age = r.age;
          if (g.sexe == null && r.sexe != null) g.sexe = r.sexe;
          if (g.poids == null && r.poids != null) g.poids = r.poids;
          if (g.placeCorde == null && r.placeCorde != null) g.placeCorde = r.placeCorde;
          if (!g.jockey?.nom && r.jockey) g.jockey = r.jockey;
          if (!g.entraineur?.nom && r.entraineur) g.entraineur = r.entraineur;
        }
        gbEnriched++;
      }
      if (gbEnriched > 0) console.log(`🔬 Enrichissement GenyBet (forme) : ${gbEnriched}/${needRich.length} courses`);
    } catch (e) {
      console.warn(`GenyBet KO : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Cotes PMU OFFICIELLES (CSV public alimenté par une IP Google, NON bloquée
  // par PMU/Geny) = SOURCE PRIORITAIRE des cotes. On écrase la cote de chaque
  // partant par la cote_directe PMU (repli cote_reference), appariée par
  // (réunion, course, num) + garde-fou nom normalisé (anti-décalage). Course
  // hors CSV (non-PMU, ex. certains Maroc) → cote LONACI conservée en repli.
  // NP ou cote absente → cote NULL (jamais de « 1,2 » inventé — cf. affichage « — »).
  try {
    const pmuCotes = await fetchPmuCotesMap(targetDate); // seulement les cotes du jour ciblé
    if (pmuCotes.size > 0) {
      let fromPmu = 0, mismatch = 0, pending = 0;
      for (const o of ok) {
        for (const g of o.partants as any[]) {
          const row = pmuCotes.get(`${o.c.numero_reunion}|${o.c.numero_course}|${g.numPmu}`);
          if (!row) continue;
          if (!sameHorse(g.nom ?? "", row.cheval)) { mismatch++; continue; }
          const cote = resolvePmuCote(row);          // number | null (NP ou cote pas encore ouverte → null)
          // PARTANT dont la cote PMU n'est pas encore publiée (paris pas ouverts)
          // → on NE l'écrase PAS : on garde la cote existante (LONACI, indicatif).
          if (cote == null && !row.nonPartant) { pending++; continue; }
          g.coteProbable = cote == null ? undefined : cote; // NP → null ; sinon cote PMU
          if (row.nonPartant) g.nonPartant = true;
          fromPmu++;
        }
      }
      console.log(`💶 Cotes PMU (CSV officiel) : ${fromPmu} partants${mismatch ? ` (${mismatch} nom≠)` : ""}${pending ? ` (${pending} cote PMU pas encore ouverte → LONACI)` : ""} — reste = LONACI (indicatif)`);
    } else {
      console.warn("💶 Cotes PMU CSV indisponible → cotes LONACI conservées (repli)");
    }
  } catch (e) {
    console.warn(`💶 Cotes PMU CSV KO : ${e instanceof Error ? e.message : String(e)}`);
  }

  const okIds = ok.map((o) => o.c.id);

  // 2. Bulk delete des partants des courses OK, puis bulk insert (cotes incluses)
  let inserted = 0;
  if (okIds.length > 0) {
    await supabase.from("partants").delete().in("course_id", okIds);

    const rows = ok.flatMap((o) =>
      o.partants
        .filter((g: any) => !g.nom?.toUpperCase().includes("NON_PARTANT"))
        .map((g: any) => ({
          course_id:   o.c.id,
          numero:      g.numPmu,
          nom_cheval:  g.nom,
          jockey:      g.jockey?.nom ?? null,
          entraineur:  g.entraineur?.nom ?? null,
          cote:        safeCote(g.coteProbable),
          musique:     g.musique ?? null,
          poids_kg:    safePoids(g.poids),
          place_corde: safeSmallInt(g.placeCorde, 1, 30),
          age:         safeSmallInt(g.age, 1, 30),
          sexe:        g.sexe ?? null,
          non_partant: g.nonPartant ?? false,
          scraped_at:  new Date().toISOString(),
        })),
    );

    if (rows.length > 0) {
      const { error: insErr, count } = await supabase
        .from("partants")
        .insert(rows, { count: "exact" });
      if (insErr) {
        console.error("❌ Bulk insert :", insErr.message);
        process.exit(1);
      }
      inserted = count ?? rows.length;
    }
  }

  const summary = {
    targetDate,
    chunk: `${chunkIndex + 1}/${chunkTotal}`,
    total: slice.length,
    ok: ok.length,
    no_data: slice.length - ok.length,
    partants_inserted: inserted,
  };
  console.log("✅ RESULT", JSON.stringify(summary));

  // 3. Loud failure : ce lot avait des courses mais 0 enrichie → exit 1 (job
  //    matrix rouge → email GitHub). Signale une IP rate-limitée/bloquée.
  if (slice.length > 0 && ok.length === 0) {
    console.error(`❌ ÉCHEC : 0/${slice.length} course enrichie sur ce lot (IP rate-limitée ?)`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
