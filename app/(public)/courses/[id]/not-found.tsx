/**
 * /courses/[id] — not-found rendu quand notFound() est appelé dans la page
 * parente (course supprimée ou UUID inexistant en BDD).
 *
 * Pourquoi un not-found dédié à la route ?
 *   - GSC remontait 25+ URLs /courses/<uuid> en 404 (pattern B du diagnostic
 *     SEO du 14/05/2026) → courses anciennes nettoyées de la BDD mais encore
 *     dans l'index Google.
 *   - Avec le not-found global, Google voyait un 404 sans signal explicite.
 *   - Ici on ajoute robots:{index:false} pour accélérer la désindexation
 *     et on propose des CTAs vers le programme du jour (sauvegarde du trafic).
 *
 * Next.js ne supporte pas nativement HTTP 410 dans une page, mais combiner
 * 404 + X-Robots-Tag:noindex (via metadata) donne le même signal de désindex
 * que 410, juste un peu moins rapide (~30j vs ~7j).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Calendar, Star, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Course retirée — Elite Turf",
  description: "Cette course n'est plus disponible. Consultez le programme du jour.",
  robots: { index: false, follow: false },
};

export default function CourseNotFound() {
  return (
    <div className="min-h-[70vh] bg-bg-primary flex flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-6">
        <AlertCircle className="w-8 h-8 text-orange-400" />
      </div>

      <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-3">
        Cette course n&apos;est plus disponible
      </h1>
      <p className="text-text-secondary text-base max-w-lg mb-10 leading-relaxed">
        La course que vous recherchez a été retirée de notre base de données ou
        n&apos;a jamais existé. Consultez le programme du jour pour les courses
        à venir et les pronostics Elite Turf.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/courses"
          className="flex items-center gap-2 px-6 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
        >
          <Calendar className="w-4 h-4" />
          Programme du jour
        </Link>
        <Link
          href="/pronostics"
          className="flex items-center gap-2 px-6 py-3 bg-bg-card border border-gold-primary/30 hover:border-gold-primary/60 text-gold-light font-bold text-sm rounded-xl transition-all"
        >
          <Star className="w-4 h-4" />
          Pronostics du jour
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
