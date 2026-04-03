/**
 * POST /api/admin/backfill-resultats
 *
 * Rattrapage des résultats pour une plage de dates.
 * Pour chaque date :
 *   1. Scrape Geny pour récupérer les arrivées manquantes
 *   2. Appelle PMU API pour les arrivées restantes
 *   3. Calcule GAGNANT / PARTIEL / PERDANT selon règles Elite Turf
 *   4. Met à jour les pronostics EN_ATTENTE
 *
 * Body JSON : { dateDebut?: "YYYY-MM-DD", dateFin?: "YYYY-MM-DD" }
 * Défaut    : du 2026-03-29 à aujourd'hui
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchPmuResultats } from "@/lib/pmu-api";

export const dynamic  = "force-dynamic";
export const maxDuration = 300; // 5 min max (Vercel Pro)

// ── Helpers date ─────────────────────────────────────────────────────────────

function getTodayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

/** Génère toutes les dates YYYY-MM-DD entre deux dates incluses */
function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00Z");
  const fin = new Date(end   + "T00:00:00Z");
  while (cur <= fin) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// ── Règles Elite Turf ─────────────────────────────────────────────────────────

function calculerResultat(
  selection: number[],
  arrivee: number[],
  typePari: string,
): "GAGNANT" | "PARTIEL" | "PERDANT" {
  const n = selection.length;
  if (n === 0 || arrivee.length === 0) return "PERDANT";

  const tp = typePari.toLowerCase();

  let topN: number;
  if (tp.includes("quinté") || n >= 5) topN = 5;
  else if (tp.includes("quarté") || n >= 4) topN = 4;
  else if (tp.includes("tiercé") || n >= 3) topN = 3;
  else topN = 3; // Simple / Couplé (≤2 chevaux) → top 3

  const arriveeTop = new Set(arrivee.slice(0, topN));
  const hits = selection.filter(c => arriveeTop.has(c)).length;

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
  // topN === 3 (Tiercé / Simple / Couplé)
  if (hits === n) return "GAGNANT";   // tous les chevaux sélectionnés dans le top 3
  if (hits >= 1) return "PARTIEL";    // au moins 1 dans le top 3
  return "PERDANT";
}

// ── Scrape Geny pour une date ────────────────────────────────────────────────

const GENY_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36";

