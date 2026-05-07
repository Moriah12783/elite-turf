/**
 * Disponibilité Paystack (Mobile Money + Carte africaine) — toggle global.
 *
 * Mai 2026 : compte Paystack en review compliance (mail Christopher du 1er mai),
 * paiements bloqués → 100% des tentatives marquées "abandoned" même quand
 * l'utilisateur valide. On désactive proprement l'option côté UI plutôt que
 * laisser le visiteur tomber sur un échec silencieux.
 *
 * Quand Paystack lève la review → flip à `true`, deploy, ça revient.
 *
 * Stripe reste opérationnel en parallèle pour Visa/Mastercard (cartes africaines
 * acceptées) — c'est le fallback recommandé tant que Paystack est down.
 */
export const PAYSTACK_AVAILABLE = false;

/** Configuration de l'offre de lancement — modifiable ici uniquement.
 *  La promo de lancement -30% (code ELITE30) a expiré le 4 mai 2026.
 *  Désactivée le 7 mai. Ré-activer en remettant actif: true et en mettant
 *  à jour dateExpiration avant la prochaine campagne. */
export const PROMO = {
  actif:          false,
  reductionPct:   30,
  code:           "ELITE30",
  dateExpiration: "4 mai 2026",
  /** Prix originaux en € */
  prix: {
    Starter: 65,
    Pro:     152,
    Elite:   208,
  },
  /** Prix réduits calculés automatiquement */
  get prixReduits() {
    return Object.fromEntries(
      Object.entries(this.prix).map(([k, v]) => [
        k,
        +(v * (1 - this.reductionPct / 100)).toFixed(2),
      ])
    ) as Record<"Starter" | "Pro" | "Elite", number>;
  },
  /** Économies calculées automatiquement */
  get economies() {
    return Object.fromEntries(
      Object.entries(this.prix).map(([k, v]) => [
        k,
        +(v * this.reductionPct / 100).toFixed(2),
      ])
    ) as Record<"Starter" | "Pro" | "Elite", number>;
  },
} as const;
