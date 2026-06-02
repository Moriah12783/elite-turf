/**
 * lib/paystack/failure-metadata.ts
 *
 * Construit la metadata enrichie d'une transaction Paystack échouée — pur, sans
 * I/O, pour rester testable et réutilisable (cron recovery + recover-stuck +
 * markPaystackTransactionFailed). Stocke la RAISON lisible (`gateway_response`)
 * + le canal + le statut, pour que les échecs soient auto-explicables en admin.
 */
export function buildFailureMetadata(
  existing: Record<string, unknown> | null | undefined,
  payment: { status: string; channel?: string | null; gateway_response?: string | null },
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    paystack_status:  payment.status,
    paystack_channel: payment.channel ?? null,
    echec_raison:     payment.gateway_response ?? payment.status ?? null,
  };
}
