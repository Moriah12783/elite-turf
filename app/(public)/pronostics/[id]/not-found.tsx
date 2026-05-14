/**
 * /pronostics/[id] — not-found rendu quand notFound() est appelé dans la page
 * parente (pronostic dépublié ou UUID inexistant en BDD).
 *
 * Voir l'explication détaillée dans /courses/[id]/not-found.tsx — mêmes
 * raisons : signal explicite noindex à Google pour les pronostics anciens
 * retirés de l'index.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Star, Calendar, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Pronostic retiré — Elite Turf",
  description: "Ce pronostic n'est plus disponible. Consultez les pronostics du jour.",
  robots: { index: false, follow: false },
};

export default function PronosticNotFound() {
  return (
    <div className="min-h-[70vh] bg-bg-primary flex flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-6">
        <AlertCircle className="w-8 h-8 text-orange-400" />
      </div>

      <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-3">
        Ce pronostic n&apos;est plus disponible
      </h1>
      <p className="text-text-secondary text-base max-w-lg mb-10 leading-relaxed">
        Le pronostic que vous recherchez a été dépublié ou n&apos;a jamais
        existé. Découvrez nos pronostics actuels — analyses Quinté+, Tiercé,
        Quarté+ et stratégies expertes Elite Turf.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/pronostics"
          className="flex items-center gap-2 px-6 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
        >
          <Star className="w-4 h-4" />
          Pronostics du jour
        </Link>
        <Link
          href="/courses"
          className="flex items-center gap-2 px-6 py-3 bg-bg-card border border-gold-primary/30 hover:border-gold-primary/60 text-gold-light font-bold text-sm rounded-xl transition-all"
        >
          <Calendar className="w-4 h-4" />
          Programme du jour
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 px-6 py-3 text-text-muted hover:text-text-secondary font-semibold text-sm rounded-xl transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à l&apos;accueil
        </Link>
      </div>

      <p className="mt-12 text-text-muted text-xs">
        Elite Turf · Analyses hippiques informatives
      </p>
    </div>
  );
}
