/**
 * lib/payments/config.ts
 *
 * Aiguillage des providers de paiement.
 *
 * CONSTAT (audit 2026-06-08) : Paystack ne fait du mobile money que sur ~6 pays
 * (dont, en francophone, la SEULE Côte d'Ivoire). 100 % des paiements réussis
 * venaient de CI ; tous les abonnés du Mali / Sénégal / Burkina… tombaient sur
 * un checkout « carte seule » → abandon (« card · transaction not completed »).
 *
 * SOLUTION : CinetPay, qui couvre Orange Money / MTN / Moov / Wave sur toute la
 * zone UEMOA (XOF). Branché à côté de Stripe (carte Europe) et Paystack (CI).
 *
 * Phase 0 : ce flag reste OFF tant que les clés CinetPay (compte + KYC) ne sont
 * pas posées en secrets Worker. Aucun impact prod tant que CINETPAY_AVAILABLE
 * est faux.
 */

/** True dès que les clés CinetPay sont configurées (secrets serveur). */
export const CINETPAY_AVAILABLE =
  !!process.env.CINETPAY_API_KEY && !!process.env.CINETPAY_SITE_ID;

/**
 * Pays (valeur `profiles.pays`) servis par CinetPay en XOF (zone UEMOA).
 * Hors de cette liste → carte bancaire (Stripe). NB : la Réunion (EUR) et
 * l'Europe restent sur Stripe. Les pays CEMAC (XAF : Cameroun, Gabon, Congo,
 * Tchad) nécessiteront `currency: "XAF"` — à ajouter en Phase 1.
 */
export const CINETPAY_COUNTRIES: ReadonlySet<string> = new Set([
  "Côte d'Ivoire",
  "Mali",
  "Sénégal",
  "Burkina Faso",
  "Togo",
  "Bénin",
  "Niger",
  "Guinée-Bissau",
]);

/** Décide si l'abonné (selon son pays) doit passer par CinetPay (mobile money). */
export function shouldUseCinetPay(pays?: string | null): boolean {
  return CINETPAY_AVAILABLE && !!pays && CINETPAY_COUNTRIES.has(pays);
}
