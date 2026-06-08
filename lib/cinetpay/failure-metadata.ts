/**
 * lib/cinetpay/failure-metadata.ts
 *
 * Construit la metadata enrichie d'une transaction CinetPay échouée — pur, sans
 * I/O. Stocke une RAISON lisible pour que les échecs soient auto-explicables en
 * admin (comme le pendant Paystack `buildFailureMetadata`).
 */
import type { CinetPayCheckData } from "./client";

export function buildCinetPayFailureMetadata(
  existing: Record<string, unknown> | null | undefined,
  check: CinetPayCheckData,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    cinetpay_status: check.status ?? null,
    cinetpay_method: check.payment_method ?? null,
    echec_raison:
      (check.description as string) ??
      (check.status ? `Paiement ${check.status}` : "Paiement non abouti"),
  };
}
