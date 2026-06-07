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
    .select("id, numero_reunion, numero_course, libelle, statut, geny_url, date_course")
    .eq("date_course", targetDate)
    .neq("statut", "ANNULE")
    .not("geny_url", "is", null);

  if (error) {
    console.error("❌ Query courses :", error.message);
    process.exit(1);
  }

  const list = (courses ?? []) as CourseRow[];
  if (list.length === 0) {
    console.log(`ℹ️  Aucune course avec geny_url pour ${targetDate}`);
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
    if (partants.length > 0) ok.push({ c, partants });
    await sleep(PACING_MS); // pacing poli entre deux courses
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
