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
import { recurringFromDuree } from "@/lib/stripe/renewal";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

const isStripeConfigured =
  process.env.STRIPE_SECRET_KEY &&
  process.env.STRIPE_SECRET_KEY.startsWith("sk_");

export async function POST(req: NextRequest) {
  try {
    const { planId, userId, userEmail, autoRenew } = await req.json();

    if (!planId || !userId || !userEmail) {
      return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
    }

    const plan = PLAN_CONFIG.find((p) => p.id === planId);
    if (!plan || !plan.actif) {
      return NextResponse.json({ error: "Plan introuvable ou inactif." }, { status: 404 });
    }

    // Renouvellement automatique (opt-in) : carte/Stripe uniquement, et JAMAIS
    // pour les plans de test (cycle d'1 jour). Case décochée par défaut côté
    // client → le paiement unique reste le comportement par défaut inchangé.
    const subscriptionMode = autoRenew === true && plan.nom !== "Test";

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
        // "STRIPE" = valeur enum valide (transactions_methode_check). L'ancienne
        // valeur "CARTE_BANCAIRE" était rejetée → insert avalé par le try/catch
        // → paiement Stripe absent de l'admin (audit 2026-06-13).
        methode:              "STRIPE",
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

    // Métadonnées communes (lues par lib/stripe/activate à l'activation ET, en
    // mode abonnement, recopiées sur la Subscription pour les renouvellements).
    const sharedMeta = {
      transaction_id: transactionId,
      plan_id:        planId,
      user_id:        userId,
      user_email:     userEmail,
      plan_nom:       plan.nom,
      duree_jours:    String(plan.duree_jours),
    };

    const session = await stripe.checkout.sessions.create({
      // « subscription » = renouvellement automatique opt-in (carte) ;
      // « payment » = paiement unique (défaut historique, sans engagement).
      mode:                 subscriptionMode ? "subscription" : "payment",
      payment_method_types: ["card"],
      // 3D Secure : « automatic » → on LAISSE Stripe Radar décider quand imposer
      // le 3DS, au lieu de le FORCER sur chaque carte. Forcer « any » déclenchait
      // l'OTP banque même sur les cartes prépayées Wave/Orange Money dont
      // l'émetteur gère mal le 3DS → échecs en cascade (8 tentatives 3DS →
      // card_declined observé le 13/06/2026, client Burkina). « automatic »
      // conserve le transfert de responsabilité quand le 3DS se déclenche
      // réellement, sans casser les cartes prépayées légitimes. (Inverse PR #146.)
      payment_method_options: {
        card: { request_three_d_secure: "automatic" },
      },
      customer_email:       userEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency:     "eur",
            unit_amount:  Math.round(plan.prix_eur * 100), // en centimes
            // En mode abonnement : cycle « day × N » (Starter 7 j, Pro/Elite 30 j).
            ...(subscriptionMode ? { recurring: recurringFromDuree(plan.duree_jours) } : {}),
            product_data: {
              name:        `Elite Turf — Pack ${plan.nom === "Starter" ? "Découverte" : plan.nom === "Pro" ? "Performance" : plan.nom === "Test" ? "Test (1 €)" : "Elite"}`,
              description: `${plan.description} · Accès ${plan.duree_jours} jours`,
              // Logo V2 (fond blanc — adapté à la page Stripe Checkout sur fond blanc)
              images:      [`${APP_URL}/images/logo-v2/logo-square-white-1000.png`],
            },
          },
        },
      ],
      // Recopie les métadonnées sur la Subscription → indispensable pour
      // retrouver user_id/plan/durée lors des webhooks de renouvellement.
      ...(subscriptionMode ? { subscription_data: { metadata: sharedMeta } } : {}),
      success_url: `${APP_URL}/paiement/succes?tx=${transactionId}&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${APP_URL}/abonnements?cancelled=1`,
      metadata: {
        ...sharedMeta,
        auto_renew: subscriptionMode ? "1" : "0",
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
