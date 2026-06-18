/**
 * lib/stripe/renewal.ts
 *
 * Helpers PURS (aucune I/O) pour le renouvellement automatique Stripe.
 * Isolés ici pour être testables sans réseau ni base (renewal.test.ts).
 */

/**
 * Stripe émet un `invoice.paid` à CHAQUE cycle. On ne traite comme un
 * RENOUVELLEMENT que `subscription_cycle` : la toute première facture
 * (`subscription_create`) est déjà gérée par `checkout.session.completed`
 * → éviter une double activation / double ligne de transaction.
 */
export function isRenewalInvoice(billingReason: string | null | undefined): boolean {
  return billingReason === "subscription_cycle";
}

/**
 * Référence de transaction stable et idempotente pour une facture de
 * renouvellement : 1 facture Stripe = 1 ligne `transactions` au maximum
 * (si le webhook est rejoué, on retrouve la même référence → on saute).
 */
export function renewalTxRef(invoiceId: string): string {
  return `ET-STRIPE-INV-${invoiceId}`;
}

/**
 * Extrait l'ID de subscription (sub_…) d'une facture Stripe, en gérant les
 * DEUX emplacements selon la version d'API : champ plat `invoice.subscription`
 * (anciennes versions) ou `invoice.parent.subscription_details.subscription`
 * (API « basil » 2025+). Retourne null si la facture n'est pas liée à un
 * abonnement → robuste aux montées de version sans casser le build.
 */
export function extractSubscriptionId(
  invoice:
    | {
        subscription?: unknown;
        parent?: { subscription_details?: { subscription?: unknown } | null } | null;
      }
    | null
    | undefined,
): string | null {
  if (!invoice) return null;
  if (typeof invoice.subscription === "string") return invoice.subscription;
  const nested = invoice.parent?.subscription_details?.subscription;
  return typeof nested === "string" ? nested : null;
}

/** Convertit un timestamp Stripe (secondes UNIX) en ISO 8601, ou null. */
export function unixToISO(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

/**
 * Intervalle Stripe pour un cycle de N jours : « day » × N.
 * On évite « month » (mois calendaire ≠ 30 j) pour coller exactement au
 * discours produit (« accès 7 jours » / « 30 jours ») et garder des cycles
 * déterministes. Starter 7 j → day×7 · Pro/Elite 30 j → day×30.
 */
export function recurringFromDuree(
  dureeJours: number,
): { interval: "day"; interval_count: number } {
  return { interval: "day", interval_count: Math.max(1, Math.round(dureeJours)) };
}
