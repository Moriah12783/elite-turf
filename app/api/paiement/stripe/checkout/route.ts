/**
 * POST /api/paiement/stripe/checkout
 *
 * Crée une session Stripe Checkout et retourne l'URL de paiement.
 * L'utilisateur est redirigé vers la page Stripe hébergée pour payer par carte.
 *
 * Après paiement réussi, Stripe redirige vers /paiement/succes
 * et envoie un webhook à /api/paiement/stripe/webhook pour activer l'abonnement.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

const isStripeConfigured =
  process.env.STRIPE_SECRET_KEY &&
  process.env.STRIPE_SECRET_KEY.startsWith("sk_");

export async function POST(req: NextRequest) {
  try {
    const { planId, userId, userEmail } = await req.json();

    if (!planId || !userId || !userEmail) {
      return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
    }

    const plan = PLAN_CONFIG.find((p) => p.id === planId);
    if (!plan || !plan.actif) {
      return NextResponse.json({ error: "Plan introuvable ou inactif." }, { status: 404 });
    }

    const supabase = createServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("nom_complet")
      .eq("id", userId)
      .single();

    const transactionId = `ET-STRIPE-${crypto.randomUUID().replace(/-/g, "").substring(0, 12).toUpperCase()}`;

    // Enregistrer la tentative
    try {
      await supabase.from("transactions").insert({
        user_id:              userId,
        montant_fcfa:         plan.prix_fcfa,
        devise:               "EUR",
        methode:              "CARTE_BANCAIRE",
        statut:               "EN_ATTENTE",
        reference_operateur:  transactionId,
        date_transaction:     new Date().toISOString(),
      });
    } catch { /* continue */ }

    // ── MODE SANDBOX si Stripe pas configuré ──────────────────────────
    if (!isStripeConfigured) {
      const sandboxUrl =
        `${APP_URL}/paiement/sandbox` +
        `?tx=${transactionId}&plan=${planId}&montant=${plan.prix_fcfa}&nom=${encodeURIComponent(plan.nom)}&methode=stripe`;
      return NextResponse.json({ paymentUrl: sandboxUrl, transactionId, sandbox: true });
    }

    // ── MODE PRODUCTION Stripe ────────────────────────────────────────
    //
    // ⚠️ CRITICAL : `httpClient: Stripe.createFetchHttpClient()` est obligatoire
    // pour que Stripe SDK fonctionne dans Cloudflare Workers. Sans ça, le SDK
    // utilise par défaut `https.request` du module Node qui n'est pas pleinement
    // supporté par le runtime Workers → erreur "An error occurred with our
    // connection to Stripe. Request was retried 2 times." observée le 18/05/2026.
    //
    // Le fetch HTTP client utilise l'API `fetch` native (disponible partout :
    // Workers, Node 18+, browsers). Aucune perte de fonctionnalité.
    //
    // Ref : https://github.com/stripe/stripe-node?tab=readme-ov-file#using-stripe-in-cloudflare-workers
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-03-31.basil",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.create({
      mode:                 "payment",
      payment_method_types: ["card"],
      customer_email:       userEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency:     "eur",
            unit_amount:  Math.round(plan.prix_eur * 100), // en centimes
            product_data: {
              name:        `Elite Turf — Pack ${plan.nom === "Starter" ? "Découverte" : plan.nom === "Pro" ? "Performance" : plan.nom === "Test" ? "Test (1 €)" : "Elite"}`,
              description: `${plan.description} · Accès ${plan.duree_jours} jours`,
              // Logo V2 (fond blanc — adapté à la page Stripe Checkout sur fond blanc)
              images:      [`${APP_URL}/images/logo-v2/logo-square-white-1000.png`],
            },
          },
        },
      ],
      success_url: `${APP_URL}/paiement/succes?tx=${transactionId}&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${APP_URL}/abonnements?cancelled=1`,
      metadata: {
        transaction_id: transactionId,
        plan_id:        planId,
        user_id:        userId,
        user_email:     userEmail,
        plan_nom:       plan.nom,
        duree_jours:    String(plan.duree_jours),
      },
      locale: "fr",
    });

    return NextResponse.json({
      paymentUrl:    session.url,
      transactionId,
      sessionId:     session.id,
    });
  } catch (err: any) {
    console.error("[Stripe checkout]", err?.message);
    return NextResponse.json({ error: "Erreur Stripe: " + err?.message }, { status: 500 });
  }
}
