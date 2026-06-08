/**
 * lib/cinetpay/client.ts
 *
 * Client minimal de l'API CinetPay (init + check). CinetPay couvre le mobile
 * money de toute la zone UEMOA (Orange Money, MTN, Moov, Wave) — là où Paystack
 * ne fait que la Côte d'Ivoire.
 *
 * ⚠️ À vérifier en SANDBOX (Phase 1) : le format exact des réponses peut varier
 * selon la version de l'API. Tout l'aspect « wire format » est isolé ici.
 *
 * Docs : https://docs.cinetpay.com — endpoints /v2/payment et /v2/payment/check.
 */

const CINETPAY_BASE = "https://api-checkout.cinetpay.com/v2";

export interface CinetPayCheckData {
  status?: string;          // ACCEPTED | REFUSED | PENDING | WAITING_FOR_CUSTOMER
  amount?: number | string;
  currency?: string;
  payment_method?: string;  // ex: OM (Orange Money), MOMO (MTN), WAVECI, FLOOZ (Moov), CARD…
  operator_id?: string;
  payment_date?: string;
  description?: string;
  metadata?: string;
  [k: string]: unknown;
}

function cfg() {
  const apikey = process.env.CINETPAY_API_KEY ?? "";
  const siteId = process.env.CINETPAY_SITE_ID ?? "";
  return { apikey, siteId, ok: Boolean(apikey) && Boolean(siteId) };
}

export function isCinetPayConfigured(): boolean {
  return cfg().ok;
}

/** XOF : CinetPay exige un montant multiple de 5. Arrondi au plus proche. */
export function roundXof(amount: number): number {
  return Math.round(amount / 5) * 5;
}

/**
 * Initialise un paiement CinetPay. Renvoie l'URL de checkout (à laquelle on
 * redirige l'abonné). Le `transactionId` doit être unique (on réutilise notre
 * reference ET-CP-…, stockée dans transactions.reference_operateur).
 */
export async function initCinetPayPayment(params: {
  transactionId: string;
  amountFcfa: number;
  description: string;
  notifyUrl: string;
  returnUrl: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; paymentUrl?: string; error?: string }> {
  const { apikey, siteId, ok } = cfg();
  if (!ok) return { ok: false, error: "CinetPay non configuré (CINETPAY_API_KEY / CINETPAY_SITE_ID)" };

  try {
    const res = await fetch(`${CINETPAY_BASE}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        apikey,
        site_id: siteId,
        transaction_id: params.transactionId,
        amount: roundXof(params.amountFcfa),
        currency: "XOF",
        description: params.description,
        notify_url: params.notifyUrl,
        return_url: params.returnUrl,
        channels: "ALL", // ALL = mobile money + carte ; l'abonné choisit
        lang: "fr",
        customer_name: params.customerName,
        customer_email: params.customerEmail,
        customer_phone_number: params.customerPhone,
        metadata: JSON.stringify(params.metadata ?? {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const json = await res.json().catch(() => null);
    // code "201" = transaction créée
    if (json?.code === "201" && json?.data?.payment_url) {
      return { ok: true, paymentUrl: json.data.payment_url as string };
    }
    return { ok: false, error: json?.message ? `${json.message} (code ${json?.code})` : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Vérifie l'état RÉEL d'une transaction (source de vérité — on ne fait jamais
 * confiance au seul webhook). À appeler depuis le webhook ET le cron recovery.
 */
export async function checkCinetPayTransaction(
  transactionId: string,
): Promise<CinetPayCheckData | null> {
  const { apikey, siteId, ok } = cfg();
  if (!ok) return null;

  try {
    const res = await fetch(`${CINETPAY_BASE}/payment/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ apikey, site_id: siteId, transaction_id: transactionId }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = await res.json().catch(() => null);
    if (!json?.data) return null;
    return json.data as CinetPayCheckData;
  } catch {
    return null;
  }
}
