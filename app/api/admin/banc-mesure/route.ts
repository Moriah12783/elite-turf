import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { aggregate, type AggregateInput } from "@/lib/banc/metrics";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/banc-mesure?days=120
 * Mesure la performance des pronostics PAR SOURCE (méthode) sur la période :
 * lit pronostics (publiés, avec sélection + arrivée) + arrivees (rapport désordre),
 * calcule via lib/banc/metrics → agrégats comparables (vainqueur, couverture,
 * gagnant/partiel/perdant, ROI champ réduit). Isole notamment AI-MULTI-AGENT.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const adminClient = createServiceClient();
  const { data: profile } = await adminClient
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const daysParam = parseInt(req.nextUrl.searchParams.get("days") || "120", 10);
  const days = isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 1000) : 120;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data: pronos, error } = await adminClient
    .from("pronostics")
    .select("course_id, source, type_pari, selection, arrivee_reelle")
    .eq("publie", true)
    .not("selection", "is", null)
    .not("arrivee_reelle", "is", null)
    .gte("date_publication", since);

  if (error) {
    return NextResponse.json({ error: "Erreur lecture base" }, { status: 500 });
  }

  const rows = (pronos ?? []).filter(
    (p: any) => Array.isArray(p.arrivee_reelle) && p.arrivee_reelle.length > 0 && Array.isArray(p.selection),
  );

  // Rapports désordre par course (pour le ROI)
  const seen: Record<string, boolean> = {};
  const courseIds: string[] = [];
  for (const p of rows) {
    if (p.course_id && !seen[p.course_id]) { seen[p.course_id] = true; courseIds.push(p.course_id); }
  }
  const rapportByCourse: Record<string, any> = {};
  if (courseIds.length > 0) {
    const { data: arrs } = await adminClient
      .from("arrivees")
      .select("course_id, rapports_pmu")
      .in("course_id", courseIds);
    (arrs ?? []).forEach((a: any) => { rapportByCourse[a.course_id] = a; });
  }

  /**
   * Rapport DÉSORDRE (champ réduit en désordre) lu depuis le jsonb `rapports_pmu`
   * — c'est le bon outcome pour un champ réduit. On NE lit PAS les colonnes
   * `rapport_*` (qui stockent l'« ordre », servant l'affichage public).
   */
  function rapportFor(typePari: string | null, courseId: string | null): number | null {
    const rp = courseId ? rapportByCourse[courseId]?.rapports_pmu : null;
    if (!rp) return null;
    const key =
      typePari === "QUINTE_PLUS" ? "quinte_plus"
        : typePari === "QUARTE" ? "quarte_plus"
        : typePari === "TIERCE" ? "tierce"
        : null;
    if (!key) return null;
    const d = rp[key]?.desordre;
    const n = typeof d === "number" ? d : Number(d);
    if (!Number.isFinite(n) || n <= 0) return null;
    // Geny rapporte le Quinté+ « pour 2€ » (Tiercé/Quarté+ « pour 1€ ») → on
    // ramène à un multiplicateur « pour 1€ », cohérent avec metrics.ts (unité=1,
    // gain = rapport × unité). Sans ça le ROI Quinté+ serait 2× trop élevé.
    const baseMise = typePari === "QUINTE_PLUS" ? 2 : 1;
    return n / baseMise;
  }

  const bySource: Record<string, AggregateInput[]> = {};
  for (const p of rows) {
    const src = p.source && p.source.trim() ? p.source : "(humain/legacy)";
    (bySource[src] = bySource[src] || []).push({
      selection: p.selection || [],
      arrivee: p.arrivee_reelle || [],
      typePari: p.type_pari || null,
      rapport: rapportFor(p.type_pari, p.course_id),
    });
  }

  const methods = Object.keys(bySource)
    .map((src) => ({ source: src, ...aggregate(bySource[src]) }))
    .sort((a, b) => b.n - a.n);

  return NextResponse.json({ days, total: rows.length, methods });
}
