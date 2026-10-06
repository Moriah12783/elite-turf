/**
 * Contenu de la page d'accueil, partagé par deux routes (brief SEO du
 * 01/10/2026, B3 — accueil lent : 0,9 à 4,8 s, rendu à chaque visite) :
 *
 *   - `/` : version VISITEUR, mise en cache (ISR, force-static). C'est celle
 *     que reçoivent les visiteurs non connectés et Google.
 *   - `/accueil-membre` : version PERSONNALISÉE (Radar masqué aux abonnés
 *     payants, pronostics déverrouillés), servie par le middleware à la même
 *     adresse « / » aux membres connectés. Rien ne change pour eux.
 */
import HeroSection from "@/components/home/HeroSection";
import { getHomeStats } from "@/lib/stats/home-stats";
import WhyChooseUsSection from "@/components/home/WhyChooseUsSection";
import CoursesSection from "@/components/home/CoursesSection";
import NotreSelectionSection from "@/components/home/NotreSelectionSection";
import RadarPresseSection from "@/components/home/RadarPresseSection";
import { getRadarVedette } from "@/lib/consensus/radar-vedette";
import PronosticsSection from "@/components/home/PronosticsSection";
import StatsSection from "@/components/home/StatsSection";
import PricingSection from "@/components/home/PricingSection";
import OperateursANJ from "@/components/home/OperateursANJ";
import FAQSection from "@/components/home/FAQSection";
import GuideBlocSection from "@/components/home/GuideBlocSection";
import PreuveSection from "@/components/home/PreuveSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import { OU_PAYER_MOBILE_MONEY_DEBUT } from "@/lib/paiement/mobile-money";
import Link from "next/link";
import { ArrowRight, AlertTriangle, Download } from "lucide-react";

// ── JSON-LD schemas pour le SEO ────────────────────────────────────
const homeFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "Quand les pronostics sont-ils publiés ?",
      acceptedAnswer: { "@type": "Answer", text: "Les pronostics du jour (Quinté+, Quarté+, Tiercé) sont publiés avant le départ de la course concernée. Si vous êtes abonné, vous recevez une alerte par email et WhatsApp dès la publication." } },
    { "@type": "Question", name: "Faut-il créer un compte pour consulter les pronostics ?",
      acceptedAnswer: { "@type": "Answer", text: "Non pour l'offre gratuite : le Radar de la presse (le consensus des pronostics de la presse) et la Sélection stats sur chaque course sont accessibles sans inscription. Les pronostics experts Starter, Pro et Elite nécessitent un abonnement, à partir de 65 €." } },
    { "@type": "Question", name: "Comment payer depuis la Côte d'Ivoire ou l'Afrique ?",
      acceptedAnswer: { "@type": "Answer", text: `Choisissez votre plan et payez par carte bancaire (Visa/Mastercard) — toutes cartes, tous pays, y compris prépayées. Votre accès est actif en moins de 2 minutes. ${OU_PAYER_MOBILE_MONEY_DEBUT}, vous pouvez aussi payer par Orange Money ou Wave, en francs CFA : écrivez-nous sur WhatsApp. Dès réception du paiement, nous vous envoyons un reçu sur WhatsApp et votre accès est activé.` } },
    { "@type": "Question", name: "Les pronostics Elite Turf sont-ils fiables ?",
      acceptedAnswer: { "@type": "Answer", text: "Nos résultats sont publics et vérifiables. Vous pouvez consulter l'intégralité de notre historique sur la page Performances. Nous publions les bons comme les moins bons résultats — la transparence est notre engagement." } },
    { "@type": "Question", name: "Puis-je annuler mon abonnement à tout moment ?",
      acceptedAnswer: { "@type": "Answer", text: "Oui. Par défaut, c'est sans engagement : l'accès s'arrête seul à l'échéance, sans frais ni démarche. Si vous choisissez le renouvellement automatique (option à cocher au paiement), vous l'annulez à tout moment depuis votre espace membre — l'accès reste actif jusqu'à la fin de la période déjà payée." } },
    { "@type": "Question", name: "Que contient le guide gratuit Elite Turf ?",
      acceptedAnswer: { "@type": "Answer", text: "Le guide PDF 'Les 5 secrets pour détecter les outsiders gagnants' révèle les méthodes utilisées par nos experts : lecture de fiche, exploitation des côtes, identification des outsiders à valeur. 100% gratuit, accessible sans inscription." } },
    { "@type": "Question", name: "Le site est-il accessible depuis un téléphone mobile ?",
      acceptedAnswer: { "@type": "Answer", text: "Oui, Elite Turf est conçu mobile-first. L'interface est fluide et rapide sur tous les appareils. La majorité de nos parieurs africains consulte depuis leur téléphone." } },
  ],
};

/**
 * @param abonne       abonné payant actif → le Radar de la presse est masqué
 * @param personnalise lire la session pour déverrouiller les pronostics
 *                     (false sur la version publique mise en cache)
 */
export default async function AccueilSections({
  abonne,
  personnalise,
}: {
  abonne: boolean;
  personnalise: boolean;
}) {
  // Stats + Radar presse (course vedette), en parallèle.
  const [heroStats, radar] = await Promise.all([
    getHomeStats(),
    getRadarVedette(),
  ]);

  return (
    <>
      {/* JSON-LD — FAQPage uniquement (pas de breadcrumb sur la page racine) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd) }} />

      {/* Ordre voulu par Steph le 03/10/2026 : la Vedette du jour juste sous le
          hero, puis les courses du jour, le programme, les offres, la méthode,
          la confiance et enfin les résultats. */}

      {/* 1 — Hero : clarté immédiate + 2 CTAs (stats en SSR via prop) */}
      <HeroSection stats={heroStats} />

      {/* 2 — Pronostics du jour, pilier central : la Vedette du jour, puis le
            Radar de la presse (consensus de la course vedette ; repli sur l'ancien
            bloc « Sélection gratuite » tant qu'aucun consensus n'est publié pour
            aujourd'hui), puis les courses et pronostics disponibles aujourd'hui.
            Le Radar : visiteurs + inscrits gratuits uniquement (invisible pour
            les abonnés payants). */}
      <PronosticsSection
        personnalise={personnalise}
        sousLaVedette={abonne ? null : radar ? <RadarPresseSection data={radar} /> : <NotreSelectionSection />}
      />

      {/* 3 — Programme des courses du jour */}
      <CoursesSection />

      {/* 4 — Offres / abonnements */}
      <PricingSection />

      {/* 5 — Comment ça marche : 4 étapes */}
      <HowItWorksSection />

      {/* 6 — Notre engagement : pourquoi faire confiance (4 piliers : expertise,
            transparence, paiement, accès) */}
      <WhyChooseUsSection />

      {/* 7 — Nos résultats prouvés */}
      <StatsSection />

      {/* 8 — La preuve par les résultats (garanties réelles + méthode),
            remplace les témoignages inventés — audit S1.5 Lot 2 */}
      <PreuveSection />

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

      {/* 12 — Opérateurs agréés ANJ (requis certification Google Ads), avec
            l'avertissement jeu responsable juste dessous */}
      <OperateursANJ />

      {/* 13 — Disclaimer jeu responsable */}
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
                (appel non surtaxé, 7j/7). Elite Turf est une marque commerciale exploitée par{" "}
                <strong className="text-text-primary">TSALACH VENTURES LLC</strong>, 30 N Gould St, STE R,
                Sheridan, WY 82801, États-Unis.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 14 — Final CTA */}
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
