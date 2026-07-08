import type { Metadata } from "next";

// ISR : la page est régénérée au max toutes les 60s côté Cloudflare/Next.
// Permet le cache edge → TTFB < 100ms pour 99% du trafic, fraîcheur acceptable
// pour la home (stats agrégées + 5 prochaines courses).
export const revalidate = 60;
import HeroSection from "@/components/home/HeroSection";
import { getHomeStats } from "@/lib/stats/home-stats";
import WhyChooseUsSection from "@/components/home/WhyChooseUsSection";
import CoursesSection from "@/components/home/CoursesSection";
import NotreSelectionSection from "@/components/home/NotreSelectionSection";
import RadarPresseSection from "@/components/home/RadarPresseSection";
import { getRadarVedette } from "@/lib/consensus/radar-vedette";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserSubscription } from "@/lib/auth/subscription";
import PronosticsSection from "@/components/home/PronosticsSection";
import StatsSection from "@/components/home/StatsSection";
import PricingSection from "@/components/home/PricingSection";
import OperateursANJ from "@/components/home/OperateursANJ";
import FAQSection from "@/components/home/FAQSection";
import GuideBlocSection from "@/components/home/GuideBlocSection";
import PreuveSection from "@/components/home/PreuveSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import Link from "next/link";
import { ArrowRight, AlertTriangle, Download } from "lucide-react";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const metadata: Metadata = {
  title: "Elite Turf — Pronostics PMU & Analyses Hippiques Premium",
  description:
    "Pronostics PMU du jour analysés par des experts hippiques. Quinté+, Quarté+, Tiercé. Résultats publiés en toute transparence. Abonnements dès 65€ — Paiement par carte bancaire (Visa/Mastercard), toutes cartes tous pays. Mobile Money bientôt.",
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

// ── JSON-LD schemas pour le SEO ────────────────────────────────────
const homeFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "À quelle heure les pronostics sont-ils publiés ?",
      acceptedAnswer: { "@type": "Answer", text: "Les pronostics du jour (Quinté+, Quarté+, Tiercé) sont publiés chaque matin entre 8h30 et 9h30 (heure GMT, soit l'heure locale d'Abidjan et Dakar). Si vous êtes abonné, vous recevez une alerte par email et WhatsApp dès la publication." } },
    { "@type": "Question", name: "Faut-il créer un compte pour consulter les pronostics ?",
      acceptedAnswer: { "@type": "Answer", text: "Non. Un pronostic gratuit (Tiercé) est accessible chaque jour sans inscription. Les pronostics Starter, Pro et Elite nécessitent un abonnement payant à partir de 65€." } },
    { "@type": "Question", name: "Comment payer depuis la Côte d'Ivoire ou l'Afrique ?",
      acceptedAnswer: { "@type": "Answer", text: "Choisissez votre plan et payez par carte bancaire (Visa/Mastercard) — toutes cartes, tous pays, y compris prépayées. Votre accès est actif en moins de 2 minutes. Le paiement Mobile Money arrive bientôt (Burkina, Mali, Sénégal…)." } },
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

// Pas de BreadcrumbList sur la home (page racine) : une liste de liens de nav
// typée BreadcrumbList faisait afficher à Google un fil d'Ariane erroné
// (« Accueil › … › Blog › Performances ») sur le résultat d'accueil. Retiré 2026-06-20.

/**
 * Vrai abonné = plan payant ACTIF (STARTER/PRO/ELITE non expiré). Suit le
 * même pattern que PronosticsSection (createClient → getUser → statut effectif).
 * Sert à MASQUER le Radar de la presse aux abonnés (ils ont déjà le pronostic).
 */
async function isVraiAbonne(): Promise<boolean> {
  try {
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return false;
    const sub = await resolveUserSubscription(createServiceClient(), user.id);
    return sub !== "GRATUIT" && sub !== "EXPIRE";
  } catch {
    return false; // non authentifié / erreur → traité comme visiteur
  }
}

export default async function HomePage() {
  // Stats SSR + Radar presse (course vedette) + statut abonné, en parallèle.
  const [heroStats, radar, abonne] = await Promise.all([
    getHomeStats(),
    getRadarVedette(),
    isVraiAbonne(),
  ]);

  return (
    <>
      {/* JSON-LD — FAQPage uniquement (pas de breadcrumb sur la page racine) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd) }} />

      {/* 1 — Hero : clarté immédiate + 2 CTAs (stats en SSR via prop) */}
      <HeroSection stats={heroStats} />

      {/* 1b — Le Radar de la presse : consensus de la course vedette, tout en haut
            pour motiver l'indécis. Visiteurs + inscrits gratuits uniquement
            (invisible pour les abonnés payants). Repli sur l'ancien bloc « Sélection
            gratuite » tant qu'aucun consensus n'est publié pour aujourd'hui. */}
      {!abonne && (radar ? <RadarPresseSection data={radar} /> : <NotreSelectionSection />)}

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

      {/* 7b — Opérateurs agréés ANJ (requis certification Google Ads) */}
      <OperateursANJ />

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
                (appel non surtaxé, 7j/7). Elite Turf est une marque commerciale exploitée par{" "}
                <strong className="text-text-primary">TSALACH VENTURES LLC</strong>, 30 N Gould St, STE R,
                Sheridan, WY 82801, États-Unis.
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
