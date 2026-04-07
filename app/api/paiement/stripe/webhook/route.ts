/**
 * POST /api/paiement/stripe/webhook
 *
 * Reçoit les événements Stripe (paiement réussi, échoué…)
 * et active l'abonnement dans Supabase.
 *
 * À configurer dans le Dashboard Stripe :
 *   Webhook URL : https://www.elite-turf.fr/api/paiement/stripe/webhook
 *   Événements  : checkout.session.completed, payment_intent.payment_failed
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { templateConfirmationPaiement } from "@/lib/email/templates/confirmation-paiement";

export const dynamic = "force-dynamic";

function getSubscriptionStatus(planNom: string): string {
  if (planNom === "Elite") return "ELITE";
  if (planNom === "Pro" || planNom === "Performance") return "PRO";
  if (planNom === "Starter" || planNom === "Découverte") return "STARTER";
  return "STARTER"; // fallback
}

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature") || "";
  const secret    = process.env.STRIPE_WEBHOOK_SECRET || "";

  if (!secret) {
    console.warn("[Stripe webhook] STRIPE_WEBHOOK_SECRET non configuré");
    return NextResponse.json({ error: "Webhook secret manquant" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-03-31.basil",
    });
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err: any) {
    console.error("[Stripe webhook] Signature invalide:", err?.message);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ── checkout.session.completed ────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session  = event.data.object as Stripe.Checkout.Session;
    const meta     = session.metadata ?? {};
    const userId   = meta.user_id;
    const planId   = meta.plan_id;
    const planNom  = meta.plan_nom;
    const duree    = Number(meta.duree_jours) || 30;
    const txId     = meta.transaction_id;
    const email    = session.customer_email || meta.user_email;

    if (!userId || !planId) {
      console.error("[Stripe webhook] Métadonnées manquantes dans la session");
      return NextResponse.json({ received: true });
    }

    try {
      const now         = new Date();
      const expiration  = new Date(now.getTime() + duree * 24 * 60 * 60 * 1000);
      const statut      = getSubscriptionStatus(planNom);

      // 1. Activer l'abonnement dans profiles
      const { error: updateErr } = await supabase.from("profiles").update({
        statut_abonnement:          statut,
        date_debut_abonnement:      now.toISOString(),
        date_expiration_abonnement: expiration.toISOString(),
        plan_id:                    planId,
      }).eq("id", userId);

      if (updateErr) {
        console.error("[Stripe webhook] Erreur update profiles:", updateErr.message);
        throw new Error("Échec activation abonnement: " + updateErr.message);
      }

      // 2. Marquer la transaction comme réussie
      if (txId) {
        await supabase.from("transactions").update({
          statut:               "REUSSI",
          reference_operateur:  session.payment_intent as string || txId,
        }).eq("reference_operateur", txId);
      }

      // 3. Email de confirmation avec le vrai template
      if (email) {
        // Récupérer le nom complet depuis profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("nom_complet")
          .eq("id", userId)
          .single();

        const planNomAffiche: "Starter" | "Pro" | "Elite" = (planNom === "Starter" || planNom === "Découverte") ? "Starter" : (planNom === "Pro" || planNom === "Performance") ? "Pro" : "Elite";
        const { subject, html } = templateConfirmationPaiement({
          nomComplet:         profile?.nom_complet || email,
          email,
          planNom:            planNomAffiche,
          montantEur:         session.amount_total ? session.amount_total / 100 : 0,
          dateDebut:          now.toISOString(),
          dateFin:            expiration.toISOString(),
          statutAbonnement:   statut as "STARTER" | "PRO" | "ELITE",
        });

        await sendEmail({ to: email, subject, html });
      }

      console.log(`[Stripe webhook] ✅ Abonnement activé: userId=${userId}, plan=${planNom}, expire=${expiration.toISOString()}`);
    } catch (err: any) {
      console.error("[Stripe webhook] Erreur activation:", err?.message);
      return NextResponse.json({ error: "Erreur activation abonnement" }, { status: 500 });
    }
  }

  // ── payment_intent.payment_failed ────────────────────────────────
  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    console.warn("[Stripe webhook] Paiement échoué:", intent.id);

    // Marquer la transaction comme échouée si on trouve une référence
    try {
      await supabase.from("transactions")
        .update({ statut: "ECHOUE" })
        .eq("reference_operateur", intent.metadata?.transaction_id || intent.id);
    } catch { /* ignore */ }
  }

  return NextResponse.json({ received: true });
}
