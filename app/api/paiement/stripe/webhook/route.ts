/**
 * POST /api/paiement/stripe/webhook
 *
 * Reçoit les événements Stripe et active l'abonnement via le helper partagé
 * `lib/stripe/activate` (réutilisé aussi par le filet de la page de succès).
 *
 * ⚠️ À configurer dans le Dashboard Stripe (sinon AUCUN webhook n'arrive) :
 *   Webhook URL : https://www.elite-turf.fr/api/paiement/stripe/webhook
 *   Événements  : checkout.session.completed, payment_intent.payment_failed
 *   Puis copier le « Signing secret » dans STRIPE_WEBHOOK_SECRET (Cloudflare).
 *
 * ⚠️ Cloudflare Workers : la vérification de signature DOIT utiliser
 *   `constructEventAsync` + `createFetchHttpClient()`. La version synchrone
 *   `constructEvent` échoue sur Workers (SubtleCrypto async uniquement) → 400.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { activateSubscriptionFromStripeSession } from "@/lib/stripe/activate";

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

  return NextResponse.json({ received: true });
}
