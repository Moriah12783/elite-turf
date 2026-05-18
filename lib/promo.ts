/**
 * Disponibilité Paystack (Mobile Money + Carte africaine) — toggle global.
 *
 * Historique :
 *   - Mai 2026 (début) : compte Paystack en review compliance (mail Christopher
 *     du 1er mai), paiements bloqués → 100 % des tentatives marquées "abandoned"
 *     même quand l'utilisateur valide. Toggle mis à `false`.
 *   - 2026-05-18 : Paystack a APPROUVÉ le compte ("Your business has been
 *     approved and is now ready to accept real payments"). Toggle ré-activé.
 *
 * NB : 13 tentatives échouées dans le CSV Paystack (du 5-7 mai) avaient toutes
 * `channel: "card"`. Cause = compte en review limitait à card seulement, MAIS
 * aussi la demande des utilisateurs ivoiriens/sénégalais qui voulaient Mobile
 * Money. Maintenant que le compte est approuvé + qu'on envoie déjà
 * `channels: ["card", "mobile_money", "bank_transfer"]` à l'init, la checkout
 * Paystack proposera Orange Money / MTN / Wave.
 *
 * Stripe reste opérationnel en parallèle pour Visa/Mastercard (cartes africaines
 * acceptées) — utile pour les clients européens et africains avec CB.
 */
export const PAYSTACK_AVAILABLE = true;

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
