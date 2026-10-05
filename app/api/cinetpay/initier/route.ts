import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";
import { initCinetPayPayment, isCinetPayConfigured } from "@/lib/cinetpay/client";

export const dynamic = "force-dynamic";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

/**
 * Initialise un paiement CinetPay (mobile money zone UEMOA : Orange Money,
 * MTN, Moov, Wave). Crée la transaction EN_ATTENTE puis renvoie l'URL de
 * checkout CinetPay. L'activation se fait au webhook (après /check).
 */
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

    if (!isCinetPayConfigured()) {
      // Phase 0 : clés CinetPay pas encore posées → indisponible (pas d'erreur 500).
      return NextResponse.json({ error: "Paiement CinetPay indisponible pour le moment." }, { status: 503 });
    }

    const supabase = createServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("nom_complet, phone")
      .eq("id", userId)
      .single();

    const reference = `ET-CP-${crypto.randomUUID().replace(/-/g, "").substring(0, 14).toUpperCase()}`;

    // Transaction en attente
    try {
      await supabase.from("transactions").insert({
        user_id: userId,
        montant_fcfa: plan.prix_fcfa,
        devise: "XOF",
        methode: "ORANGE_MONEY", // affiné par le webhook selon le moyen réellement utilisé
        statut: "EN_ATTENTE",
        reference_operateur: reference,
        date_transaction: new Date().toISOString(),
        metadata: { plan_id: planId, plan_nom: plan.nom, provider: "cinetpay" },
      });
    } catch (dbErr) {
      console.warn("[cinetpay/initier] Insert transaction ignoré:", dbErr);
    }

    const result = await initCinetPayPayment({
      transactionId: reference,
      amountFcfa: plan.prix_fcfa,
      description: `Abonnement ${plan.nom} - Elite Turf`,
      notifyUrl: `${APP_URL}/api/cinetpay/webhook`,
      returnUrl: `${APP_URL}/paiement/succes?tx=${reference}&plan=${planId}`,
      customerName: (profile?.nom_complet as string) || undefined,
      customerEmail: userEmail,
      customerPhone: (profile?.phone as string) || undefined,
      metadata: { plan_id: planId, user_id: userId },
    });

    if (!result.ok || !result.paymentUrl) {
      console.error("[cinetpay/initier] Échec init:", result.error);
      return NextResponse.json({ error: result.error || "Échec d'initialisation CinetPay." }, { status: 502 });
    }

    return NextResponse.json({ paymentUrl: result.paymentUrl, reference });
  } catch (err) {
    console.error("[cinetpay/initier] Exception:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
