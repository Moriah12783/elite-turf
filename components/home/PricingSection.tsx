import Link from "next/link";
import { Check, Zap, Star, Crown, Shield, Flame } from "lucide-react";
import { PLAN_CONFIG } from "@/types";
import { PROMO } from "@/lib/promo";

const PACK_NAMES: Record<string, string> = {
  Free:    "GRATUIT",
  Starter: "PACK STARTER",
  Pro:     "PACK PRO",
  Elite:   "PACK ELITE",
};


const PLAN_ICONS = { Free: Shield, Starter: Zap, Pro: Star, Elite: Crown };

const PLAN_STYLES = {
  Free: {
    border:  "border-border",
    iconBg:  "bg-bg-elevated border-border",
    iconTx:  "text-text-secondary",
    price:   "text-text-primary",
    bar:     "bg-status-win",
    barW:    "50%",
    btn:     "bg-bg-elevated hover:bg-bg-hover text-text-primary border border-border",
    stars:   1,
  },
  Starter: {
    border:  "border-border",
    iconBg:  "bg-bg-elevated border-border",
    iconTx:  "text-text-secondary",
    price:   "text-text-primary",
    bar:     "bg-status-win",
    barW:    "70%",
    btn:     "bg-bg-elevated hover:bg-bg-hover text-text-primary border border-border",
    stars:   3,
  },
  Pro: {
    border:  "border-gold-primary/60",
    iconBg:  "bg-gold-faint border-gold-primary/40",
    iconTx:  "text-gold-primary",
    price:   "text-gold-primary",
    bar:     "bg-gold-primary",
    barW:    "82%",
    btn:     "bg-gold-primary hover:bg-gold-dark text-bg-primary",
    stars:   4,
  },
  Elite: {
    border:  "border-purple-500/40",
    iconBg:  "bg-purple-500/10 border-purple-500/30",
    iconTx:  "text-purple-400",
    price:   "text-purple-400",
    bar:     "bg-purple-400",
    barW:    "92%",
    btn:     "bg-purple-600 hover:bg-purple-700 text-white",
    stars:   5,
  },
};

