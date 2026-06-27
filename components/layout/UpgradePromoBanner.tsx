"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Crown, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { effectiveSubscription } from "@/lib/auth/subscription";

const DISMISS_KEY = "upgrade-banner-dismissed";
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 jours

// Pages où l'incitation à l'abonnement serait redondante / hors sujet.
const EXCLUDED_PREFIXES = [
  "/abonnements",
  "/paiement",
  "/connexion",
  "/inscription",
  "/completer-profil",
  "/admin",
];

/**
 * Bannière d'incitation à l'abonnement — affichée UNIQUEMENT aux utilisateurs
 * CONNECTÉS dont l'abonnement effectif est GRATUIT. Ce n'est pas un popup de
 * capture (ils sont déjà inscrits) : on les pousse vers /abonnements.
 *
 * Détection 100 % côté client (session + lecture de SON propre profil via RLS),
 * donc aucune dé-optimisation du cache SSG/ISR. Les visiteurs anonymes (gérés
 * par SiteLeadPopup) et les abonnés payants ne voient jamais ce composant.
 */
export default function UpgradePromoBanner() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let active = true;

    // Cooldown : pas re-montré pendant 3 j après un refus.
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < COOLDOWN_MS) return;
    } catch {
      /* localStorage indisponible — on laisse passer */
    }

    (async () => {
      try {
        const supabase = createClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (!active || !session) return; // anonyme → SiteLeadPopup
        const { data: profile } = await supabase
          .from("profiles")
          .select("statut_abonnement, date_expiration_abonnement")
          .eq("id", session.user.id)
          .single();
        if (!active || !profile) return;
        const status = effectiveSubscription(
          profile.statut_abonnement,
          profile.date_expiration_abonnement,
        );
        if (status === "GRATUIT") setShow(true);
      } catch {
        /* erreur réseau/RLS — bannière simplement masquée */
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setShow(false);
  }

  if (!show) return null;
  if (pathname && EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className="fixed z-40 left-4 right-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] md:left-6 md:right-auto md:bottom-6 md:max-w-sm animate-fade-in">
      <div className="relative rounded-2xl border border-gold-primary/40 bg-bg-elevated shadow-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-transparent via-gold-primary to-transparent" />
        <div className="p-4 pr-9">
          <button
            onClick={dismiss}
            aria-label="Fermer"
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-primary/15 border border-gold-primary/30 flex items-center justify-center flex-shrink-0">
              <Crown className="w-5 h-5 text-gold-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-serif font-bold text-text-primary text-sm leading-snug">
                Débloquez les pronostics Premium
              </p>
              <p className="text-text-secondary text-xs mt-1 leading-relaxed">
                Votre compte est gratuit. Accédez aux pronostics du jour analysés par nos experts.
              </p>
              <Link
                href="/abonnements"
                onClick={dismiss}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-xs rounded-xl transition-colors shadow-gold-sm"
              >
                Voir les offres
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
