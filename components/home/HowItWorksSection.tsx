import Link from "next/link";
import { Download, BarChart2, TrendingUp, Star } from "lucide-react";

const STEPS = [
  {
    num: "01",
    Icon: Download,
    title: "Téléchargez le guide gratuit",
    desc: "Démarrez par les techniques de nos experts. Gratuit, sans inscription obligatoire, accessible en un clic.",
    href: "/guide-initie",
    cta: "Télécharger maintenant",
    color: "text-status-win",
    bg: "bg-status-win/10 border-status-win/20",
  },
  {
    num: "02",
    Icon: BarChart2,
    title: "Consultez les pronostics du jour",
    desc: "Chaque jour : course vedette, sélection de chevaux, base, outsider et indice de confiance par nos experts.",
    href: "/pronostics",
    cta: "Voir les pronostics",
    color: "text-gold-primary",
    bg: "bg-gold-faint border-gold-primary/20",
  },
  {
    num: "03",
    Icon: TrendingUp,
    title: "Vérifiez nos performances",
    desc: "Historique complet, résultats vérifiables, aucune manipulation. La transparence est notre signature.",
    href: "/performances",
    cta: "Voir les résultats",
    color: "text-gold-light",
    bg: "bg-gold-faint border-gold-primary/20",
  },
  {
    num: "04",
    Icon: Star,
    title: "Choisissez votre formule",
    desc: "Pack Starter, Pro ou Elite — choisissez l'accès qui correspond à vos ambitions.",
    href: "/abonnements",
    cta: "Voir les offres",
    color: "text-gold-primary",
    bg: "bg-gold-faint border-gold-primary/20",
  },
];

export default function HowItWorksSection() {
  return (
    <section
      id="comment-ca-marche"
      className="py-16 sm:py-20 scroll-mt-20"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-gold-primary text-xs font-bold uppercase tracking-widest mb-3">
            Simple &amp; efficace
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            Comment ça marche ?
          </h2>
          <p className="text-text-secondary text-base max-w-xl mx-auto">
            En 4 étapes claires, découvrez Elite Turf et commencez à parier avec méthode.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <div key={i} className="relative group">

              {/* Connector (desktop only, not last) */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-9 left-[calc(100%-8px)] w-4 h-px bg-gold-primary/25 z-10" />
              )}

              <div className="card-base p-6 h-full flex flex-col hover:border-gold-primary/40 hover:-translate-y-1 transition-all duration-200">

                {/* Numéro + icône */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="font-serif text-3xl font-bold text-gold-primary/20 leading-none select-none">
                    {step.num}
                  </span>
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${step.bg} group-hover:scale-105 transition-transform`}>
                    <step.Icon className={`w-5 h-5 ${step.color}`} />
                  </div>
                </div>

                <h3 className="font-serif font-bold text-text-primary text-base mb-3 leading-snug">
                  {step.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed flex-1">
                  {step.desc}
                </p>

                <Link
                  href={step.href}
                  className="mt-4 text-gold-primary hover:text-gold-light text-xs font-semibold transition-colors inline-flex items-center gap-1"
                >
                  {step.cta} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
