/**
 * lib/constants/whatsapp.ts
 *
 * Numéro WhatsApp support OFFICIEL — SOURCE UNIQUE. Voir docs/audit-sprint1.md P3.
 * Décision Sprint 1 : un seul canal client = +33 6 44 68 67 20 (644686720).
 * Surchargeable via NEXT_PUBLIC_WHATSAPP (déjà = +33644686720 en prod).
 *
 * NB : l'ancienne bascule WABA (NEXT_PUBLIC_USE_WABA_API_NUMBER) est retirée —
 * un seul numéro est servi partout.
 */

export const WHATSAPP_SUPPORT_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP || "+33644686720").trim();

/** Numéro en chiffres seuls (format wa.me), ex: "33644686720". */
export const WHATSAPP_DIGITS = WHATSAPP_SUPPORT_NUMBER.replace(/\D/g, "");

/**
 * URL wa.me prête à l'emploi, avec message pré-rempli optionnel.
 * @example whatsappUrl("Bonjour Elite Turf") → https://wa.me/33644686720?text=...
 */
export function whatsappUrl(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_DIGITS}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