export default function PricingSection() {
  return (
    <section className="py-16 sm:py-20 bg-bg-card/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Crown className="w-5 h-5 text-gold-primary" />
            <span className="text-gold-light text-sm font-medium uppercase tracking-wider">
              Nos Offres
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary">
            Choisissez Votre Pack
          </h2>
          <p className="text-text-secondary mt-3 max-w-xl mx-auto text-sm">
            Payez avec Orange Money CI, MTN MoMo, Wave ou carte bancaire.
            Accès immédiat après paiement.
          </p>
        </div>

        {/* ── BANDEAU PROMO ── */}
        {PROMO.actif && (
          <div className="mb-10 relative overflow-hidden rounded-2xl border border-gold-primary/40 bg-gradient-to-r from-bg-card via-gold-faint to-bg-card">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary to-transparent" />
            <div className="px-5 py-4 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gold-primary/15 border border-gold-primary/30 flex items-center justify-center">
                <Flame className="w-5 h-5 text-gold-primary" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gold-primary text-sm">
                  🎉 Offre de lancement — {PROMO.reductionPct}% de réduction jusqu&apos;au {PROMO.dateExpiration}
                </p>
                <p className="text-text-muted text-xs mt-0.5">
                  Code&nbsp;
                  <span className="font-mono font-bold text-gold-primary">{PROMO.code}</span>
                  &nbsp;·&nbsp;
                  Starter <span className="line-through">{PROMO.prix.Starter}€</span> → <span className="text-status-win font-bold">{PROMO.prixReduits.Starter.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                  &nbsp;·&nbsp;
                  Pro <span className="line-through">{PROMO.prix.Pro}€</span> → <span className="text-status-win font-bold">{PROMO.prixReduits.Pro.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                  &nbsp;·&nbsp;
                  Elite <span className="line-through">{PROMO.prix.Elite}€</span> → <span className="text-status-win font-bold">{PROMO.prixReduits.Elite.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                </p>
              </div>
              <Link href="/abonnements" className="flex-shrink-0 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-xs rounded-xl transition-colors shadow-gold whitespace-nowrap">
                J&apos;en profite →
              </Link>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary to-transparent" />
          </div>
        )}

        {/* Plans */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* ── FREE (statique) ── */}
          <div className="card-base p-6 border-2 border-status-win/30 relative flex flex-col">
            <div className="mb-5">
              <div className="w-12 h-12 rounded-2xl border bg-status-win/10 border-status-win/20 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-status-win" />
              </div>
              <h3 className="font-serif font-bold text-xl text-text-primary mb-1">FREE</h3>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-status-win/80 mb-1">Accès gratuit permanent</p>
              <p className="text-text-secondary text-sm mb-3">Essayer avant de s&apos;engager</p>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-muted">Niveau de filtrage</span>
                  <span className="text-xs font-bold text-status-win">Découverte</span>
                </div>
                <div className="w-full bg-bg-elevated rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-status-win/60" style={{ width: "20%" }} />
                </div>
                <div className="flex mt-1 gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} className={`text-xs ${s === 1 ? "text-status-win" : "text-text-muted"}`}>◆</span>
                  ))}
                </div>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold font-serif text-status-win">0</span>
                <span className="text-text-muted text-sm font-medium">€</span>
              </div>
              <p className="text-text-muted text-xs mt-0.5">Sans engagement · Permanent</p>
            </div>

            <ul className="space-y-2.5 mb-7 flex-1">
              {[
                "1 pronostic Tiercé gratuit par jour",
                "Accès aux résultats publics",
                "Lecture de la page Pronostics",
                "Sans carte bancaire",
                "Inscription en 30 secondes",
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-status-win" />
                  <span className="text-text-secondary text-sm">{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/inscription"
              className="w-full py-3 rounded-xl font-bold text-sm text-center transition-all bg-status-win/10 hover:bg-status-win/20 text-status-win border border-status-win/30"
            >
              Commencer gratuitement →
            </Link>
          </div>

          {/* ── STARTER / PRO / ELITE ── */}
          {PLAN_CONFIG.filter((p) => p.nom !== "Test").map((plan) => {
            const Icon   = PLAN_ICONS[plan.nom as keyof typeof PLAN_ICONS];
            const styles = PLAN_STYLES[plan.nom as keyof typeof PLAN_STYLES];
            return (
              <div
                key={plan.id}
                className={`card-base p-6 border-2 ${styles.border} relative flex flex-col ${
                  plan.populaire ? "ring-2 ring-gold-primary/30 shadow-gold" : ""
                }`}
              >
                {plan.populaire && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <span className="px-4 py-1 bg-gold-primary text-bg-primary text-[11px] font-bold rounded-full whitespace-nowrap shadow-gold">
                      ⭐ LE PLUS POPULAIRE
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <div className={`w-12 h-12 rounded-2xl border ${styles.iconBg} flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${styles.iconTx}`} />
                  </div>

                  <h3 className="font-serif font-bold text-xl text-text-primary mb-1">
                    {PACK_NAMES[plan.nom]}
                  </h3>
                  <p className="text-text-secondary text-sm mb-3">{plan.description}</p>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-muted">Niveau de filtrage</span>
                      <span className={`text-xs font-bold ${styles.price}`}>
                        {plan.nom === "Starter" ? "Standard" : plan.nom === "Pro" ? "Optimisé" : "Expert"}
                      </span>
                    </div>
                    <div className="w-full bg-bg-elevated rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${styles.bar}`}
                        style={{ width: plan.nom === "Starter" ? "45%" : plan.nom === "Pro" ? "75%" : "100%" }} />
                    </div>
                    <div className="flex mt-1 gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-xs ${s <= styles.stars ? styles.price : "text-text-muted"}`}>◆</span>
                      ))}
                    </div>
                  </div>

                  {PROMO.actif && plan.nom in PROMO.prixReduits ? (
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-lg font-medium text-text-muted line-through">
                          {plan.prix_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-status-win/10 text-status-win border border-status-win/20 rounded-full">
                          −{PROMO.reductionPct}%
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-4xl font-bold font-serif ${styles.price}`}>
                          {PROMO.prixReduits[plan.nom as keyof typeof PROMO.prixReduits].toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-text-muted text-sm font-medium">€</span>
                      </div>
                      <p className="text-status-win text-[11px] font-semibold mt-0.5">
                        Économie {PROMO.economies[plan.nom as keyof typeof PROMO.economies].toFixed(2).replace(".", ",")}€
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className={`text-4xl font-bold font-serif ${styles.price}`}>
                        {plan.prix_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-text-muted text-sm font-medium">€</span>
                    </div>
                  )}
                  <p className="text-text-muted text-xs mt-0.5">
                    {plan.duree_jours} jours · ≈ {plan.prix_fcfa.toLocaleString("fr-FR")} F CFA
                  </p>
                </div>

                <ul className="space-y-2.5 mb-7 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${styles.price}`} />
                      <span className="text-text-secondary text-sm">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/abonnements#${plan.id}`}
                  className={`w-full py-3 rounded-xl font-bold text-sm text-center transition-all ${styles.btn}`}
                >
                  Choisir {PACK_NAMES[plan.nom].split(" ").slice(1).join(" ")} →
                </Link>
              </div>
            );
          })}
        </div>

        {/* Garanties */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-status-win/5 border border-status-win/20 rounded-full text-status-win text-xs font-medium">
            <Shield className="w-3.5 h-3.5" />
            Paiement 100% sécurisé
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gold-faint border border-gold-primary/20 rounded-full text-gold-light text-xs font-medium">
            <span>⚡</span> Activation instantanée après paiement
          </div>
        </div>

        {/* Moyens de paiement */}
        <div className="mt-8 text-center">
          <p className="text-text-muted text-xs mb-3 uppercase tracking-widest font-semibold">
            Moyens de paiement acceptés
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {[
              { emoji: "🟠", label: "Orange Money CI" },
              { emoji: "🟡", label: "MTN MoMo" },
              { emoji: "🔵", label: "Wave" },
              { emoji: "💳", label: "Visa / Mastercard" },
            ].map((p) => (
              <div key={p.label} className="flex items-center gap-2 px-4 py-2 bg-bg-card border border-border rounded-xl">
                <span className="text-base">{p.emoji}</span>
                <span className="text-text-secondary text-xs font-medium">{p.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
