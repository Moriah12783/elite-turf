import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";
import { sendEmail } from "@/lib/email";
import { templateConfirmationPaiement } from "@/lib/email/templates/confirmation-paiement";

const CINETPAY_CHECK_URL = "https://api-checkout.cinetpay.com/v2/payment/check";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cpm_trans_id } = body; // ID de transaction CinetPay

    if (!cpm_trans_id) {
      return NextResponse.json({ error: "transaction_id manquant" }, { status: 400 });
    }

    // Vérifier le statut du paiement auprès de CinetPay
    const checkRes = await fetch(CINETPAY_CHECK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: process.env.CINETPAY_API_KEY,
        site_id: process.env.CINETPAY_SITE_ID,
        transaction_id: cpm_trans_id,
      }),
    });

    const checkData = await checkRes.json();

    if (checkData.code !== "00") {
      console.warn("[Webhook] Vérification CinetPay échouée:", checkData);
      return NextResponse.json({ received: true });
    }

    const payment = checkData.data;
    const isPaid = payment.status === "ACCEPTED";
    const supabase = createServiceClient();

    // Récupérer la transaction en base
    const { data: transaction } = await supabase
      .from("transactions")
      .select("*")
      .eq("reference_operateur", cpm_trans_id)
      .single();

    if (!transaction) {
      console.warn("[Webhook] Transaction introuvable:", cpm_trans_id);
      return NextResponse.json({ received: true });
    }

    if (!isPaid) {
      // Marquer comme échoué
      await supabase
        .from("transactions")
        .update({ statut: "ECHEC" })
        .eq("reference_operateur", cpm_trans_id);

      return NextResponse.json({ received: true });
    }

    // Paiement accepté — éviter double traitement
    if (transaction.statut === "SUCCES") {
      return NextResponse.json({ received: true });
    }

    const metadata = transaction.metadata as { plan_id?: string; plan_nom?: string };
    const planId = metadata?.plan_id;
    const plan = PLAN_CONFIG.find((p) => p.id === planId);

    if (!plan) {
      console.warn("[Webhook] Plan introuvable:", planId);
      return NextResponse.json({ received: true });
    }

    const userId = transaction.user_id;
    const now = new Date();
    const dateDebut = now.toISOString();
    const dateFin = new Date(
      now.getTime() + plan.duree_jours * 24 * 60 * 60 * 1000
    ).toISOString();

    // Déterminer le statut d'abonnement
    const statutAbonnement = plan.acces_vip ? "VIP" : "PREMIUM";

    // 1. Désactiver les anciens abonnements actifs
    await supabase
      .from("abonnements")
      .update({ statut: "EXPIRE" })
      .eq("user_id", userId)
      .eq("statut", "ACTIF");

    // 2. Créer le nouvel abonnement
    const { data: newAbonnement } = await supabase
      .from("abonnements")
      .insert({
        user_id: userId,
        plan_id: planId,
        date_debut: dateDebut,
        date_fin: dateFin,
        statut: "ACTIF",
        auto_renouvellement: false,
      })
      .select()
      .single();

    // 3. Mettre à jour le statut du profil
    await supabase
      .from("profiles")
      .update({
        statut_abonnement: statutAbonnement,
        date_expiration_abonnement: dateFin,
      })
      .eq("id", userId);

    // 4. Marquer la transaction comme réussie
    const paymentMethodMap: Record<string, string> = {
      ORANGE_MONEY: "ORANGE_MONEY",
      MTN: "MTN_MOMO",
      WAVE: "WAVE",
      VISA: "STRIPE",
      MASTERCARD: "STRIPE",
    };
    const methodKey = (payment.payment_method || "").toUpperCase();
    const methode = paymentMethodMap[methodKey] || "ORANGE_MONEY";

    await supabase
      .from("transactions")
      .update({
        statut: "SUCCES",
        methode,
        abonnement_id: newAbonnement?.id,
        date_transaction: now.toISOString(),
      })
      .eq("reference_operateur", cpm_trans_id);

    console.log(
      `[Webhook] Abonnement ${plan.nom} activé pour ${userId} jusqu'au ${dateFin}`
    );

    // ── Email de confirmation (best-effort) ──
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const userEmail = userData?.user?.email;
      const { data: profile } = await supabase
        .from("profiles")
        .select("nom_complet")
        .eq("id", userId)
        .single();

      if (userEmail) {
        const { subject, html } = templateConfirmationPaiement({
          nomComplet: (profile?.nom_complet as string) || "Champion",
          email: userEmail,
          planNom: plan.nom,
          montantEur: plan.prix_eur,
          dateDebut,
          dateFin,
          statutAbonnement: statutAbonnement as "PREMIUM" | "VIP",
        });
        await sendEmail({ to: userEmail, subject, html });
      }
    } catch (emailErr) {
      console.error("[Webhook] Email confirmation échoué:", emailErr);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[API /paiement/webhook]", err);
    return NextResponse.json({ received: true }); // toujours 200 pour CinetPay
  }
}

// CinetPay peut aussi envoyer un GET pour vérifier que le webhook est disponible
export async function GET() {
  return NextResponse.json({ status: "ok", service: "elite-turf-webhook" });
}
