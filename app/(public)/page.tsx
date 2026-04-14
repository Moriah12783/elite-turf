import type { Metadata } from "next";
import HeroSection from "@/components/home/HeroSection";
import WhyChooseUsSection from "@/components/home/WhyChooseUsSection";
import CoursesSection from "@/components/home/CoursesSection";
import PronosticsSection from "@/components/home/PronosticsSection";
import StatsSection from "@/components/home/StatsSection";
import PricingSection from "@/components/home/PricingSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import FAQSection from "@/components/home/FAQSection";
import GuideBlocSection from "@/components/home/GuideBlocSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import Link from "next/link";
import { ArrowRight, AlertTriangle, Download } from "lucide-react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.elite-turf.fr";

export const metadata: Metadata = {
  title: "Elite Turf — Pronostics PMU & Analyses Hippiques Premium",
  description:
    "Pronostics PMU du jour analysés par des experts hippiques. Quinté+, Quarté+, Tiercé. Résultats publiés en toute transparence. Abonnements dès 65€ — Paiement Orange Money, Wave, MTN.",
  alternates: { canonical: APP_URL },
  openGraph: {
    title: "Elite Turf — Pronostics PMU & Analyses Hippiques Premium",
    description:
      "Pronostics PMU du jour analysés par des experts hippiques. Résultats transparents et vérifiables.",
    url: APP_URL,
    siteName: "Elite Turf",
    locale: "fr_FR",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <>
      {/* 1 — Hero : clarté immédiate + 2 CTAs */}
      <HeroSection />

      {/* 2 — Réassurance rapide : 4 piliers (expertise, transparence, paiement, accès) */}
      <WhyChooseUsSection />

      {/* 3 — Pronostics du jour : pilier central */}
      <PronosticsSection />

      {/* 4 — Programme des courses du jour */}
      <CoursesSection />

      {/* 5 — Comment ça marche : 4 étapes */}
      <HowItWorksSection />

      {/* 6 — Résultats & performances */}
      <StatsSection />

      {/* 7 — Offres / abonnements */}
      <PricingSection />

      {/* 8 — Témoignages */}
      <TestimonialsSection />

      {/* 9 — FAQ */}
      <FAQSection />

      {/* 10 — Guide gratuit : lead magnet avant footer */}
      <GuideBlocSection />

      {/* 11 — Maillage interne */}
      <section className="py-8 px-4 bg-bg-card/30 border-t border-border/30">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-text-muted text-xs uppercase tracking-widest font-semibold mb-5">
            Explorer Elite Turf
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[
              { href: "/pronostics",   label: "Pronostics du jour" },
              { href: "/abonnements",  label: "Abonnements"        },
              { href: "/performances", label: "Résultats"          },
              { href: "/blog",         label: "Blog hippique"      },
              { href: "/archives",     label: "Archives"           },
              { href: "/a-propos",     label: "À propos"           },
              { href: "/contact",      label: "Contact"            },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-text-secondary hover:text-gold-light text-sm transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 12 — Disclaimer jeu responsable */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-xl border border-border bg-bg-elevated/60 p-5 flex items-start gap-4">
            <AlertTriangle className="w-5 h-5 text-status-partial flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-text-secondary text-xs leading-relaxed">
                <span className="text-text-primary font-semibold">Avertissement — Jeu Responsable.</span>{" "}
                Les pronostics publiés sur Elite Turf sont fournis à titre informatif et ne constituent
                pas une garantie de gain. Le jeu peut être dangereux. Jouez de manière responsable et
                ne misez que ce que vous pouvez vous permettre de perdre. Si vous ressentez une dépendance,
                contactez{" "}
                <a href="tel:0974751313" className="text-gold-primary hover:underline font-medium">
                  Joueurs Info Service au 09 74 75 13 13
                </a>{" "}
                (appel non surtaxé, 7j/7). Elite Turf, 34 boulevard des Italiens, 75009 Paris, France.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 13 — Final CTA */}
      <section id="final-cta" className="py-20 pb-32 md:pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-racing-green/10 via-transparent to-gold-faint" />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            Commencez avec{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #C9A84C, #F0E0B0, #A07830)" }}
            >
              Elite Turf dès aujourd&apos;hui
            </span>
          </h2>
          <p className="text-text-secondary mb-10 text-base sm:text-lg max-w-xl mx-auto">
            Pronostics, analyses, performances et guide gratuit —{" "}
            dans une interface claire, honnête et pensée pour durer.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/pronostics"
              className="flex items-center gap-2 px-7 py-4 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold w-full sm:w-auto justify-center"
            >
              🏆 Voir les pronostics
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/guide-initie"
              className="flex items-center gap-2 px-7 py-4 bg-bg-elevated hover:bg-bg-hover border border-gold-primary/30 hover:border-gold-primary/60 text-gold-light font-semibold text-sm rounded-xl transition-all w-full sm:w-auto justify-center"
            >
              <Download className="w-4 h-4" />
              Guide gratuit
            </Link>
            <Link
              href="/abonnements"
              className="flex items-center gap-2 px-7 py-4 border border-border hover:border-gold-primary/40 text-text-primary font-semibold text-sm rounded-xl transition-all w-full sm:w-auto justify-center"
            >
              Découvrir les abonnements
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
