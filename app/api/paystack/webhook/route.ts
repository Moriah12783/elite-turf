import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";
import { sendEmail } from "@/lib/email";
import { templateConfirmationPaiement } from "@/lib/email/templates/confirmation-paiement";

export async function GET() {
  return NextResponse.json({ status: "ok", service: "elite-turf-paystack-webhook" });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    // Vérification signature HMAC SHA512
    const signature = req.headers.get("x-paystack-signature");
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
      .update(body)
      .digest("hex");

    if (hash !== signature) {
      console.warn("[Paystack webhook] Signature invalide");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);
    const eventType: string = event.event;
    const data = event.data;

    console.log(`[Paystack webhook] Événement reçu: ${eventType}`);

    // Seul charge.success déclenche l'activation
    if (eventType !== "charge.success") {
      return NextResponse.json({ received: true });
    }

    const reference: string = data.reference;
    const isPaid: boolean = data.status === "success";

    if (!isPaid) {
      return NextResponse.json({ received: true });
    }

    const supabase = createServiceClient();

    // Récupérer la transaction en base
    const { data: transaction } = await supabase
      .from("transactions")
      .select("*")
      .eq("reference_operateur", reference)
      .single();

    if (!transaction) {
      console.warn("[Paystack webhook] Transaction introuvable:", reference);
      return NextResponse.json({ received: true });
    }

    // Idempotence — éviter double activation
    if (transaction.statut === "SUCCES") {
      return NextResponse.json({ received: true });
    }

    const metadata = transaction.metadata as { plan_id?: string; plan_nom?: string };
    const plan = PLAN_CONFIG.find((p) => p.id === metadata?.plan_id);

    if (!plan) {
      console.warn("[Paystack webhook] Plan introuvable:", metadata?.plan_id);
      return NextResponse.json({ received: true });
    }

    const userId: string = transaction.user_id;
    const now = new Date();
    const dateDebut = now.toISOString();
    const dateFin = new Date(
      now.getTime() + plan.duree_jours * 24 * 60 * 60 * 1000
    ).toISOString();

    const statutAbonnement =
      plan.acces_elite ? "ELITE" : plan.id === "starter" ? "STARTER" : "PRO";

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
        plan_id: plan.id,
        date_debut: dateDebut,
        date_fin: dateFin,
        statut: "ACTIF",
        auto_renouvellement: false,
      })
      .select()
      .single();

    // 3. Mettre à jour le profil
    await supabase
      .from("profiles")
      .update({
        statut_abonnement: statutAbonnement,
        date_expiration_abonnement: dateFin,
      })
      .eq("id", userId);

    // 4. Marquer la transaction comme réussie
    await supabase
      .from("transactions")
      .update({
        statut: "SUCCES",
        methode: "STRIPE", // enum carte existant
        abonnement_id: newAbonnement?.id,
        date_transaction: now.toISOString(),
      })
      .eq("reference_operateur", reference);

    console.log(
      `[Paystack webhook] Abonnement ${plan.nom} activé pour ${userId} jusqu'au ${dateFin}`
    );

    // 5. Email de confirmation (best-effort)
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
          statutAbonnement: statutAbonnement as "STARTER" | "PRO" | "ELITE",
        });
        await sendEmail({ to: userEmail, subject, html });
      }
    } catch (emailErr) {
      console.error("[Paystack webhook] Email confirmation échoué:", emailErr);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[API /paystack/webhook]", err);
    // Toujours 200 pour que Paystack ne requeue pas l'événement
    return NextResponse.json({ received: true });
  }
}
