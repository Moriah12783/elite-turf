import Link from "next/link";
import { Lock, Zap, Star, ArrowRight } from "lucide-react";

interface PaywallBannerProps {
  niveau: "PREMIUM" | "VIP";
  compact?: boolean;
}

export default function PaywallBanner({ niveau, compact = false }: PaywallBannerProps) {
  const isVip = niveau === "VIP";

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-bg-elevated border border-gold-primary/20">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-gold-primary flex-shrink-0" />
          <span className="text-text-secondary text-xs">
            {isVip ? "Réservé Plan Elite" : "Réservé abonnés Premium"}
          </span>
        </div>
        <Link
          href="/abonnements"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-xs rounded-lg transition-colors whitespace-nowrap shadow-gold-sm"
        >
          <Zap className="w-3 h-3" fill="currentColor" />
          Débloquer
        </Link>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold-primary/30 bg-gradient-to-br from-bg-card via-[#1A1610] to-bg-card p-6 text-center">
      {/* Top gold line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary to-transparent" />

      {/* Lock icon */}
      <div className="w-14 h-14 rounded-2xl bg-gold-faint border border-gold-primary/40 flex items-center justify-center mx-auto mb-4">
        {isVip ? (
          <Star className="w-6 h-6 text-gold-primary" fill="currentColor" />
        ) : (
          <Lock className="w-6 h-6 text-gold-primary" />
        )}
      </div>

      <h3 className="font-serif text-lg font-bold text-text-primary mb-2">
        {isVip ? "Contenu VIP Exclusif" : "Contenu Réservé Abonnés"}
      </h3>
      <p className="text-text-secondary text-sm mb-5 max-w-xs mx-auto">
        {isVip
          ? "Ce pronostic VIP est réservé aux membres du Plan Elite. Accès complet + analyses vidéo."
          : "Abonnez-vous à partir de 5 000 XOF/mois pour accéder à l'analyse complète et à la sélection."}
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/abonnements"
          className="flex items-center gap-2 px-6 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold w-full sm:w-auto justify-center"
        >
          <Zap className="w-4 h-4" fill="currentColor" />
          Voir les abonnements
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/inscription"
          className="text-text-secondary hover:text-gold-light text-sm transition-colors"
        >
          Créer un compte gratuit →
        </Link>
      </div>

      {/* Bottom gold line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/40 to-transparent" />
    </div>
  );
}
