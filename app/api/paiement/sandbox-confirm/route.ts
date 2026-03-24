import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";
import { sendEmail } from "@/lib/email";
import { templateConfirmationPaiement } from "@/lib/email/templates/confirmation-paiement";

// Route sandbox — simule la confirmation CinetPay en dev
// À NE PAS déployer en production avec les vraies clés CinetPay
export async function POST(req: NextRequest) {
  const isSandbox =
    !process.env.CINETPAY_API_KEY ||
    process.env.CINETPAY_API_KEY === "your_cinetpay_api_key";

  if (!isSandbox) {
    return NextResponse.json({ error: "Sandbox désactivé en production." }, { status: 403 });
  }

  try {
    const { transactionId, planId, userId } = await req.json();

    if (!transactionId || !planId || !userId) {
      return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
    }

    const plan = PLAN_CONFIG.find((p) => p.id === planId);
    if (!plan) return NextResponse.json({ error: "Plan introuvable." }, { status: 404 });

    const supabase = createServiceClient();

    const now = new Date();
    const dateFin = new Date(now.getTime() + plan.duree_jours * 24 * 60 * 60 * 1000).toISOString();
    const statutAbonnement = plan.acces_vip ? "VIP" : "PREMIUM";

    // Désactiver anciens abonnements
    await supabase.from("abonnements").update({ statut: "EXPIRE" }).eq("user_id", userId).eq("statut", "ACTIF");

    // Créer le nouvel abonnement
    await supabase.from("abonnements").insert({
      user_id: userId,
      plan_id: planId,
      date_debut: now.toISOString(),
      date_fin: dateFin,
      statut: "ACTIF",
      auto_renouvellement: false,
    });

    // Mettre à jour le profil
    await supabase.from("profiles").update({
      statut_abonnement: statutAbonnement,
      date_expiration_abonnement: dateFin,
    }).eq("id", userId);

    // Mettre à jour la transaction si elle existe
    await supabase.from("transactions").update({
      statut: "SUCCES",
      date_transaction: now.toISOString(),
    }).eq("reference_operateur", transactionId);

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
          dateDebut: now.toISOString(),
          dateFin,
          statutAbonnement: statutAbonnement as "PREMIUM" | "VIP",
        });
        await sendEmail({ to: userEmail, subject, html });
      }
    } catch (emailErr) {
      console.error("[sandbox-confirm] Email confirmation échoué:", emailErr);
    }

    return NextResponse.json({ success: true, statutAbonnement, dateFin });
  } catch (err) {
    console.error("[sandbox-confirm]", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
