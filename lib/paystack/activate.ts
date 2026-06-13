import { createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";
import { resolvePlanUuid } from "@/lib/plans/resolve";
import { sendEmail } from "@/lib/email";
import { templateConfirmationPaiement } from "@/lib/email/templates/confirmation-paiement";
import { buildFailureMetadata } from "./failure-metadata";

const PAYSTACK_API_BASE = "https://api.paystack.co";

/**
 * Données minimales d'un paiement Paystack abouti, telles que retournées par
 * /transaction/verify/:reference ou par le webhook charge.success.
 */
export interface PaystackPayment {
  reference: string;
  status: string;            // 'success' attendu pour activer
  channel?: string;           // card, bank, mobile_money, bank_transfer, ussd, qr
  amount?: number;            // en kobo/cents (× 100)
  currency?: string;          // XOF, NGN, etc.
  gateway_response?: string;  // raison lisible Paystack (ex. "Declined", "abandoned")
  paid_at?: string | null;
  authorization?: {
    bank?: string | null;     // mobile money operator parfois
    [k: string]: unknown;
  };
  metadata?: Record<string, unknown> | null;
}

export type ActivationOutcome =
  | { ok: true; alreadyActivated: boolean; abonnementId: string | null }
  | { ok: false; reason: string };

/**
 * Récupère le détail d'un paiement Paystack par reference (utilisé par le cron
 * de recovery pour re-vérifier les transactions EN_ATTENTE).
 */
export async function fetchPaystackTransaction(
  reference: string,
): Promise<PaystackPayment | null> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.warn("[paystack/fetch] PAYSTACK_SECRET_KEY non configurée");
    return null;
  }

  try {
    const res = await fetch(
      `${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      console.warn(`[paystack/fetch] HTTP ${res.status} pour ${reference}`);
      return null;
    }

    const json = (await res.json()) as { status?: boolean; data?: PaystackPayment };
    if (!json.status || !json.data) {
      return null;
    }

    return json.data;
  } catch (err) {
    console.error(`[paystack/fetch] Erreur fetch ${reference}:`, err);
    return null;
  }
}

/**
 * Marque une transaction Paystack ECHEC en stockant la RAISON dans metadata
 * (gateway_response, canal, statut) → échecs auto-explicables côté admin.
 * Utilisé par le cron recovery et l'endpoint recover-stuck.
 */
export async function markPaystackTransactionFailed(payment: PaystackPayment): Promise<void> {
  const supabase = createServiceClient();
  const { data: tx } = await supabase
    .from("transactions")
    .select("metadata")
    .eq("reference_operateur", payment.reference)
    .single();

  await supabase
    .from("transactions")
    .update({
      statut: "ECHEC",
      metadata: buildFailureMetadata(tx?.metadata as Record<string, unknown> | null, payment),
    })
    .eq("reference_operateur", payment.reference);
}

/**
 * Map le canal Paystack vers la valeur enum methode acceptée par notre check
 * constraint sur transactions.methode. Les vraies infos détaillées sont gardées
 * en metadata pour analyse fine.
 */
export function mapPaystackChannelToMethode(
  channel?: string,
  authorizationBank?: string | null,
): "ORANGE_MONEY" | "MTN_MOMO" | "WAVE" | "STRIPE" {
  const c = (channel || "").toLowerCase();
  const bank = (authorizationBank || "").toLowerCase();

  if (c === "mobile_money") {
    if (bank.includes("orange")) return "ORANGE_MONEY";
    if (bank.includes("mtn"))    return "MTN_MOMO";
    if (bank.includes("wave"))   return "WAVE";
    return "ORANGE_MONEY"; // fallback raisonnable
  }
  // card, bank, bank_transfer, ussd, qr → mappés sur STRIPE faute d'enum dédié
  return "STRIPE";
}

/**
 * Active un abonnement à partir d'un paiement Paystack abouti.
 *
 * Logique extraite du webhook (cf app/api/paystack/webhook/route.ts) pour être
 * réutilisée par le cron de recovery polling. Idempotente : si l'abonnement est
 * déjà actif (transaction.statut === 'SUCCES'), retourne sans rien faire.
 *
 * @returns { ok: true, alreadyActivated, abonnementId } ou { ok: false, reason }
 */
export async function activateSubscriptionFromPaystack(
  payment: PaystackPayment,
): Promise<ActivationOutcome> {
  if (payment.status !== "success") {
    return { ok: false, reason: `Statut Paystack non success: ${payment.status}` };
  }

  const supabase = createServiceClient();

  // Récupérer la transaction enregistrée à l'initiation
  const { data: transaction } = await supabase
    .from("transactions")
    .select("*")
    .eq("reference_operateur", payment.reference)
    .single();

  if (!transaction) {
    return { ok: false, reason: `Transaction introuvable pour reference ${payment.reference}` };
  }

  // Idempotence : déjà activé
  if (transaction.statut === "SUCCES") {
    return { ok: true, alreadyActivated: true, abonnementId: transaction.abonnement_id ?? null };
  }

  const metadata = transaction.metadata as { plan_id?: string; plan_nom?: string } | null;
  const plan = PLAN_CONFIG.find((p) => p.id === metadata?.plan_id);

  if (!plan) {
    return { ok: false, reason: `Plan introuvable: ${metadata?.plan_id}` };
  }

  const userId: string = transaction.user_id;
  const now = new Date();
  const dateDebut = now.toISOString();
  const dateFin = new Date(
    now.getTime() + plan.duree_jours * 24 * 60 * 60 * 1000,
  ).toISOString();

  const statutAbonnement: "STARTER" | "PRO" | "ELITE" = plan.acces_elite
    ? "ELITE"
    : plan.id === "starter"
      ? "STARTER"
      : "PRO";

  const methode = mapPaystackChannelToMethode(payment.channel, payment.authorization?.bank);

  // 1. ACTIVER L'ACCÈS D'ABORD (profil) — l'accès ne doit JAMAIS dépendre de la
  //    création de la ligne d'audit `abonnements` (qui peut échouer, ex. plans de
  //    test sans ligne en base). C'est la source de vérité du gating.
  await supabase
    .from("profiles")
    .update({
      statut_abonnement: statutAbonnement,
      date_expiration_abonnement: dateFin,
      plan_id: plan.id,
      date_debut_abonnement: dateDebut,
    })
    .eq("id", userId);

  // 2. Ligne d'audit `abonnements` — BEST-EFFORT (FK UUID → plans résolue).
  //    abonnements.plan_id est un UUID ; insérer l'id texte de PLAN_CONFIG ("elite",
  //    "test-paystack"…) provoquait « invalid input syntax for type uuid » et
  //    faisait échouer toute l'activation (cause racine de abonnements vide).
  let abonnementId: string | null = null;
  const planUuid = await resolvePlanUuid(plan);
  if (planUuid) {
    await supabase
      .from("abonnements")
      .update({ statut: "EXPIRE" })
      .eq("user_id", userId)
      .eq("statut", "ACTIF");

    const { data: newAbonnement, error: abErr } = await supabase
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

    if (abErr) {
      console.error(`[paystack/activate] Insert abonnement non bloquant échoué: ${abErr.message}`);
    } else {
      abonnementId = newAbonnement?.id ?? null;
    }
  } else {
    console.warn(`[paystack/activate] Pas d'UUID plans pour "${plan.nom}" (plan de test ?) → audit abonnement sauté.`);
  }

  // 3. Marquer la transaction SUCCES + enrichir metadata Paystack.
  const enrichedMetadata = {
    ...(transaction.metadata as Record<string, unknown> | null),
    paystack_channel:        payment.channel ?? null,
    paystack_authorization:  payment.authorization ?? null,
    paystack_paid_at:        payment.paid_at ?? null,
  };

  await supabase
    .from("transactions")
    .update({
      statut: "SUCCES",
      methode,
      abonnement_id: abonnementId,
      date_transaction: payment.paid_at ?? now.toISOString(),
      metadata: enrichedMetadata,
    })
    .eq("reference_operateur", payment.reference);

  console.log(
    `[paystack/activate] Abonnement ${plan.nom} activé pour ${userId} jusqu'au ${dateFin} (channel=${payment.channel}, methode=${methode})`,
  );

  // 5. Email de confirmation (best-effort — pas bloquant)
  try {
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email;
    const { data: profile } = await supabase
      .from("profiles")
      .select("nom_complet")
      .eq("id", userId)
      .single();

    if (userEmail) {
      const { subject, html } = templateConfirmationPaiement({
        nomComplet: (profile?.nom_complet as string) || "Champion",
        email: userEmail,
        planNom: plan.nom,
        montantEur: plan.prix_eur,
        dateDebut,
        dateFin,
        statutAbonnement,
      });
      await sendEmail({ to: userEmail, subject, html });
    }
  } catch (emailErr) {
    console.error("[paystack/activate] Email confirmation échoué (non bloquant):", emailErr);
  }

  return { ok: true, alreadyActivated: false, abonnementId };
}
