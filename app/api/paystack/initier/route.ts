import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";

const PAYSTACK_API = "https://api.paystack.co/transaction/initialize";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

const isConfigured =
  process.env.PAYSTACK_SECRET_KEY &&
  process.env.PAYSTACK_SECRET_KEY !== "sk_live_xxxxxxxxxxxxxxxx" &&
  process.env.PAYSTACK_SECRET_KEY.startsWith("sk_");

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

    const reference = `ET-PS-${crypto.randomUUID().replace(/-/g, "").substring(0, 14).toUpperCase()}`;

    // Enregistrer la transaction en attente
    try {
      await supabase.from("transactions").insert({
        user_id: userId,
        montant_fcfa: plan.prix_fcfa,
        devise: "XOF",
        methode: "ORANGE_MONEY", // sera mis à jour par le webhook selon le moyen choisi
        statut: "EN_ATTENTE",
        reference_operateur: reference,
        date_transaction: new Date().toISOString(),
        metadata: { plan_id: planId, plan_nom: plan.nom, provider: "paystack" },
      });
    } catch (dbErr) {
      console.warn("[paystack/initier] Insert transaction ignoré:", dbErr);
    }

    // Mode sandbox — Paystack non configuré
    if (!isConfigured) {
      const sandboxUrl =
        `${APP_URL}/paiement/sandbox` +
        `?tx=${reference}&plan=${planId}&montant=${plan.prix_fcfa}&nom=${encodeURIComponent(plan.nom)}`;
      return NextResponse.json({ paymentUrl: sandboxUrl, reference, sandbox: true });
    }

    // Appel Paystack — XOF, montant en unités de base (pas de centimes pour XOF)
    const paystackRes = await fetch(PAYSTACK_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: userEmail,
        amount: plan.prix_fcfa * 100, // Paystack divise toujours par 100 (ex: 42637 → 4263700 → affiche 42 637 XOF)
        currency: "XOF",
        reference,
        callback_url: `${APP_URL}/paiement/succes?tx=${reference}&plan=${planId}`,
        // Ordre = priorité d'affichage dans la checkout Paystack.
        // Marché cible Afrique francophone (>25 % du trafic Clarity) → Mobile
        // Money en PREMIER (Orange Money, MTN, Wave). Carte en fallback pour les
        // clients européens et africains avec CB. bank_transfer en dernier
        // (rarement utilisé en XOF).
        //
        // Incident 5-7 mai 2026 : 13 tentatives "abandoned" toutes en channel
        // "card" parce que le compte Paystack en review limitait à card seul.
        // Compte approuvé le 18/05 → mobile_money réellement disponible.
        channels: ["mobile_money", "card", "bank_transfer"],
        metadata: {
          plan_id: planId,
          plan_nom: plan.nom,
          user_id: userId,
          nom_complet: profile?.nom_complet || "",
          cancel_action: `${APP_URL}/abonnements`,
        },
        label: `Abonnement ${plan.nom} — Elite Turf`,
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status || !paystackData.data?.authorization_url) {
      console.error("[Paystack initier] Erreur:", paystackData);
      return NextResponse.json(
        { error: paystackData.message || "Erreur Paystack. Réessayez." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      paymentUrl: paystackData.data.authorization_url,
      reference,
    });
  } catch (err) {
    console.error("[API /paystack/initier]", err);
    return NextResponse.json({ error: "Erreur serveur interne." }, { status: 500 });
  }
}
