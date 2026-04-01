import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendSMS, formatSMSMessage } from "@/lib/sms";

/**
 * POST /api/sms/send
 * Envoie une alerte SMS aux abonnés ayant un numéro de téléphone.
 * Body JSON : { message: string, segment: "tous" | "premium" | "vip" }
 *   - "tous"    → PREMIUM + VIP (tous les abonnés payants)
 *   - "premium" → PREMIUM uniquement (Starter + Pro)
 *   - "vip"     → VIP uniquement (Elite)
 */
export async function POST(req: NextRequest) {
  // Auth admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const adminClient = createServiceClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { message, segment = "tous" } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message vide" }, { status: 400 });
  }

  // Construire le filtre selon le segment
  let query = adminClient
    .from("profiles")
    .select("id, nom_complet, phone, statut_abonnement")
    .not("phone", "is", null)
    .neq("phone", "");

  if (segment === "vip") {
    query = query.eq("statut_abonnement", "VIP");
  } else if (segment === "premium") {
    query = query.eq("statut_abonnement", "PREMIUM");
  } else {
    // "tous" = tous les abonnés payants
    query = query.in("statut_abonnement", ["PREMIUM", "VIP"]);
  }

  const { data: destinataires, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Erreur lecture base de données" }, { status: 500 });
  }

  if (!destinataires || destinataires.length === 0) {
    return NextResponse.json({ envoyes: 0, echecs: 0, message: "Aucun abonné éligible avec numéro de téléphone" });
  }

  const corps = formatSMSMessage(message.trim());

  // Envoi séquentiel
  const resultats = [];
  for (const dest of destinataires) {
    const result = await sendSMS(dest.phone, corps);
    resultats.push(result);
  }

  const envoyes = resultats.filter(r => !r.error).length;
  const echecs  = resultats.filter(r =>  r.error).length;

  console.log(`[SMS] Segment: ${segment} — Envoyés: ${envoyes}, Échecs: ${echecs}`);

  return NextResponse.json({
    envoyes,
    echecs,
    total: destinataires.length,
    message_envoye: corps,
  });
}

/**
 * GET /api/sms/send?segment=tous|premium|vip
 * Retourne le nombre d'abonnés éligibles pour chaque segment.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const adminClient = createServiceClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Compter par segment en parallèle
  const [{ count: countTous }, { count: countPremium }, { count: countVip }] = await Promise.all([
    adminClient.from("profiles").select("id", { count: "exact", head: true })
      .in("statut_abonnement", ["PREMIUM", "VIP"]).not("phone", "is", null).neq("phone", ""),
    adminClient.from("profiles").select("id", { count: "exact", head: true })
      .eq("statut_abonnement", "PREMIUM").not("phone", "is", null).neq("phone", ""),
    adminClient.from("profiles").select("id", { count: "exact", head: true })
      .eq("statut_abonnement", "VIP").not("phone", "is", null).neq("phone", ""),
  ]);

  return NextResponse.json({
    tous:    countTous    ?? 0,
    premium: countPremium ?? 0,
    vip:     countVip     ?? 0,
  });
}
