import Link from "next/link";
import { Sparkles, ArrowRight, Check } from "lucide-react";

/**
 * Section d'accueil « Une sélection gratuite sur chaque course ».
 * Positionnement : Elite Turf accompagne TOUS les parieurs (gratuitement),
 * au-delà des 3 pronostics premium du jour. Statique, sans donnée par course.
 */
export default function NotreSelectionSection() {
  const points = ["Sur toutes les courses", "100 % gratuite", "Sans inscription"];
  return (
    <section className="py-14 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="relative rounded-2xl border border-gold-primary/30 bg-gradient-to-br from-gold-faint/60 via-bg-card to-bg-card overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary to-transparent" />
          <div className="p-7 sm:p-10 text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-gold-primary" />
              <span className="text-gold-light text-xs font-semibold uppercase tracking-widest">
                Gratuit · sans inscription
              </span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-4">
              Une sélection gratuite sur <span className="text-gold-light">chaque course</span>
            </h2>
            <p className="text-text-secondary text-sm sm:text-base leading-relaxed max-w-2xl mx-auto mb-3">
              Nos 3 pronostics experts du jour sont réservés aux abonnés. Mais Elite Turf ne s&apos;arrête
              pas là : sur <span className="text-text-primary font-semibold">chaque course</span> du
              programme, vous trouvez{" "}
              <span className="text-gold-light font-semibold">la Sélection stats gratuite</span> — une lecture
              statistique (favoris au marché, drivers et entraîneurs reconnus, forme) pour{" "}
              <span className="text-text-primary font-semibold">structurer vos paris</span> et comprendre la
              course.
            </p>
            <p className="text-text-muted text-sm italic mb-6">
              Parce qu&apos;avant tout, nous sommes là pour vous conseiller.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-7">
              {points.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 text-text-secondary text-sm">
                  <Check className="w-4 h-4 text-status-win flex-shrink-0" />
                  {p}
                </span>
              ))}
            </div>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
            >
              Voir le programme du jour
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
