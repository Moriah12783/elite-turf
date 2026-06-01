/**
 * lib/sync/lonaci.ts
 *
 * ENRICHISSEUR LONACI (ne cree JAMAIS de course).
 *
 * LONACI relaie surtout des courses francaises (+ Maroc) que Geny synchronise
 * deja. Plutot que d'inserer des courses paralleles (-> doublons, car les noms
 * d'hippodromes LONACI/Geny different sur les accents/format), on RAPPROCHE
 * chaque course LONACI France/Maroc de la course Geny existante (cle canonique
 * anti-accents) et on la marque de facon autoritaire :
 *   - jouable_afrique = true / false
 *   - nationale       = 1/2/3 (NULL sinon)
 *
 * Les courses africaines exclusives (Senegal/CI/Tunisie, absentes de Geny) ne
 * sont PAS publiees (decision produit) -> simplement ignorees.
 *
 * Voir docs/superpowers/specs/2026-05-31-lonaci-enrichissement-dedup-design.md
 */

import { createServiceClient } from "@/lib/supabase/server";
import { fetchLonaciProgramme, normalizeLonaciReunions } from "@/lib/lonaci-api";
import { canonicalHippodrome } from "@/lib/sync/hippodrome-canonical";
import { computeLonaciEnrichment, type EnrichReport } from "@/lib/sync/lonaci-enrich";

// Garde-fou correction "faux positifs" : on ne marque false que si le programme
// LONACI du jour parait complet (assez de reunions + couverture suffisante).
const GUARD = { guardMinReunions: 3, guardMinCoverage: 0.5 };

export interface LonaciSyncResult {
  ok: true;
  date?: string;
  dry_run: boolean;
  report: EnrichReport | null;
  message?: string;
}

export async function runLonaciSync(opts: { dryRun?: boolean } = {}): Promise<LonaciSyncResult> {
  const dryRun = opts.dryRun ?? false;
  const supabase = createServiceClient();

  // 1. Recuperer + normaliser + filtrer France/Maroc (PAS d'africaines exclusives)
  const reunions = await fetchLonaciProgramme();
  const all = normalizeLonaciReunions(reunions);
  const lonaciCourses = all.filter((c) => c.pays === "France" || c.pays === "Maroc");

  if (lonaciCourses.length === 0) {
    return { ok: true, dry_run: dryRun, report: null, message: "Aucune course LONACI France/Maroc" };
  }
  const date = lonaciCourses[0].dateCourse;

  // 2. Map canonique des hippodromes EXISTANTS (aucun INSERT)
  const { data: hips } = await supabase.from("hippodromes").select("id, nom");
  const hippoCanonMap = new Map<string, string>();
  for (const h of (hips ?? []) as Array<{ id: string; nom: string }>) {
    hippoCanonMap.set(canonicalHippodrome(h.nom), h.id);
  }

  // 3. Courses Geny existantes de la date
  const { data: gcs } = await supabase
    .from("courses")
    .select("id, hippodrome_id, numero_reunion, numero_course")
    .eq("date_course", date);
  const genyCourses = (gcs ?? []) as Array<{
    id: string;
    hippodrome_id: string;
    numero_reunion: number;
    numero_course: number;
  }>;

  // 4. Verdicts (fonction pure, testee)
  const { updates, report } = computeLonaciEnrichment(
    {
      date,
      lonaciCourses: lonaciCourses.map((c) => ({
        hippodrome: c.hippodrome,
        nReunion: c.nReunion,
        numeroCourse: c.numeroCourse,
        nationale: c.nationale,
      })),
      genyCourses,
      hippoCanonMap,
    },
    GUARD,
  );

  // 5. Ecriture (sauf dry-run) : UPDATE groupes par (jouable, nationale) -> <= 5 requetes
  if (!dryRun && updates.length > 0) {
    const groups = new Map<string, { jouable_afrique: boolean; nationale: number | null; ids: string[] }>();
    for (const u of updates) {
      const k = `${u.jouable_afrique}|${u.nationale}`;
      const g = groups.get(k) ?? { jouable_afrique: u.jouable_afrique, nationale: u.nationale, ids: [] };
      g.ids.push(u.id);
      groups.set(k, g);
    }
    for (const g of Array.from(groups.values())) {
      await supabase
        .from("courses")
        .update({ jouable_afrique: g.jouable_afrique, nationale: g.nationale })
        .in("id", g.ids);
    }
  }

  console.log(`[LONACI Enrich] ${date} dryRun=${dryRun}`, report);
  return { ok: true, date, dry_run: dryRun, report };
}
