"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, CreditCard, Smartphone, ChevronDown } from "lucide-react";
import type { Plan } from "@/types";

interface Props {
  plan: Plan;
  userId?: string;
  userEmail?: string;
  variant?: "primary" | "secondary" | "elite";
}

type PaymentMethod = "paystack" | "stripe" | null;

const VARIANT_MAIN = {
  primary:   "w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-gold-primary hover:bg-gold-dark text-bg-primary transition-all shadow-gold-sm",
  secondary: "w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-bg-elevated hover:bg-bg-hover text-text-primary border border-border transition-all",
  elite:     "w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-purple-700 via-purple-600 to-purple-700 hover:from-purple-600 hover:via-purple-500 hover:to-purple-600 text-white transition-all shadow-[0_0_20px_rgba(168,85,247,0.25)]",
};

export default function PaiementButton({ plan, userId, userEmail, variant = "secondary" }: Props) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState<PaymentMethod>(null);
  const [error, setError]     = useState<string | null>(null);
  const router                = useRouter();

  if (!userId || !userEmail) {
    return (
      <button
        onClick={() => router.push(`/auth/connexion?redirect=/abonnements&plan=${plan.id}`)}
        className={`${VARIANT_MAIN[variant ?? "secondary"]} disabled:opacity-60`}
      >
        <Lock className="w-4 h-4" />
        Se connecter pour souscrire
      </button>
    );
  }

  async function handlePay(method: PaymentMethod) {
    if (!method) return;
    setError(null);
    setLoading(method);
    setOpen(false);

    const endpoint = method === "stripe"
      ? "/api/paiement/stripe/checkout"
      : "/api/paystack/initier";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, userId, userEmail }),
      });

      const data = await res.json();

      if (!res.ok || !data.paymentUrl) {
        setError(data.error || "Une erreur est survenue. Réessayez.");
        setLoading(null);
        return;
      }

      window.location.href = data.paymentUrl;
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
      setLoading(null);
    }
  }

  const isLoading = loading !== null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => !isLoading && setOpen((v) => !v)}
        disabled={isLoading}
        className={`${VARIANT_MAIN[variant ?? "secondary"]} disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Redirection…
          </>
        ) : (
          <>
            <span className="flex-1 text-left">Choisir ce pack</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {open && !isLoading && (
        <div className="rounded-xl border border-border bg-bg-card overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold px-3 pt-2.5 pb-1">
            Choisir votre moyen de paiement
          </p>

          {/* Paystack — Mobile Money + Carte */}
          <button
            onClick={() => handlePay("paystack")}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-4 h-4 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-sm font-semibold">Orange Money · MTN · Wave · Carte</p>
              <p className="text-text-muted text-xs">Mobile Money africain — sécurisé par Paystack</p>
            </div>
            <span className="text-text-muted text-xs font-mono">
              {plan.prix_fcfa.toLocaleString("fr-FR")} F
            </span>
          </button>

          <div className="mx-3 border-t border-border/50" />

          {/* Stripe — Visa / Mastercard internationale (toutes cartes) */}
          <button
            onClick={() => handlePay("stripe")}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-sm font-semibold">Visa / Mastercard</p>
              <p className="text-text-muted text-xs">
                Toutes cartes acceptées (Afrique, Europe, autres) — sécurisé par Stripe
              </p>
            </div>
            <span className="text-text-muted text-xs font-mono">
              {plan.prix_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </span>
          </button>

          <p className="text-[10px] text-text-muted px-3 py-2 leading-relaxed border-t border-border/50">
            💡 Si Orange Money / MTN / Wave refuse, essayez Visa / Mastercard ci-dessus —
            cette option accepte les cartes ivoiriennes, sénégalaises, marocaines, et toutes
            les cartes émises dans le monde.
          </p>

          <button
            onClick={() => setOpen(false)}
            className="w-full text-center text-text-muted text-xs py-2 hover:text-text-secondary transition-colors border-t border-border/50"
          >
            Annuler
          </button>
        </div>
      )}

      {error && (
        <p className="text-status-loss text-xs text-center">{error}</p>
      )}
    </div>
  );
}
