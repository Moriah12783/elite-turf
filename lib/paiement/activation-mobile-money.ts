/**
 * Activation à la main d'un paiement Orange Money / Wave — règles PURES.
 *
 * Bouton « Activer » de /admin/utilisateurs (demande de Steph du 06/10/2026),
 * route POST /api/admin/abonnements/activer-mobile-money. Décisions de Steph :
 *   - abonné ENCORE ACTIF qui repaie : les jours s'ajoutent après sa date de
 *     fin (il ne perd pas ses jours restants) ; la formule devient celle payée ;
 *   - le paiement est enregistré dans `transactions` (SUCCES, montant FCFA) ;
 *   - l'e-mail de confirmation part à l'activation (case cochée par défaut).
 *
 * « Encore actif » = même règle que effectiveSubscription (lib/auth/subscription.ts) :
 * statut payant ET date de fin strictement dans le futur.
 */
import type { Plan } from "@/types";
import { convertPrice } from "@/lib/geo/countries";

export type Palier = "STARTER" | "PRO" | "ELITE";
export type Operateur = "ORANGE_MONEY" | "WAVE";

/** Libellés affichés ; les clés sont les valeurs admises par transactions.methode. */
export const OPERATEURS: Record<Operateur, string> = { ORANGE_MONEY: "Orange Money", WAVE: "Wave" };

const PALIER_PAR_FORMULE: Record<string, Palier> = { starter: "STARTER", pro: "PRO", elite: "ELITE" };
const RANG: Record<Palier, number> = { STARTER: 1, PRO: 2, ELITE: 3 };
const JOUR_MS = 24 * 60 * 60 * 1000;

export function palierDeFormule(formule: string): Palier | null {
  return PALIER_PAR_FORMULE[formule] ?? null;
}

/** Montant payé en francs CFA, entier : celui affiché sur le site (arrondi à 500). */
export function montantFcfa(plan: Plan): number {
  return convertPrice(plan.prix_eur, "XOF").value;
}

export interface EtatAbonne {
  statut: string | null;
  /** profiles.date_expiration_abonnement (timestamptz, ISO) ou null */
  expiration: string | null;
}

export interface Periode {
  debut: string;
  fin: string;
  /** true = abonné encore actif, période ajoutée après sa date de fin */
  prolongation: boolean;
}

function estPayant(statut: string | null): statut is Palier {
  return statut === "STARTER" || statut === "PRO" || statut === "ELITE";
}

function estActif(etat: EtatAbonne, maintenant: Date): boolean {
  return estPayant(etat.statut) && !!etat.expiration && Date.parse(etat.expiration) > maintenant.getTime();
}

/**
 * Nouvelle période. Refus « PERMANENT » : un accès payant sans date de fin
 * (offert à vie, compte de Steph) en recevrait une — on ne le fait jamais en
 * silence.
 */
export function calculerPeriode(
  etat: EtatAbonne,
  dureeJours: number,
  maintenant: Date,
): Periode | { erreur: "PERMANENT" } {
  if (estPayant(etat.statut) && !etat.expiration) return { erreur: "PERMANENT" };
  const prolongation = estActif(etat, maintenant);
  const base = prolongation ? Date.parse(etat.expiration as string) : maintenant.getTime();
  return {
    debut: maintenant.toISOString(),
    fin: new Date(base + dureeJours * JOUR_MS).toISOString(),
    prolongation,
  };
}

/** « 20 octobre 2026 » (date UTC = heure d'Abidjan). */
export function dateLongue(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Ce que l'admin doit voir AVANT de confirmer. */
export function avertissements(etat: EtatAbonne, nouveau: Palier, maintenant: Date): string[] {
  const liste: string[] = [];
  if (estActif(etat, maintenant) && estPayant(etat.statut) && RANG[nouveau] < RANG[etat.statut]) {
    liste.push(
      `Il est actuellement ${etat.statut} jusqu'au ${dateLongue(etat.expiration as string)} : il passera ${nouveau} dès l'activation.`,
    );
  }
  return liste;
}

/**
 * Référence interne du paiement. Jamais « ET-PS- » (Paystack : crons de
 * récupération) ni « ET-STRIPE- » (lu comme un paiement par carte dans
 * /admin/paiements). La référence donnée par l'opérateur va dans `metadata`.
 */
export function referenceMobileMoney(operateur: Operateur, maintenant: Date, alea: string): string {
  const horodatage = maintenant.toISOString().slice(0, 19).replace(/\D/g, "");
  return `ET-MM-${operateur === "WAVE" ? "WAVE" : "OM"}-${horodatage}-${alea}`;
}

/**
 * Motif ILIKE pour trouver un compte par e-mail, sans tenir compte de la
 * casse : `profiles.email` n'est ni unique ni normalisé. `%` et `_` sont
 * neutralisés (un « _ » est courant dans une adresse).
 */
export function motifEmailExact(email: string): string {
  return email.trim().toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Formule enregistrée AVEC un paiement en attente (bouton « Valider » de
 * /admin/paiements) : `metadata.plan_id` (Paystack, carte) ou
 * `metadata.formule` (bouton « Activer »). Seules les formules payantes
 * comptent ; sinon null — la route refuse plutôt que de deviner (elle
 * appliquait « Pro 30 jours » à tout paiement, faute de lire cette valeur).
 */
export function formuleDeTransaction(metadata: Record<string, unknown> | null | undefined): string | null {
  const brut = metadata?.plan_id ?? metadata?.formule;
  return typeof brut === "string" && palierDeFormule(brut) ? brut : null;
}

/**
 * Paiement par carte : temps réel (réussi ou abandonné), jamais « reçu mais à
 * valider ». Même règle que l'affichage de /admin/paiements (isCardTx).
 */
export function estPaiementCarte(tx: { methode?: string | null; reference_operateur?: string | null }): boolean {
  return (
    tx.methode === "STRIPE" ||
    tx.methode === "CARTE_BANCAIRE" ||
    (typeof tx.reference_operateur === "string" && tx.reference_operateur.indexOf("ET-STRIPE-") === 0)
  );
}
