/**
 * lib/analytics/track.ts
 *
 * Helper centralisé pour tracker les événements business via Google Tag Manager
 * (container `GTM-PNDV7TKM` configuré dans `app/layout.tsx`).
 *
 * 🎯 Stratégie
 *   GTM expose `window.dataLayer` côté client. Chaque push devient un event
 *   GTM, qu'on peut relayer dans GA4 via un Tag GA4 Event configuré côté GTM
 *   UI (déclencheur = "Custom Event" matchant le nom).
 *
 * 📊 Events Google recommandés implémentés ici (`AARRR + ecommerce`):
 *   - sign_up              → inscription gratuite réussie
 *   - login                → connexion utilisateur existant
 *   - view_pricing         → vue de la page /abonnements
 *   - select_plan          → clic sur un plan dans /abonnements
 *   - begin_checkout       → choix méthode paiement (Mobile Money / CB)
 *   - purchase             → paiement confirmé (avec value + currency)
 *   - generate_lead        → téléchargement guide / lead magnet
 *   - whatsapp_click       → déjà implémenté dans WhatsAppFloatingButton
 *
 * 📜 Doc : https://developers.google.com/tag-platform/gtagjs/reference/events
 *          https://support.google.com/analytics/answer/9267735 (key events)
 *
 * ✅ Safe SSR : check `typeof window !== "undefined"` partout. Aucun event
 *    n'est pushé côté serveur (GTM n'existe pas dans le worker Cloudflare).
 *
 * ⚠️ Pas de PII : ne JAMAIS push d'email, téléphone, nom complet, adresse.
 *    Seuls les IDs anonymes (userId Supabase) et les valeurs métier sont OK.
 */

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export type FunnelEvent =
  | "sign_up"
  | "login"
  | "view_pricing"
  | "select_plan"
  | "begin_checkout"
  | "purchase"
  | "generate_lead"
  | "whatsapp_click"
  | "newsletter_subscribe"
  | "guide_download";

/**
 * Paramètres d'event flexibles. Suit la convention GA4 (snake_case).
 * Quelques params standards GA4 sont typés explicitement pour aider l'auto-complétion.
 */
export interface TrackEventParams {
  /** ID anonyme user Supabase (optionnel — uniquement si authentifié) */
  user_id?: string;
  /** Identifiant interne du plan/produit (ex: "starter", "pro", "elite") */
  plan_id?: string;
  /** Nom plan affiché (ex: "Pack Découverte") */
  plan_name?: string;
  /** Valeur monétaire (GA4 recommande la devise + value pour purchase) */
  value?: number;
  currency?: "EUR" | "XOF" | "USD";
  /** Méthode de paiement (paystack | stripe | sandbox) */
  payment_method?: "paystack" | "stripe" | "sandbox" | "free";
  /** Référence interne de transaction (utile pour réconciliation) */
  transaction_id?: string;
  /** Source de l'event (page d'origine) */
  source?: string;
  /** Autres paramètres custom (catch-all) */
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────
// API publique
// ─────────────────────────────────────────────────────────────────────────

/**
 * Push un event dans le dataLayer GTM (qui le relaie vers GA4 / Meta Pixel / etc.).
 *
 * No-op côté serveur (SSR) → safe à appeler depuis n'importe quel composant
 * (server ou client). En pratique on l'appelle depuis les handlers ou useEffect
 * car les events sont déclenchés par interaction.
 *
 * @example
 * trackEvent("purchase", {
 *   transaction_id: "ET-PS-ABC123",
 *   value: 65,
 *   currency: "EUR",
 *   plan_id: "starter",
 *   payment_method: "paystack",
 * });
 */
export function trackEvent(name: FunnelEvent, params: TrackEventParams = {}): void {
  if (typeof window === "undefined") return;
  if (!Array.isArray(window.dataLayer)) {
    // GTM pas encore chargé — on init le dataLayer pour ne pas perdre l'event
    window.dataLayer = window.dataLayer || [];
  }
  window.dataLayer.push({
    event: name,
    ...params,
  });
}

/**
 * Helper spécialisé pour `purchase` (GA4 ecommerce standard).
 * Adapte automatiquement la devise selon la méthode de paiement
 * (Mobile Money = XOF, Stripe = EUR).
 */
export function trackPurchase(opts: {
  transactionId: string;
  planId: string;
  planName: string;
  amountEur?: number;
  amountFcfa?: number;
  paymentMethod: "paystack" | "stripe" | "sandbox";
  userId?: string;
}): void {
  const isAfricanMM = opts.paymentMethod === "paystack";
  trackEvent("purchase", {
    transaction_id:  opts.transactionId,
    plan_id:         opts.planId,
    plan_name:       opts.planName,
    value:           isAfricanMM ? opts.amountFcfa : opts.amountEur,
    currency:        isAfricanMM ? "XOF" : "EUR",
    payment_method:  opts.paymentMethod,
    user_id:         opts.userId,
    // Items array (convention GA4 ecommerce)
    items: [
      {
        item_id:       opts.planId,
        item_name:     opts.planName,
        item_category: "abonnement",
        price:         isAfricanMM ? opts.amountFcfa : opts.amountEur,
        quantity:      1,
      },
    ],
  });
}
