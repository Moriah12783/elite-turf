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
 * Numéro lisible, ex. « +33 6 44 68 67 20 » : celui que l'on dit de vérifier
 * avant de payer (mise en garde contre les faux comptes WhatsApp). Un numéro
 * qui n'est pas français s'affiche tel quel.
 */
export function numeroWhatsappLisible(numero: string = WHATSAPP_SUPPORT_NUMBER): string {
  const m = numero.replace(/[^\d+]/g, "").match(/^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/);
  return m ? `+33 ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : numero;
}

/**
 * URL wa.me prête à l'emploi, avec message pré-rempli optionnel.
 * @example whatsappUrl("Bonjour Elite Turf") → https://wa.me/33644686720?text=...
 */
export function whatsappUrl(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_DIGITS}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Message pré-rempli du bouton flottant, avec la page d'où écrit le visiteur
 * (demande de Steph du 06/10/2026 : savoir d'où viennent les contacts WhatsApp,
 * par exemple des pages pays). Le visiteur le voit et peut le modifier avant
 * d'envoyer. Seul le chemin est repris, jamais les paramètres d'URL.
 */
export function messageWhatsappDepuis(chemin: string | null | undefined): string {
  const page = chemin && chemin !== "/" ? `elite-turf.fr${chemin}` : "elite-turf.fr (accueil)";
  return `Bonjour Elite Turf, je souhaite plus d'informations sur vos pronostics. (Page : ${page})`;
}
