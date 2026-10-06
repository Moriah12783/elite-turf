/**
 * Paiement par Orange Money ou Wave — SOURCE UNIQUE (pays, montants, message).
 *
 * Ouvert le 06/10/2026 : Steph dispose désormais de comptes Orange Money et
 * Wave en Côte d'Ivoire, au Mali, au Burkina Faso et au Sénégal. Parcours
 * choisi par Steph :
 *   1. le visiteur écrit sur le WhatsApp officiel (message pré-rempli : formule,
 *      montant, pays) ;
 *   2. Steph lui répond avec le numéro et le montant — AUCUN numéro de paiement
 *      n'est publié sur le site ;
 *   3. dès réception, Steph envoie un reçu sur WhatsApp ; l'accès est activé à
 *      la main, en base (aucun formulaire d'activation dans l'admin). Le compte
 *      peut être créé avant OU après le paiement (précisé par Steph le 06/10).
 *   4. 🔴 L'e-mail de confirmation NE PART PAS tout seul après une activation à
 *      la main : bouton « ✉ Confirmation » de /admin/utilisateurs
 *      (POST /api/admin/renvoyer-confirmation, vrai template, journalisé).
 *
 * Rien ne passe par le site : sans lien avec Paystack (PAYSTACK_AVAILABLE,
 * lib/promo.ts), qui reste coupé.
 *
 * Montants : ceux que le site affiche déjà en francs CFA (prix en euros à
 * parité fixe, arrondis à 500 — formatPrice), validés par Steph le 06/10.
 * Ici ce ne sont pas des équivalents « ≈ » : c'est le montant payé.
 */
import { PLAN_CONFIG, type Plan } from "@/types";
import { formatPrice } from "@/lib/geo/countries";

export const PAYS_MOBILE_MONEY = [
  { code: "CI", nom: "Côte d'Ivoire", dansLePays: "en Côte d'Ivoire" },
  { code: "ML", nom: "Mali", dansLePays: "au Mali" },
  { code: "BF", nom: "Burkina Faso", dansLePays: "au Burkina Faso" },
  { code: "SN", nom: "Sénégal", dansLePays: "au Sénégal" },
] as const;

export type CodePaysMobileMoney = (typeof PAYS_MOBILE_MONEY)[number]["code"];

/** « en Côte d'Ivoire, au Mali, au Burkina Faso et au Sénégal » */
export const OU_PAYER_MOBILE_MONEY = (() => {
  const lieux = PAYS_MOBILE_MONEY.map((p) => p.dansLePays);
  return `${lieux.slice(0, -1).join(", ")} et ${lieux[lieux.length - 1]}`;
})();

/** La même, en début de phrase : « En Côte d'Ivoire, au Mali… » */
export const OU_PAYER_MOBILE_MONEY_DEBUT = OU_PAYER_MOBILE_MONEY.charAt(0).toUpperCase() + OU_PAYER_MOBILE_MONEY.slice(1);

/** Code pays ISO accepté (insensible à la casse), sinon null. */
export function paysMobileMoney(code: string | null | undefined): CodePaysMobileMoney | null {
  const c = (code ?? "").trim().toUpperCase();
  const pays = PAYS_MOBILE_MONEY.find((p) => p.code === c);
  return pays ? pays.code : null;
}

const FORMULES = ["starter", "pro", "elite"];

/** Starter, Pro, Elite, dans cet ordre (jamais les plans de test). */
export function formulesMobileMoney(): Plan[] {
  return FORMULES.map((id) => PLAN_CONFIG.find((p) => p.id === id)).filter((p): p is Plan => !!p);
}

/** Montant payé en francs CFA, ex. « 42 500 FCFA ». */
export function montantMobileMoney(plan: Plan): string {
  return formatPrice(plan.prix_eur, "XOF");
}

/**
 * Message WhatsApp pré-rempli. Il finit sur l'e-mail du compte, que le visiteur
 * complète lui-même : c'est sur ce compte que Steph active l'accès. L'e-mail
 * n'est jamais injecté dans le lien (les outils de mesure enregistrent les
 * adresses des liens cliqués).
 */
export function messageMobileMoney(plan: Plan, pays: CodePaysMobileMoney): string {
  const nomPays = PAYS_MOBILE_MONEY.find((p) => p.code === pays)?.nom ?? pays;
  return (
    `Bonjour Elite Turf, je souhaite payer le Pack ${plan.nom} (${montantMobileMoney(plan)}, ${plan.duree_jours} jours) ` +
    `par Orange Money ou Wave. Pays : ${nomPays}. E-mail de mon compte Elite Turf :`
  );
}

/** Lien vers la section « Payer par Orange Money ou Wave », pays pré-coché si connu. */
export function lienMobileMoney(pays?: CodePaysMobileMoney | null): string {
  return `/abonnements${pays ? `?pays=${pays}` : ""}#mobile-money`;
}
