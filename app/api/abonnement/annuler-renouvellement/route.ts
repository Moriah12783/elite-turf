/**
 * POST /api/abonnement/annuler-renouvellement
 *
 * Annule le RENOUVELLEMENT automatique d'un abonnement Stripe de l'utilisateur
 * connecté, via `cancel_at_period_end` : aucun remboursement, aucune coupure —
 * l'accès reste actif jusqu'à la fin de la période déjà payée (date_fin), puis
 * ça s'arrête. Le webhook `customer.subscription.deleted` confirmera à l'échéance.
 *
 * Sécurité : on n'agit QUE sur l'abonnement du user authentifié (jamais un id
 * fourni par le client → pas d'annulation arbitraire d'un autre abonné).
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  // 1. Authentification (cookie de session) — jamais d'id client.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // 2. Abonnement ACTIF récurrent de CE user.
  const service = createServiceClient();
  const { data: ab } = await service
    .from("abonnements")
    .select("id, stripe_subscription_id, date_fin")
    .eq("user_id", user.id)
    .eq("statut", "ACTIF")
    .not("stripe_subscription_id", "is", null)
    .order("date_debut", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ab?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "Aucun renouvellement automatique actif sur votre compte." },
      { status: 404 },
    );
  }

  // 3. Stripe : annuler à la fin de la période (accès gardé jusqu'à date_fin).
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith("sk_")) {
    return NextResponse.json({ error: "Service de paiement indisponible." }, { status: 503 });
  }
  try {
    const stripe = new Stripe(key, {
      apiVersion: "2025-03-31.basil",
      httpClient: Stripe.createFetchHttpClient(),
    });
    await stripe.subscriptions.update(ab.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
  } catch (e) {
    console.error("[annuler-renouvellement]", (e as Error)?.message);
    return NextResponse.json(
      { error: "Erreur lors de l'annulation. Réessayez ou contactez le support." },
      { status: 500 },
    );
  }

  // 4. Refléter immédiatement en base (le webhook confirmera à l'échéance).
  await service
    .from("abonnements")
    .update({ auto_renouvellement: false })
    .eq("id", ab.id);

  return NextResponse.json({ ok: true, dateFin: ab.date_fin });
}
