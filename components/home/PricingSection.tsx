import Link from "next/link";
import { Check, Star, Zap, Crown } from "lucide-react";
import { PLAN_CONFIG } from "@/types";
import { formatMoney } from "@/lib/utils";

const PLAN_ICONS = { Starter: Zap, Pro: Star, Elite: Crown };
const PLAN_COLORS = {
  Starter: { border: "border-border", badge: "bg-bg-elevated text-text-secondary", button: "bg-bg-elevated hover:bg-bg-hover text-text-primary border border-border" },
  Pro: { border: "border-gold-primary/50", badge: "bg-gold-primary text-bg-primary", button: "bg-gold-primary hover:bg-gold-dark text-bg-primary" },
  Elite: { border: "border-border", badge: "bg-bg-elevated text-text-secondary", button: "bg-bg-elevated hover:bg-bg-hover text-text-primary border border-border" },
};

export default function PricingSection() {
  return (
    <section className="py-16 sm:py-20 bg-bg-card/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Crown className="w-5 h-5 text-gold-primary" />
            <span className="text-gold-light text-sm font-medium uppercase tracking-wider">
              Nos Offres
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary">
            Choisissez Votre Plan
          </h2>
          <p className="text-text-secondary mt-3 max-w-xl mx-auto text-sm">
            Payez avec Orange Money CI, MTN MoMo, Wave ou carte bancaire.
            Accès immédiat après paiement.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLAN_CONFIG.map((plan) => {
            const Icon = PLAN_ICONS[plan.nom];
            const colors = PLAN_COLORS[plan.nom];
            return (
              <div
                key={plan.id}
                className={`card-base p-6 border-2 ${colors.border} relative flex flex-col ${
                  plan.populaire ? "ring-2 ring-gold-primary/30 shadow-gold" : ""
                }`}
              >
                {plan.populaire && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-gold-primary text-bg-primary text-xs font-bold rounded-full whitespace-nowrap">
                      ⭐ LE PLUS POPULAIRE
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <div className={`w-12 h-12 rounded-xl border ${colors.border} flex items-center justify-center mb-4 ${plan.populaire ? "bg-gold-faint" : "bg-bg-elevated"}`}>
                    <Icon className={`w-6 h-6 ${plan.populaire ? "text-gold-primary" : "text-text-secondary"}`} />
                  </div>
                  <h3 className="font-serif font-bold text-xl text-text-primary mb-1">{plan.nom}</h3>
                  <p className="text-text-secondary text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-bold font-serif ${plan.populaire ? "text-gold-primary" : "text-text-primary"}`}>
                      {formatMoney(plan.prix_eur, "EUR")}
                    </span>
                    <span className="text-text-muted text-sm">/mois</span>
                  </div>
                  <p className="text-text-muted text-xs mt-1">≈ {formatMoney(plan.prix_fcfa)} FCFA</p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.populaire ? "text-gold-primary" : "text-status-win"}`} />
                      <span className="text-text-secondary text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/inscription?plan=${plan.id}`}
                  className={`w-full py-3 rounded-xl font-semibold text-sm text-center transition-all ${colors.button}`}
                >
                  Choisir {plan.nom}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Payment methods */}
        <div className="mt-10 text-center">
          <p className="text-text-muted text-xs mb-3">Moyens de paiement acceptés</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {["🟠 Orange Money CI", "🟡 MTN MoMo", "🔵 Wave", "💳 Visa/Mastercard"].map((p) => (
              <span
                key={p}
                className="px-3 py-1.5 bg-bg-card border border-border rounded-lg text-text-secondary text-xs font-medium"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
