import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/consensus?date=YYYY-MM-DD  (auth ADMIN)
 * Lecture programmatique des consensus PUBLIÉS d'une date — servira au futur
 * Track Record public (Phase 3) et à l'archivage automatisé.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const admin = createServiceClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Paramètre date requis (AAAA-MM-JJ)" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("consensus_presse")
    .select("id, date_course, hippodrome, course, type_pari, nb_partants, nb_sources, course_id, partants, resultat, created_at")
    .eq("date_course", date)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[v1/consensus] select", error);
    return NextResponse.json({ error: "Erreur lecture" }, { status: 500 });
  }
  return NextResponse.json({ date, count: (data ?? []).length, consensus: data ?? [] });
}
