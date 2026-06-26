import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendSMS, formatSMSMessage } from "@/lib/sms";

/**
 * POST /api/sms/send
 * Envoie une alerte SMS aux abonnés ayant un numéro de téléphone.
 * Body JSON : { message: string, segment: "tous" | "premium" | "vip" }
 *   - "tous"    → STARTER + PRO + ELITE (tous les abonnés payants)
 *   - "premium" → pro → PRO uniquement
 *   - "vip"     → ELITE uniquement
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
    .neq("id", user.id)            // ne pas s'auto-envoyer le SMS (admin émetteur = staff → économie crédit Twilio)
    .not("phone", "is", null)
    .neq("phone", "");

  if (segment === "vip") {
    query = query.eq("statut_abonnement", "ELITE");
  } else if (segment === "premium") {
    query = query.in("statut_abonnement", ["STARTER", "PRO"]);
  } else {
    // "tous" = tous les abonnés payants
    query = query.in("statut_abonnement", ["STARTER", "PRO", "ELITE"]);
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

  // Log détaillé des erreurs pour le diagnostic
  const erreursDetail = resultats
    .filter(r => r.error)
    .map(r => ({ to: r.to, error: r.error }));

  console.log(`[SMS] Segment: ${segment} — Envoyés: ${envoyes}, Échecs: ${echecs}`);
  if (erreursDetail.length > 0) {
    console.error("[SMS] Erreurs détaillées:", JSON.stringify(erreursDetail));
  }

  return NextResponse.json({
    envoyes,
    echecs,
    total: destinataires.length,
    message_envoye: corps,
    erreurs: erreursDetail, // remonte les erreurs détaillées au frontend
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
  // .neq("id", user.id) → exclut l'admin émetteur des compteurs (cohérent avec l'envoi)
  const [{ count: countTous }, { count: countPremium }, { count: countVip }] = await Promise.all([
    adminClient.from("profiles").select("id", { count: "exact", head: true }).neq("id", user.id)
      .in("statut_abonnement", ["STARTER", "PRO", "ELITE"]).not("phone", "is", null).neq("phone", ""),
    adminClient.from("profiles").select("id", { count: "exact", head: true }).neq("id", user.id)
      .in("statut_abonnement", ["STARTER", "PRO"]).not("phone", "is", null).neq("phone", ""),
    adminClient.from("profiles").select("id", { count: "exact", head: true }).neq("id", user.id)
      .eq("statut_abonnement", "ELITE").not("phone", "is", null).neq("phone", ""),
  ]);

  return NextResponse.json({
    tous:    countTous    ?? 0,
    premium: countPremium ?? 0,
    vip:     countVip     ?? 0,
  });
}
