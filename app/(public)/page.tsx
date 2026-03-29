import HeroSection from "@/components/home/HeroSection";
import WhyChooseUsSection from "@/components/home/WhyChooseUsSection";
import CoursesSection from "@/components/home/CoursesSection";
import PronosticsSection from "@/components/home/PronosticsSection";
import StatsSection from "@/components/home/StatsSection";
import PricingSection from "@/components/home/PricingSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <WhyChooseUsSection />
      <CoursesSection />
      <PronosticsSection />
      <StatsSection />
      <PricingSection />
      <TestimonialsSection />

      {/* ── CTA Guide Gratuit ── */}
      <section className="py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-gold-primary/40 bg-gradient-to-r from-gold-faint via-bg-elevated to-gold-faint p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
            <div className="text-4xl flex-shrink-0">🏇</div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-gold-light text-xs font-bold uppercase tracking-widest mb-1">Guide Gratuit</p>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-text-primary mb-2">
                5 secrets pour détecter les outsiders gagnants
              </h3>
              <p className="text-text-secondary text-sm">
                Le guide PDF que 847 parieurs francophones ont déjà téléchargé. 100% gratuit, sans engagement.
              </p>
            </div>
            <Link
              href="/guide-initie"
              className="flex-shrink-0 px-6 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold whitespace-nowrap"
            >
              Télécharger →
            </Link>
          </div>
        </div>
      </section>

      {/* ── DISCLAIMER jeu responsable ── */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-xl border border-border bg-bg-elevated/60 p-5 flex items-start gap-4">
            <AlertTriangle className="w-5 h-5 text-status-partial flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-text-secondary text-xs leading-relaxed">
                <span className="text-text-primary font-semibold">Avertissement — Jeu Responsable.</span>{" "}
                Les pronostics publiés sur Elite Turf sont fournis à titre informatif et ne constituent pas une garantie de gain.
                Le jeu peut être dangereux. Jouez de manière responsable et ne misez que ce que vous pouvez vous permettre de perdre.
                Si vous ressentez une dépendance, contactez{" "}
                <a href="tel:0974751313" className="text-gold-primary hover:underline font-medium">Joueurs Info Service au 09 74 75 13 13</a>{" "}
                (appel non surtaxé, 7j/7).
                Elite Turf, 34 boulevard des Italiens, 75009 Paris, France.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-racing-green/10 via-transparent to-gold-faint" />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            Prêt à Rejoindre{" "}
            <span className="text-gold-gradient bg-gold-gradient bg-clip-text">
              les Gagnants ?
            </span>
          </h2>
          <p className="text-text-secondary mb-8 text-lg">
            Inscrivez-vous gratuitement et accédez aux pronostics du jour.
            Passez Premium en quelques clics avec Orange Money.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/inscription"
              className="flex items-center gap-2 px-8 py-4 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-base rounded-xl transition-all shadow-gold w-full sm:w-auto justify-center"
            >
              Créer mon compte gratuit
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/pronostics"
              className="flex items-center gap-2 px-8 py-4 border border-border hover:border-gold-primary/40 text-text-primary font-semibold text-base rounded-xl transition-all w-full sm:w-auto justify-center"
            >
              Voir les pronostics
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
