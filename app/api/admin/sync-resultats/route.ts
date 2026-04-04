/**
 * POST /api/admin/sync-resultats
 *
 * Met à jour automatiquement le résultat (GAGNANT / PARTIEL / PERDANT)
 * de tous les pronostics EN_ATTENTE dont la course est passée.
 *
 * Logique PMU standard (désordre) :
 *   - Quinté+  : 5 chevaux → 5/5 = GAGNANT | 3-4/5 = PARTIEL | <3 = PERDANT
 *   - Quarté+  : 4 chevaux → 4/4 = GAGNANT | 3/4   = PARTIEL | <3 = PERDANT
 *   - Tiercé   : 3 chevaux → 3/3 = GAGNANT | 2/3   = PARTIEL | <2 = PERDANT
 *   - Autre    : N chevaux → N/N = GAGNANT | ≥60%  = PARTIEL | sinon PERDANT
 *
 * Sécurisé par Authorization: Bearer CRON_SECRET (ou admin auth)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchPmuResultats } from "@/lib/pmu-api";
import { logCronStart } from "@/lib/cron-logger";

type CourseJoin = {
  id: string;
  date_course: string;
  numero_reunion: number;
  numero_course: number;
  statut: string;
  arrivee_officielle: number[] | null;
};

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Pro : 60s max

const CRON_SECRET = process.env.CRON_SECRET || "";

// ── Calcul du résultat selon règles Elite Turf ────────────────────────────
//
//  Quinté+ (5 chevaux)  : 5/5 dans le top 5 = GAGNANT | 3-4/5 = PARTIEL | <3 = PERDANT
//  Quarté+ (4 chevaux)  : 4/4 dans le top 4 = GAGNANT | 3/4   = PARTIEL | <3 = PERDANT
//  Tiercé  (3 chevaux)  : 3/3 dans le top 3 = GAGNANT | 2/3   = PARTIEL | <2 = PERDANT
//  Simple/Couplé (≤2)   : tous dans le top 3 = GAGNANT | partiel si ≥1 = PARTIEL
//
function calculerResultat(
  selection: number[],   // chevaux sélectionnés par l'expert
  arrivee: number[],     // arrivée officielle PMU
  typePari: string,      // "Tiercé", "Quarté+", "Quinté+", "Simple", "Couplé"…
): "GAGNANT" | "PARTIEL" | "PERDANT" {
  const n = selection.length;
  if (n === 0 || arrivee.length === 0) return "PERDANT";

  const tp = typePari.toLowerCase();

  // Nombre de positions à comparer selon le type de pari
  let topN: number;
  if (tp.includes("quinté") || n >= 5) topN = 5;
  else if (tp.includes("quarté") || n >= 4) topN = 4;
  else if (tp.includes("tiercé") || n >= 3) topN = 3;
  else topN = 3; // Simple / Couplé (≤2 chevaux) → on vérifie dans le top 3

  // Les topN premiers de l'arrivée officielle
  const arriveeTop = new Set(arrivee.slice(0, topN));

  // Combien de chevaux de la sélection sont dans le top
  const hits = selection.filter((cheval) => arriveeTop.has(cheval)).length;

  // Seuils selon le nombre de chevaux dans la sélection
  if (topN === 5) {
    if (hits === 5) return "GAGNANT";
    if (hits >= 3) return "PARTIEL";
    return "PERDANT";
  }
  if (topN === 4) {
    if (hits === 4) return "GAGNANT";
    if (hits >= 3) return "PARTIEL";
    return "PERDANT";
  }
  if (topN === 3) {
    if (hits === n) return "GAGNANT";   // tous les chevaux sélectionnés sont dans le top 3
    if (hits >= 1) return "PARTIEL";    // au moins 1 dans le top 3
    return "PERDANT";
  }
  // Fallback générique
  if (hits === n) return "GAGNANT";
  if (hits / n >= 0.5) return "PARTIEL";
  return "PERDANT";
}

// ── Route principale ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const logger = logCronStart("resultats-pronostics");

  const supabase = createServiceClient();
  const now = new Date();
  const todayISO = now.toISOString().split("T")[0]; // YYYY-MM-DD

  // ── 1. Récupérer tous les pronostics EN_ATTENTE avec leur course ──────
  const { data: pronostics, error: fetchErr } = await supabase
    .from("pronostics")
    .select(`
      id,
      selection,
      type_pari,
      resultat,
      course:courses (
        id,
        date_course,
        numero_reunion,
        numero_course,
        statut,
        arrivee_officielle
      )
    `)
    .eq("resultat", "EN_ATTENTE")
    .eq("publie", true);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const stats = {
    total: pronostics?.length ?? 0,
    traites: 0,
    gagnants: 0,
    partiels: 0,
    perdants: 0,
    erreurs: 0,
    skipped: 0,
  };

  if (!pronostics || pronostics.length === 0) {
    return NextResponse.json({ ok: true, message: "Aucun pronostic EN_ATTENTE", ...stats });
  }

  // ── 2. Traiter chaque pronostic ───────────────────────────────────────
  for (const prono of pronostics) {
    // Supabase renvoie la jointure course:courses(...) comme un tableau ou un objet
    const courseRaw = prono.course;
    const course: CourseJoin | null = Array.isArray(courseRaw)
      ? (courseRaw[0] as CourseJoin ?? null)
      : (courseRaw as unknown as CourseJoin ?? null);

    // Ignorer si pas de course associée ou course pas encore passée
    if (!course || !course.date_course) {
      stats.skipped++;
      continue;
    }

    // Ignorer si la course est dans le futur (date > aujourd'hui)
    // Les courses d'aujourd'hui sont incluses — PMU retournera null si pas encore terminées
    if (course.date_course > todayISO) {
      stats.skipped++;
      continue;
    }

    try {
      let arriveeOfficielle: number[] | null = course.arrivee_officielle;
      let pmuResultCache: Awaited<ReturnType<typeof fetchPmuResultats>> = null;

      // Si la course n'a pas encore d'arrivée enregistrée → appel API PMU
      if (!arriveeOfficielle || arriveeOfficielle.length === 0) {
        const datePmu = course.date_course.replace(/-/g, ""); // YYYYMMDD
        const pmuResult = await fetchPmuResultats(
          datePmu,
          course.numero_reunion,
          course.numero_course,
        );

        if (pmuResult && pmuResult.arrivee.length > 0) {
          arriveeOfficielle = pmuResult.arrivee;
          pmuResultCache = pmuResult;

          // Sauvegarder l'arrivée dans la table courses pour les prochains appels
          await supabase
            .from("courses")
            .update({
              arrivee_officielle: arriveeOfficielle,
              statut: "TERMINE",
            })
            .eq("id", course.id);
        }
      } else {
        // L'arrivée était déjà en base → on récupère quand même les rapports PMU
        const datePmu = course.date_course.replace(/-/g, "");
        pmuResultCache = await fetchPmuResultats(
          datePmu,
          course.numero_reunion,
          course.numero_course,
        );
      }

      // Si toujours pas d'arrivée disponible → skip (résultats pas encore publiés)
      if (!arriveeOfficielle || arriveeOfficielle.length === 0) {
        stats.skipped++;
        continue;
      }

      // ── 3. Calculer le résultat ────────────────────────────────────
      const selection: number[] = prono.selection ?? [];
      const typePari: string    = prono.type_pari ?? "";

      const resultat = calculerResultat(selection, arriveeOfficielle, typePari);

      // ── 3b. Extraire le rapport gagnant réel (dividende PMU) ───────
      // On récupère le rapport Quinté+ / Quarté+ / Tiercé depuis pmuResult.rapports
      let rapportGagnant: number | null = null;
      if (resultat !== "PERDANT" && pmuResultCache) {
        const typesOrdonnes = ["QUINTE_PLUS", "QUARTE_PLUS", "TIERCE", "COUPLE_GAGNANT", "SIMPLE_GAGNANT"];
        const typeNorm = typePari.toUpperCase().replace(/[^A-Z_]/g, "").replace("QUARTE$", "QUARTE_PLUS");
        // Cherche le rapport correspondant au type de pari joué
        const rapportMatch = pmuResultCache.rapports?.find(
          (r) => r.typePari === typePari.toUpperCase() ||
                 r.typePari === typeNorm ||
                 typesOrdonnes.some((t) => t === r.typePari && t.includes(typeNorm.split("_")[0]))
        );
        if (rapportMatch?.dividendes && rapportMatch.dividendes.length > 0) {
          // PMU exprime les rapports en centimes × 10 → diviser par 10 pour €/1€ misé
          const rawRapport = rapportMatch.dividendes[0].rapport;
          rapportGagnant = rawRapport > 100 ? Math.round(rawRapport / 10 * 100) / 100 : rawRapport;
        }
      }

      // ── 4. Mettre à jour le pronostic ─────────────────────────────
      const updatePayload: Record<string, unknown> = {
        resultat,
        arrivee_reelle: arriveeOfficielle,
      };
      if (rapportGagnant !== null) {
        updatePayload.rapport_gagnant = rapportGagnant;
      }

      const { error: updateErr } = await supabase
        .from("pronostics")
        .update(updatePayload)
        .eq("id", prono.id);

      if (updateErr) {
        console.error(`[sync-resultats] Erreur update prono ${prono.id}:`, updateErr);
        stats.erreurs++;
      } else {
        stats.traites++;
        if (resultat === "GAGNANT")  stats.gagnants++;
        if (resultat === "PARTIEL")  stats.partiels++;
        if (resultat === "PERDANT")  stats.perdants++;
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[sync-resultats] Erreur prono ${prono.id}:`, message);
      stats.erreurs++;
    }
  }

  // ── 5. Calculer le taux de réussite global ───────────────────────────
  const { data: allResults } = await supabase
    .from("pronostics")
    .select("resultat")
    .eq("publie", true)
    .neq("resultat", "EN_ATTENTE");

  const totalTermines = allResults?.length ?? 0;
  const totalGagnants = allResults?.filter((p: { resultat: string }) => p.resultat === "GAGNANT").length ?? 0;
  const tauxReussite  = totalTermines > 0
    ? Math.round((totalGagnants / totalTermines) * 100)
    : 0;

  await logger.finish("success", { ...stats, tauxReussite: `${tauxReussite}%` });

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    ...stats,
    tauxReussite: `${tauxReussite}%`,
    totalHistorique: totalTermines,
  });
}

// Aussi accessible en GET pour le cron Vercel
export async function GET(req: NextRequest) {
  return POST(req);
}
