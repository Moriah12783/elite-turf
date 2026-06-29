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
      .select("course_id, rapport_quinte, rapport_quarte, rapport_tierce")
      .in("course_id", courseIds);
    (arrs ?? []).forEach((a: any) => { rapportByCourse[a.course_id] = a; });
  }

  function rapportFor(typePari: string | null, courseId: string | null): number | null {
    const a = courseId ? rapportByCourse[courseId] : null;
    if (!a) return null;
    if (typePari === "QUINTE_PLUS") return a.rapport_quinte ?? null;
    if (typePari === "QUARTE") return a.rapport_quarte ?? null;
    if (typePari === "TIERCE") return a.rapport_tierce ?? null;
    return null;
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
