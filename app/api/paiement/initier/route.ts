import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";

const CINETPAY_API_URL = "https://api-checkout.cinetpay.com/v2/payment";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const isCinetPayConfigured =
  process.env.CINETPAY_API_KEY &&
  process.env.CINETPAY_API_KEY !== "your_cinetpay_api_key" &&
  process.env.CINETPAY_SITE_ID &&
  process.env.CINETPAY_SITE_ID !== "your_cinetpay_site_id";

export async function POST(req: NextRequest) {
  try {
    const { planId, userId, userEmail } = await req.json();

    // Valider les paramètres
    if (!planId || !userId || !userEmail) {
      return NextResponse.json(
        { error: "Paramètres manquants." },
        { status: 400 }
      );
    }

    // Trouver le plan
    const plan = PLAN_CONFIG.find((p) => p.id === planId);
    if (!plan || !plan.actif) {
      return NextResponse.json(
        { error: "Plan introuvable ou inactif." },
        { status: 404 }
      );
    }

    // Récupérer le profil utilisateur
    const supabase = createServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("nom_complet")
      .eq("id", userId)
      .single();

    const customerName = profile?.nom_complet || userEmail.split("@")[0];

    // Générer un ID de transaction unique
    const transactionId = `ET-${crypto.randomUUID().replace(/-/g, "").substring(0, 16).toUpperCase()}`;

    // Enregistrer la tentative de paiement (best-effort, ne bloque pas le flux)
    try {
      await supabase.from("transactions").insert({
        user_id: userId,
        montant_fcfa: plan.prix_fcfa,
        devise: "XOF",
        methode: "ORANGE_MONEY",
        statut: "EN_ATTENTE",
        reference_operateur: transactionId,
        date_transaction: new Date().toISOString(),
      });
    } catch (dbErr) {
      // La table n'existe peut-être pas encore — on continue quand même
      console.warn("[paiement/initier] Insert transaction ignoré:", dbErr);
    }

    // ── MODE SANDBOX : CinetPay pas encore configuré ─────────────────
    if (!isCinetPayConfigured) {
      const sandboxUrl =
        `${APP_URL}/paiement/sandbox` +
        `?tx=${transactionId}&plan=${planId}&montant=${plan.prix_fcfa}&nom=${encodeURIComponent(plan.nom)}`;
      return NextResponse.json({ paymentUrl: sandboxUrl, transactionId, sandbox: true });
    }

    // ── MODE PRODUCTION : appel CinetPay réel ────────────────────────
    const cinetpayRes = await fetch(CINETPAY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: process.env.CINETPAY_API_KEY,
        site_id: process.env.CINETPAY_SITE_ID,
        transaction_id: transactionId,
        amount: plan.prix_fcfa,
        currency: "XOF",
        description: `Abonnement Plan ${plan.nom} — Elite Turf`,
        return_url: `${APP_URL}/paiement/succes?tx=${transactionId}&plan=${planId}`,
        notify_url: `${APP_URL}/api/paiement/webhook`,
        customer_id: userId,
        customer_name: customerName,
        customer_email: userEmail,
        customer_phone_number: "",
        customer_address: "Abidjan",
        customer_city: "Abidjan",
        customer_country: "CI",
        customer_state: "CI",
        customer_zip_code: "00000",
        channels: "ALL",
        lang: "FR",
        invoice_data: {
          Abonnement: `Plan ${plan.nom}`,
          Durée: `${plan.duree_jours} jours`,
          "Accès VIP": plan.acces_vip ? "Oui" : "Non",
        },
      }),
    });

    const cinetpayData = await cinetpayRes.json();

    if (cinetpayData.code !== "201") {
      console.error("[CinetPay initier] Erreur:", cinetpayData);
      return NextResponse.json(
        {
          error:
            cinetpayData.message ||
            "Erreur lors de l'initialisation du paiement. Réessayez.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      paymentUrl: cinetpayData.data.payment_url,
      transactionId,
    });
  } catch (err) {
    console.error("[API /paiement/initier]", err);
    return NextResponse.json(
      { error: "Erreur serveur interne." },
      { status: 500 }
    );
  }
}
