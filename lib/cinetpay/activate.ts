/**
 * lib/cinetpay/activate.ts
 *
 * Activation d'abonnement depuis un paiement CinetPay vérifié. Mappe la réponse
 * /check de CinetPay vers le cœur d'activation partagé (lib/payments/activate-core).
 */
import { createServiceClient } from "@/lib/supabase/server";
import {
  activateSubscriptionCore,
  type ActivationOutcome,
  type Methode,
} from "@/lib/payments/activate-core";
import { buildCinetPayFailureMetadata } from "./failure-metadata";
import type { CinetPayCheckData } from "./client";

/** Mappe le moyen de paiement CinetPay vers l'enum `transactions.methode`. */
export function mapCinetPayMethode(paymentMethod?: string): Methode {
  const m = (paymentMethod || "").toUpperCase();
  if (m.includes("OM") || m.includes("ORANGE")) return "ORANGE_MONEY";
  if (m.includes("MOMO") || m.includes("MTN")) return "MTN_MOMO";
  if (m.includes("WAVE")) return "WAVE";
  if (m.includes("FLOOZ") || m.includes("MOOV")) return "ORANGE_MONEY"; // pas d'enum dédié → fallback
  return "STRIPE"; // carte & autres
}

/** Active l'abonnement si la transaction CinetPay est ACCEPTED. */
export async function activateSubscriptionFromCinetPay(
  transactionId: string,
  check: CinetPayCheckData,
): Promise<ActivationOutcome> {
  if (check.status !== "ACCEPTED") {
    return { ok: false, reason: `Statut CinetPay non ACCEPTED: ${check.status}` };
  }
  return activateSubscriptionCore({
    reference: transactionId,
    methode: mapCinetPayMethode(check.payment_method),
    paidAt: (check.payment_date as string) ?? null,
    providerMeta: {
      cinetpay_status: check.status ?? null,
      cinetpay_method: check.payment_method ?? null,
      cinetpay_operator: (check.operator_id as string) ?? null,
      cinetpay_payment_date: (check.payment_date as string) ?? null,
    },
  });
}

/** Marque une transaction CinetPay ECHEC + stocke la raison lisible. */
export async function markCinetPayTransactionFailed(
  transactionId: string,
  check: CinetPayCheckData,
): Promise<void> {
  const supabase = createServiceClient();
  const { data: tx } = await supabase
    .from("transactions")
    .select("metadata")
    .eq("reference_operateur", transactionId)
    .single();

  await supabase
    .from("transactions")
    .update({
      statut: "ECHEC",
      metadata: buildCinetPayFailureMetadata(tx?.metadata as Record<string, unknown> | null, check),
    })
    .eq("reference_operateur", transactionId);
}
