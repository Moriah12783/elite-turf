/**
 * lib/sync/seo-etl.ts — Logique ETL partagée pour peupler/rafraîchir les
 * tables chevaux/jockeys/entraineurs.
 *
 * Appelée depuis :
 *   - /api/admin/seo-etl   (one-shot navigateur ADMIN ou cron Bearer)
 *   - /api/cron/seo-etl    (cron daily — direct call, pas self-fetch)
 *
 * Pourquoi pas un self-fetch entre cron→admin : Cloudflare Workers fait des
 * loops self-fetch qui timeout en 522. Le pattern direct-call évite ça.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { slugify } from "@/lib/seo/slugs";

export type EntiteType = "chevaux" | "jockeys" | "entraineurs";

const COL_MAP: Record<EntiteType, "nom_cheval" | "jockey" | "entraineur"> = {
  chevaux:     "nom_cheval",
  jockeys:     "jockey",
  entraineurs: "entraineur",
};

export interface EtlResult {
  entite:           EntiteType;
  noms_distincts:   number;
  insert_or_update: number;
  errors:           number;
}

export interface EtlOptions {
  entites?: EntiteType[];
  dryRun?:  boolean;
}

/** Récupère noms distincts d'une colonne partants + count + derniere date. */
async function aggregateNames(
  supabase: ReturnType<typeof createServiceClient>,
  col: "nom_cheval" | "jockey" | "entraineur",
): Promise<Map<string, { nb_courses: number; derniere: string | null }>> {
  const map = new Map<string, { nb_courses: number; derniere: string | null }>();
  const PAGE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("partants")
      .select(`${col}, course:courses(date_course)`)
      .not(col, "is", null)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`aggregate ${col}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data as any[]) {
      const nom = row[col];
      if (!nom || typeof nom !== "string") continue;
      const trimmed = nom.trim();
      if (!trimmed) continue;
      const date = row.course?.date_course ?? null;
      const prev = map.get(trimmed);
      if (!prev) {
        map.set(trimmed, { nb_courses: 1, derniere: date });
      } else {
        prev.nb_courses += 1;
        if (date && (!prev.derniere || date > prev.derniere)) prev.derniere = date;
      }
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

/** Calcule victoires + top3 en agrégeant partants × arrivee_officielle. */
async function computeWinStats(
  supabase: ReturnType<typeof createServiceClient>,
  col: "nom_cheval" | "jockey" | "entraineur",
): Promise<Map<string, { victoires: number; places: number }>> {
  const map = new Map<string, { victoires: number; places: number }>();
  const PAGE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("partants")
      .select(`numero, ${col}, course:courses!inner(arrivee_officielle, statut)`)
      .not(col, "is", null)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`win-stats ${col}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data as any[]) {
      const nom = (row[col] as string | null)?.trim();
      if (!nom) continue;
      const arr = row.course?.arrivee_officielle;
      if (row.course?.statut !== "TERMINE" || !Array.isArray(arr) || arr.length === 0) continue;

      const numero = row.numero;
      const idxArr = arr.indexOf(numero);
      if (idxArr === -1) continue;

      const prev = map.get(nom) ?? { victoires: 0, places: 0 };
      if (idxArr === 0) prev.victoires += 1;
      if (idxArr <  3) prev.places    += 1;
      map.set(nom, prev);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

async function upsertEntites(
  supabase: ReturnType<typeof createServiceClient>,
  table: EntiteType,
  rows: Array<{
    nom: string;
    slug: string;
    nb_courses: number;
    nb_victoires: number;
    nb_places: number;
    derniere_course_at: string | null;
  }>,
  dryRun: boolean,
): Promise<{ inserted: number; errors: number }> {
  if (rows.length === 0 || dryRun) return { inserted: 0, errors: 0 };

  // Dé-duplication par slug : si 2 noms produisent le même slug, on garde
  // celui avec le plus de courses (proxy de "version la plus utilisée").
  const bySlug = new Map<string, typeof rows[number]>();
  for (const r of rows) {
    const prev = bySlug.get(r.slug);
    if (!prev || r.nb_courses > prev.nb_courses) bySlug.set(r.slug, r);
  }
  const deduped = Array.from(bySlug.values());

  const CHUNK = 500;
  let inserted = 0;
  let errors   = 0;
  for (let i = 0; i < deduped.length; i += CHUNK) {
    const chunk = deduped.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: "slug", count: "exact" });
    if (error) {
      logger.error("seo-etl", `Upsert ${table} failed`, {
        error: error.message, batch_start: i, batch_size: chunk.length,
      });
      errors += chunk.length;
    } else {
      inserted += count ?? chunk.length;
    }
  }
  return { inserted, errors };
}

async function processEntite(
  supabase: ReturnType<typeof createServiceClient>,
  entite: EntiteType,
  dryRun: boolean,
): Promise<EtlResult> {
  const col = COL_MAP[entite];
  const nomsMap = await aggregateNames(supabase, col);
  const winsMap = await computeWinStats(supabase, col);

  const rows = Array.from(nomsMap.entries())
    .map(([nom, { nb_courses, derniere }]) => {
      const w = winsMap.get(nom) ?? { victoires: 0, places: 0 };
      return {
        nom,
        slug:               slugify(nom),
        nb_courses,
        nb_victoires:       w.victoires,
        nb_places:          w.places,
        derniere_course_at: derniere,
      };
    })
    .filter((r) => r.slug.length > 0);

  const { inserted, errors } = await upsertEntites(supabase, entite, rows, dryRun);

  return {
    entite,
    noms_distincts:   nomsMap.size,
    insert_or_update: inserted,
    errors,
  };
}

/** Lance l'ETL pour un ou plusieurs types d'entités. Séquentiel pour rester
 *  sous les 50 subrequests Cloudflare Workers Free.
 */
export async function runSeoEtl(opts: EtlOptions = {}): Promise<{
  ok: true; results: EtlResult[]; dry_run: boolean; elapsed_ms: number;
}> {
  const entites = opts.entites && opts.entites.length > 0
    ? opts.entites
    : (["chevaux", "jockeys", "entraineurs"] as EntiteType[]);
  const dryRun = opts.dryRun ?? false;

  const supabase = createServiceClient();
  const start = Date.now();
  const results: EtlResult[] = [];
  for (const e of entites) {
    results.push(await processEntite(supabase, e, dryRun));
  }
  return { ok: true, results, dry_run: dryRun, elapsed_ms: Date.now() - start };
}
