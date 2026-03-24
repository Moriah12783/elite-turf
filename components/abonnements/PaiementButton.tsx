"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Zap, Star, Crown, ArrowRight } from "lucide-react";
import type { Plan } from "@/types";

interface Props {
  plan: Plan;
  userId?: string;
  userEmail?: string;
  variant?: "primary" | "secondary" | "elite";
}

const VARIANT_STYLES = {
  primary: "btn-primary w-full",
  secondary: "btn-secondary w-full",
  elite:
    "w-full py-3 rounded-xl font-bold text-sm text-white transition-all duration-300 flex items-center justify-center gap-2 " +
    "bg-gradient-to-r from-purple-700 via-purple-600 to-purple-700 " +
    "hover:from-purple-600 hover:via-purple-500 hover:to-purple-600 " +
    "shadow-[0_0_20px_rgba(168,85,247,0.25)] hover:shadow-[0_0_28px_rgba(168,85,247,0.4)]",
};

const PLAN_ICONS = {
  Starter: Zap,
  Pro: Star,
  Elite: Crown,
};

export default function PaiementButton({
  plan,
  userId,
  userEmail,
  variant = "secondary",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const Icon = PLAN_ICONS[plan.nom];

  async function handleClick() {
    setError(null);

    // Non connecté → rediriger vers la page de connexion
    if (!userId || !userEmail) {
      router.push(
        `/auth/connexion?redirect=/abonnements&plan=${plan.id}`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/paiement/initier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          userId,
          userEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.paymentUrl) {
        setError(data.error || "Une erreur est survenue. Réessayez.");
        setLoading(false);
        return;
      }

      // Rediriger vers la page de paiement CinetPay
      window.location.href = data.paymentUrl;
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
      setLoading(false);
    }
  }

  const btnClass =
    variant === "elite"
      ? VARIANT_STYLES.elite
      : variant === "primary"
      ? VARIANT_STYLES.primary
      : VARIANT_STYLES.secondary;

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className={`${btnClass} disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Redirection…
          </>
        ) : !userId ? (
          <>
            <Lock className="w-4 h-4" />
            Se connecter pour souscrire
          </>
        ) : (
          <>
            <Icon className="w-4 h-4" />
            Choisir {plan.nom}
            <ArrowRight className="w-4 h-4 ml-auto" />
          </>
        )}
      </button>

      {error && (
        <p className="text-status-loss text-xs text-center">{error}</p>
      )}
    </div>
  );
}
