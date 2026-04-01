import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendSMS, formatSMSMessage } from "@/lib/sms";

/** POST /api/sms/send — Envoie une alerte SMS aux abonnés VIP avec numéro de téléphone */
export async function POST(req: NextRequest) {
  // Vérifier que l'appelant est un admin
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

  const { message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message vide" }, { status: 400 });
  }

  // Récupérer tous les abonnés VIP avec un numéro de téléphone
  const { data: destinataires, error } = await adminClient
    .from("profiles")
    .select("id, nom_complet, phone")
    .eq("statut_abonnement", "VIP")
    .not("phone", "is", null)
    .neq("phone", "");

  if (error) {
    return NextResponse.json({ error: "Erreur lecture base de données" }, { status: 500 });
  }

  if (!destinataires || destinataires.length === 0) {
    return NextResponse.json({ envoyes: 0, echecs: 0, message: "Aucun abonné VIP avec numéro de téléphone" });
  }

  const corps = formatSMSMessage(message.trim());

  // Envoi séquentiel (évite de surcharger Twilio en burst)
  const resultats = [];
  for (const dest of destinataires) {
    const result = await sendSMS(dest.phone, corps);
    resultats.push(result);
  }

  const envoyes = resultats.filter(r => !r.error).length;
  const echecs  = resultats.filter(r =>  r.error).length;

  console.log(`[SMS] Envoyés: ${envoyes}, Échecs: ${echecs}`);

  return NextResponse.json({
    envoyes,
    echecs,
    total: destinataires.length,
    message_envoye: corps,
  });
}

/** GET /api/sms/send — Retourne le nombre d'abonnés VIP éligibles */
export async function GET() {
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

  const { count } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("statut_abonnement", "VIP")
    .not("phone", "is", null)
    .neq("phone", "");

  return NextResponse.json({ eligible: count ?? 0 });
}
