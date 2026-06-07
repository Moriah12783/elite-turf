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

const CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 8000;

interface CourseRow {
  id: string;
  numero_reunion: number;
  numero_course: number;
  libelle: string;
  statut: string;
  geny_url: string | null;
  date_course: string;
}

/** Pool de N workers concurrents (lecture seule). */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let cur = 0;
  async function run(): Promise<void> {
    while (true) {
      const i = cur++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
  return out;
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

  // 1. Scrape Geny en parallèle (IP GitHub → 200)
  const outcomes = await pool(list, CONCURRENCY, async (c) => {
    try {
      const { partants } = await fetchGenyPartantsWithMeta(
        c.date_course,
        c.numero_reunion,
        c.numero_course,
        FETCH_TIMEOUT_MS,
        c.geny_url,
      );
      return { c, partants };
    } catch {
      return { c, partants: [] as any[] };
    }
  });

  const ok = outcomes.filter((o) => o.partants.length > 0);
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
    total: list.length,
    ok: ok.length,
    no_data: list.length - ok.length,
    partants_inserted: inserted,
  };
  console.log("✅ RESULT", JSON.stringify(summary));

  // 3. Loud failure : 0 course enrichie alors qu'il y en avait → exit 1.
  //    GitHub Actions envoie alors un email au propriétaire du repo (alerte
  //    anti-silent-failure gratuite). Signifierait que Geny bloque aussi l'IP
  //    GitHub → il faudrait basculer sur une autre source.
  if (ok.length === 0) {
    console.error(`❌ ÉCHEC : 0/${list.length} course enrichie (Geny bloque-t-il l'IP GitHub ?)`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
