import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/newsletter/counts
 * Retourne le nombre de destinataires par segment newsletter.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const adminClient = createServiceClient();
  const { data: profile } = await adminClient
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const [
    { count: countProspects },
    { count: countActifs },
    { count: countElite },
  ] = await Promise.all([
    // Prospects = leads table (guide gratuit, pas encore abonné)
    adminClient.from("leads").select("id", { count: "exact", head: true }),
    // Actifs = PREMIUM (Découverte + Performance)
    adminClient.from("profiles").select("id", { count: "exact", head: true })
      .eq("statut_abonnement", "PREMIUM"),
    // Elite = VIP
    adminClient.from("profiles").select("id", { count: "exact", head: true })
      .eq("statut_abonnement", "VIP"),
  ]);

  return NextResponse.json({
    prospects: countProspects ?? 0,
    actifs:    countActifs    ?? 0,
    elite:     countElite     ?? 0,
    tous:      (countProspects ?? 0) + (countActifs ?? 0) + (countElite ?? 0),
  });
}
