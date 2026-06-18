/**
 * POST /api/paiement/stripe/webhook
 *
 * Reçoit les événements Stripe et active l'abonnement via le helper partagé
 * `lib/stripe/activate` (réutilisé aussi par le filet de la page de succès).
 *
 * ⚠️ À configurer dans le Dashboard Stripe (sinon AUCUN webhook n'arrive) :
 *   Webhook URL : https://www.elite-turf.fr/api/paiement/stripe/webhook
 *   Événements  : checkout.session.completed, payment_intent.payment_failed,
 *                 invoice.paid, invoice.payment_failed,
 *                 customer.subscription.deleted   ← renouvellement automatique
 *   Puis copier le « Signing secret » dans STRIPE_WEBHOOK_SECRET (Cloudflare).
 *
 * ⚠️ Le renouvellement automatique n'a PAS de page de succès (charge côté
 *   serveur) → il dépend ENTIÈREMENT de invoice.paid. Sans webvent ni secret,
 *   l'accès des abonnés en auto-renew ne serait PAS prolongé (event + secret requis).
 *
 * ⚠️ Cloudflare Workers : la vérification de signature DOIT utiliser
 *   `constructEventAsync` + `createFetchHttpClient()`. La version synchrone
 *   `constructEvent` échoue sur Workers (SubtleCrypto async uniquement) → 400.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import {
  activateSubscriptionFromStripeSession,
  activateRenewalFromInvoice,
} from "@/lib/stripe/activate";
import { isRenewalInvoice, extractSubscriptionId } from "@/lib/stripe/renewal";

export const dynamic = "force-dynamic";

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
      httpClient: Stripe.createFetchHttpClient(),
    });
    // constructEventAsync : indispensable sur Cloudflare Workers (crypto async).
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch (err) {
    console.error("[Stripe webhook] Signature invalide:", (err as Error)?.message);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  // ── checkout.session.completed → activation (helper partagé, idempotent) ──
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const result = await activateSubscriptionFromStripeSession(session);
    if (!result.ok) {
      console.error("[Stripe webhook] Activation échouée:", result.reason);
      return NextResponse.json({ error: "Erreur activation abonnement" }, { status: 500 });
    }
  }

  // ── payment_intent.payment_failed → transaction ECHEC ──
  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    console.warn("[Stripe webhook] Paiement échoué:", intent.id);
    try {
      const supabase = createServiceClient();
      await supabase
        .from("transactions")
        .update({ statut: "ECHEC" }) // "ECHEC" = enum valide (l'ancien "ECHOUE" était rejeté)
        .eq("reference_operateur", intent.metadata?.transaction_id || intent.id);
    } catch {
      /* ignore */
    }
  }

  // ── invoice.paid → RENOUVELLEMENT automatique (prolonge l'accès) ──
  // La 1ʳᵉ facture (billing_reason "subscription_create") est déjà gérée par
  // checkout.session.completed → on ne traite QUE "subscription_cycle".
  // activateRenewalFromInvoice est idempotent (référence stable par facture).
  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    if (isRenewalInvoice(invoice.billing_reason)) {
      const result = await activateRenewalFromInvoice(invoice);
      if (!result.ok) {
        console.error("[Stripe webhook] Renouvellement échoué:", result.reason);
        return NextResponse.json({ error: "Erreur renouvellement" }, { status: 500 });
      }
    }
  }

  // ── customer.subscription.deleted → fin de la reconduction ──
  // L'abonnement Stripe est terminé (annulation arrivée à échéance, ou stoppé).
  // On coupe juste l'auto-renouvellement en base ; l'accès déjà payé reste
  // valable jusqu'à date_fin (aucune coupure brutale).
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    try {
      const supabase = createServiceClient();
      await supabase
        .from("abonnements")
        .update({ auto_renouvellement: false })
        .eq("stripe_subscription_id", sub.id);
    } catch {
      /* ignore */
    }
  }

  // ── invoice.payment_failed → échec de renouvellement (carte refusée) ──
  // Stripe relance automatiquement (dunning) ; on NE coupe PAS l'accès (il
  // expire seul à date_fin). On journalise pour suivi.
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subId = extractSubscriptionId(invoice as never);
    console.warn(
      `[Stripe webhook] Renouvellement refusé sub=${subId ?? "?"} invoice=${invoice.id}`,
    );
  }

  return NextResponse.json({ received: true });
}
