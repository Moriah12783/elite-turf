import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";
import { resolvePlanUuid } from "@/lib/plans/resolve";
import { sendEmail } from "@/lib/email";
import { templateConfirmationPaiement } from "@/lib/email/templates/confirmation-paiement";

export interface StripeActivationResult {
  ok: boolean;
  reason?: string;
  alreadyActivated?: boolean;
}

function getSubscriptionStatus(planNom: string): "STARTER" | "PRO" | "ELITE" {
  if (planNom === "Elite") return "ELITE";
  if (planNom === "Pro" || planNom === "Performance") return "PRO";
  return "STARTER";
}

/**
 * Active un abonnement à partir d'une Checkout Session Stripe PAYÉE.
 *
 * Réutilisé par le webhook Stripe ET par le filet de la page de succès
 * (defense-in-depth : l'activation ne doit pas dépendre uniquement du webhook).
 *
 * Principes (audit 2026-06-13) :
 *  - ACCÈS d'abord : on met à jour `profiles` (source de vérité du gating) avant
 *    toute autre opération ; l'accès ne dépend jamais de la ligne d'audit.
 *  - `abonnements` (FK UUID → plans) en best-effort, avec UUID résolu.
 *  - Idempotent : si la transaction liée est déjà SUCCES, on ne refait rien.
 *  - On n'écrase PAS `reference_operateur` (référence stable ET-STRIPE-…).
 */
export async function activateSubscriptionFromStripeSession(
  session: Stripe.Checkout.Session,
): Promise<StripeActivationResult> {
  const meta = session.metadata ?? {};
  const userId = meta.user_id;
  const planId = meta.plan_id;
  const planNom = meta.plan_nom || "";
  const duree = Number(meta.duree_jours) || 30;
  const txId = meta.transaction_id;
  const email = session.customer_email || meta.user_email || undefined;

  if (!userId || !planId) {
    return { ok: false, reason: "Métadonnées manquantes (user_id/plan_id)" };
  }

  const supabase = createServiceClient();
  const plan = PLAN_CONFIG.find((p) => p.id === planId);

  // Idempotence : transaction déjà marquée SUCCES → ne pas réactiver.
  if (txId) {
    const { data: tx } = await supabase
      .from("transactions")
      .select("statut")
      .eq("reference_operateur", txId)
      .maybeSingle();
    if (tx?.statut === "SUCCES") {
      return { ok: true, alreadyActivated: true };
    }
  }

  const now = new Date();
  const dateDebut = now.toISOString();
  const dateFin = new Date(now.getTime() + duree * 24 * 60 * 60 * 1000).toISOString();
  const statut = getSubscriptionStatus(planNom);

  // 1. ACCÈS d'abord (profil) — étape critique.
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      statut_abonnement: statut,
      date_debut_abonnement: dateDebut,
      date_expiration_abonnement: dateFin,
      plan_id: planId,
    })
    .eq("id", userId);
  if (updateErr) {
    return { ok: false, reason: `update profiles: ${updateErr.message}` };
  }

  // 2. Ligne d'audit `abonnements` — best-effort (FK UUID résolue).
  let abonnementId: string | null = null;
  if (plan) {
    const planUuid = await resolvePlanUuid(plan);
    if (planUuid) {
      await supabase
        .from("abonnements")
        .update({ statut: "EXPIRE" })
        .eq("user_id", userId)
        .eq("statut", "ACTIF");

      const { data: ab, error: abErr } = await supabase
        .from("abonnements")
        .insert({
          user_id: userId,
          plan_id: planUuid,
          date_debut: dateDebut,
          date_fin: dateFin,
          statut: "ACTIF",
          auto_renouvellement: false,
        })
        .select()
        .single();

      if (abErr) console.error(`[stripe/activate] abonnement non bloquant: ${abErr.message}`);
      else abonnementId = ab?.id ?? null;
    }
  }

  // 3. Transaction SUCCES (sans écraser reference_operateur).
  if (txId) {
    await supabase
      .from("transactions")
      .update({
        statut: "SUCCES",
        abonnement_id: abonnementId,
        metadata: {
          provider: "stripe",
          stripe_session: session.id,
          stripe_payment_intent: (session.payment_intent as string) ?? null,
        },
      })
      .eq("reference_operateur", txId);
  }

  // 4. Email de confirmation (best-effort).
  try {
    if (email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nom_complet")
        .eq("id", userId)
        .single();

      const planNomAffiche: "Starter" | "Pro" | "Elite" =
        statut === "ELITE" ? "Elite" : statut === "PRO" ? "Pro" : "Starter";

      const { subject, html } = templateConfirmationPaiement({
        nomComplet: (profile?.nom_complet as string) || email,
        email,
        planNom: planNomAffiche,
        montantEur: session.amount_total ? session.amount_total / 100 : plan?.prix_eur ?? 0,
        dateDebut,
        dateFin,
        statutAbonnement: statut,
      });
      await sendEmail({ to: email, subject, html });
    }
  } catch (e) {
    console.error("[stripe/activate] email non bloquant:", e);
  }

  console.log(`[stripe/activate] ✅ Activé userId=${userId} plan=${planNom} expire=${dateFin}`);
  return { ok: true, alreadyActivated: false };
}

/**
 * Récupère une Checkout Session par id et l'active si `payment_status === "paid"`.
 * Filet appelé par la page de succès au cas où le webhook ne passe pas.
 */
export async function verifyAndActivateStripe(
  sessionId: string,
): Promise<StripeActivationResult> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith("sk_")) return { ok: false, reason: "Stripe non configuré" };

  try {
    const stripe = new Stripe(key, {
      apiVersion: "2025-03-31.basil",
      httpClient: Stripe.createFetchHttpClient(),
    });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return { ok: false, reason: `payment_status=${session.payment_status}` };
    }
    return await activateSubscriptionFromStripeSession(session);
  } catch (e) {
    return { ok: false, reason: (e as Error)?.message || "retrieve session échoué" };
  }
}