function parseGenyArrivee(html: string): number[] | null {
  const m1 = html.match(/arrivee['":\s]+['"]?([\d][\d\s\-,]+[\d])/i);
  if (m1) {
    const nums = m1[1].split(/[\s\-,]+/).map(Number).filter(n => n > 0 && n < 30);
    if (nums.length >= 3) return nums.slice(0, 5);
  }
  const m2 = html.match(/rrivée\s*:\s*([\d][\d\-]+[\d])/i);
  if (m2) {
    const nums = m2[1].split("-").map(Number).filter(n => n > 0 && n < 30);
    if (nums.length >= 3) return nums.slice(0, 5);
  }
  return null;
}

async function fetchGenyArrivee(
  dateISO: string,
  R: number,
  C: number,
): Promise<number[] | null> {
  const dateStr = dateISO.replace(/-/g, "");
  const r = String(R).padStart(2, "0");
  const c = String(C).padStart(2, "0");
  const url = `https://www.geny.com/resultats-pmu/${dateStr}r${r}c${c}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": GENY_UA, "Accept": "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return parseGenyArrivee(await res.text());
  } catch {
    return null;
  }
}

// ── Route principale ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  let dateDebut = "2026-03-20";
  let dateFin   = getTodayUTC();

  try {
    const body = await req.json().catch(() => ({}));
    if (body.dateDebut) dateDebut = body.dateDebut;
    if (body.dateFin)   dateFin   = body.dateFin;
  } catch { /* ignore */ }

  const dates = dateRange(dateDebut, dateFin);
  const parDate: Record<string, {
    arriveesTrouvees: number;
    pronosticsTraites: number;
    gagnants: number;
    partiels: number;
    perdants: number;
    skipped: number;
    erreurs: number;
  }> = {};

  for (const dateISO of dates) {
    parDate[dateISO] = { arriveesTrouvees: 0, pronosticsTraites: 0, gagnants: 0, partiels: 0, perdants: 0, skipped: 0, erreurs: 0 };
    const stat = parDate[dateISO];

    // ── 1. Récupérer les pronostics EN_ATTENTE de cette date ──────────────
    const { data: pronostics } = await supabase
      .from("pronostics")
      .select(`
        id,
        selection,
        type_pari,
        course:courses (
          id,
          date_course,
          numero_reunion,
          numero_course,
          arrivee_officielle
        )
      `)
      .eq("publie", true)
      .eq("resultat", "EN_ATTENTE");

    if (!pronostics?.length) continue;

    // Filtrer sur la date courante
    const pronosDuJour = pronostics.filter((p: any) => {
      const c = Array.isArray(p.course) ? p.course[0] : p.course;
      return c?.date_course === dateISO;
    });

    if (!pronosDuJour.length) continue;

    // ── 2. Traiter chaque pronostic ────────────────────────────────────────
    for (const prono of pronosDuJour) {
      const courseRaw = prono.course;
      const course = (Array.isArray(courseRaw) ? courseRaw[0] : courseRaw) as any;
      if (!course) { stat.skipped++; continue; }

      try {
        let arrivee: number[] | null = course.arrivee_officielle?.length
          ? course.arrivee_officielle
          : null;

        // ── 2a. Essayer Geny si pas d'arrivée ──────────────────────────
        if (!arrivee) {
          arrivee = await fetchGenyArrivee(dateISO, course.numero_reunion, course.numero_course);
          if (arrivee) stat.arriveesTrouvees++;
        }

        // ── 2b. Fallback PMU API ────────────────────────────────────────
        if (!arrivee) {
          const datePmu = dateISO.replace(/-/g, "");
          const pmuResult = await fetchPmuResultats(datePmu, course.numero_reunion, course.numero_course);
          if (pmuResult?.arrivee?.length) {
            arrivee = pmuResult.arrivee;
            stat.arriveesTrouvees++;
          }
        }

        if (!arrivee) { stat.skipped++; continue; }

        // ── 2c. Sauvegarder l'arrivée dans courses ──────────────────────
        await supabase
          .from("courses")
          .update({ arrivee_officielle: arrivee, statut: "TERMINE" })
          .eq("id", course.id)
          .is("arrivee_officielle", null); // ne pas écraser une vraie arrivée déjà présente

        // ── 2d. Calculer le résultat ────────────────────────────────────
        const selection: number[] = prono.selection ?? [];
        const typePari: string    = prono.type_pari ?? "";
        const resultat = calculerResultat(selection, arrivee, typePari);

        // ── 2e. Mettre à jour le pronostic ──────────────────────────────
        const { error } = await supabase
          .from("pronostics")
          .update({ resultat, arrivee_reelle: arrivee })
          .eq("id", prono.id);

        if (error) {
          stat.erreurs++;
        } else {
          stat.pronosticsTraites++;
          if (resultat === "GAGNANT") stat.gagnants++;
          if (resultat === "PARTIEL") stat.partiels++;
          if (resultat === "PERDANT") stat.perdants++;
        }

      } catch (err: unknown) {
        console.error(`[backfill] Erreur prono ${prono.id} (${dateISO}):`, err);
        stat.erreurs++;
      }
    }
  }

  // ── 3. Stats globales ─────────────────────────────────────────────────────
  const totaux = Object.values(parDate).reduce(
    (acc, s) => ({
      arriveesTrouvees:  acc.arriveesTrouvees  + s.arriveesTrouvees,
      pronosticsTraites: acc.pronosticsTraites + s.pronosticsTraites,
      gagnants:          acc.gagnants          + s.gagnants,
      partiels:          acc.partiels          + s.partiels,
      perdants:          acc.perdants          + s.perdants,
      skipped:           acc.skipped           + s.skipped,
      erreurs:           acc.erreurs           + s.erreurs,
    }),
    { arriveesTrouvees: 0, pronosticsTraites: 0, gagnants: 0, partiels: 0, perdants: 0, skipped: 0, erreurs: 0 },
  );

  // Taux de réussite global
  const { data: allResults } = await supabase
    .from("pronostics")
    .select("resultat")
    .eq("publie", true)
    .neq("resultat", "EN_ATTENTE");

  const totalTermines = allResults?.length ?? 0;
  const totalGagnants = allResults?.filter((p: { resultat: string }) => p.resultat === "GAGNANT").length ?? 0;
  const tauxReussite  = totalTermines > 0 ? Math.round((totalGagnants / totalTermines) * 100) : 0;

  return NextResponse.json({
    ok: true,
    dateDebut,
    dateFin,
    datesTraitees: dates.length,
    parDate,
    ...totaux,
    tauxReussite: `${tauxReussite}%`,
    totalHistorique: totalTermines,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
