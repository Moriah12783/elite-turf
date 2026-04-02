"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Zap } from "lucide-react";

/**
 * Bannière sticky qui apparaît après 400px de scroll.
 * Fond bleu nuit, texte or — disparaît si fermée (sessionStorage).
 */
export default function StickyBanner() {
  const [visible, setVisible]   = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Ne pas réafficher si déjà fermée dans la session
    if (sessionStorage.getItem("sticky-banner-dismissed") === "1") {
      setDismissed(true);
      return;
    }

    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function dismiss() {
    setDismissed(true);
    sessionStorage.setItem("sticky-banner-dismissed", "1");
  }

  if (dismissed || !visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-4 sm:px-6 py-2.5 animate-slide-down"
      style={{ background: "linear-gradient(90deg, #0D1B2A 0%, #0F2137 50%, #0D1B2A 100%)", borderBottom: "1px solid rgba(201,168,76,0.3)" }}
      role="banner"
      aria-label="Offre Elite Turf"
    >
      {/* Gauche — icône + texte */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-gold-primary/20 border border-gold-primary/40 flex items-center justify-center flex-shrink-0">
          <Zap className="w-3.5 h-3.5 text-gold-primary" />
        </div>
        <p className="text-white text-xs sm:text-sm truncate">
          <span className="text-gold-primary font-semibold">Envie de passer à la vitesse supérieure ?</span>
          <span className="hidden sm:inline text-white/80"> Découvrez nos Packs Elite depuis 65€.</span>
        </p>
      </div>

      {/* Droite — CTA + fermer */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/abonnements"
          className="px-3 py-1.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-xs rounded-lg transition-colors shadow-gold-sm whitespace-nowrap"
          onClick={dismiss}
        >
          Découvrir →
        </Link>
        <button
          onClick={dismiss}
          aria-label="Fermer la bannière"
          className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
