/**
 * /arnaques-pronostics — Guide « Comment repérer une arnaque de pronostics PMU ».
 *
 * Quick win « page éducative » issu de l'étude « Voix du parieur » (2026-06-19) :
 * la douleur n°1 des parieurs est la méfiance (faux bilans, preuves truquées,
 * coupons « sûrs », paiement sans recours). Cette page :
 *   1. éduque le parieur (pièges DOCUMENTÉS, 100 % factuels, zéro concurrent nommé) ;
 *   2. capte le SEO (« arnaque pronostic pmu », « faux pronostiqueur »…) ;
 *   3. positionne Elite Turf à l'inverse (transparence, paiement traçable, garantie),
 *      en s'appuyant UNIQUEMENT sur les engagements réels du site (cf. /abonnements,
 *      /performances, /methodologie). Aucune sur-promesse.
 */

import { Metadata } from "next";
import Link from "next/link";
import {
  Percent, EyeOff, ImageOff, Copy, ShieldAlert, Banknote, Ghost, Megaphone,
  CheckCircle2, ShieldCheck, Eye, CreditCard, Gift, Globe, ChevronRight, BookOpen,
} from "lucide-react";
import PageHero from "@/components/layout/PageHero";
import FaqJsonLd, { FaqSection } from "@/components/seo/FaqJsonLd";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const revalidate = 86400; // 24h — page statique éditoriale

export const metadata: Metadata = {
  title: "Arnaques de pronostics PMU : les pièges à repérer | Elite Turf",
  description:
    "Faux bilans, « 100 % de réussite », coupons « sûrs », paiement WhatsApp sans recours : apprenez à repérer une arnaque de pronostics PMU et à payer en sécurité.",
  keywords: [
    "arnaque pronostic pmu", "arnaque pronostic turf", "faux pronostiqueur",
    "pmub vip arnaque", "coupon sûr pmu arnaque", "comment reconnaître un bon pronostiqueur",
  ],
  alternates: { canonical: `${APP_URL}/arnaques-pronostics` },
  openGraph: {
    title: "Arnaques de pronostics PMU : les pièges à repérer",
    description:
      "Les signaux d'alerte d'une arnaque de pronostics (faux bilans, coupons « sûrs », paiement sans recours) et comment s'en protéger.",
    url: `${APP_URL}/arnaques-pronostics`,
    type: "article",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL },
    { "@type": "ListItem", position: 2, name: "Repérer une arnaque de pronostics", item: `${APP_URL}/arnaques-pronostics` },
  ],
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Comment repérer une arnaque de pronostics PMU",
  description:
    "Guide des signaux d'alerte d'une arnaque de pronostics hippiques (faux bilans, preuves truquées, coupons « sûrs », paiement sans recours) et conseils pour payer en sécurité.",
  datePublished: "2026-06-19",
  dateModified: "2026-06-19",
  author: { "@type": "Person", name: "Stéphane Y.", url: `${APP_URL}/equipe-redactionnelle`, jobTitle: "Fondateur & Rédacteur en chef" },
  publisher: {
    "@type": "NewsMediaOrganization",
    name: "Elite Turf",
    url: APP_URL,
    logo: { "@type": "ImageObject", url: `${APP_URL}/images/logo-v2/logo-square-1000.png`, width: 1000, height: 1000 },
  },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${APP_URL}/arnaques-pronostics` },
  inLanguage: "fr-FR",
};

/* Pièges DOCUMENTÉS (étude « Voix du parieur »). Description de PRATIQUES, jamais
   de site nommé. 100 % factuel. */
const SIGNAUX = [
  {
    icon: Percent,
    titre: "Un bilan « parfait » ou « 100 % de réussite »",
    texte:
      "Personne ne peut donner systématiquement l'ordre d'arrivée. Un taux affiché proche de la perfection est mathématiquement impossible : c'est le piège le plus classique.",
  },
  {
    icon: EyeOff,
    titre: "Les pertes qui disparaissent",
    texte:
      "On ne vous montre que les pronostics gagnants ; les perdants sont effacés ou jamais publiés. Ce biais de sélection est devenu la norme sur les réseaux sociaux.",
  },
  {
    icon: ImageOff,
    titre: "Des captures d'écran de tickets « gagnants »",
    texte:
      "Une capture ne prouve rien. Un ticket se truque en quelques secondes : un pari perdant devient gagnant, une mise de 1 € devient 1 000 €. Les tickets en image ne sont pas une preuve.",
  },
  {
    icon: Copy,
    titre: "La méthode « un gagnant pour tout le monde »",
    texte:
      "Le vendeur envoie des pronostics différents à chaque client et couvre toutes les combinaisons. Forcément, l'un d'eux passe — et c'est le seul qu'il met en avant ensuite.",
  },
  {
    icon: ShieldAlert,
    titre: "La promesse « garanti » ou « coupon sûr »",
    texte:
      "Aucun gain n'est garanti au turf. La brigade de lutte contre la cybercriminalité (BCLCC), au Burkina Faso, recommande officiellement de ne JAMAIS payer pour un pronostic ou un coupon présenté comme « sûr ».",
  },
  {
    icon: Banknote,
    titre: "Le paiement anonyme, hors plateforme",
    texte:
      "Transfert par Mobile Money ou Western Union vers un numéro personnel, négocié par WhatsApp, sans reçu ni facture : aucune trace, aucun recours, aucun remboursement possible.",
  },
  {
    icon: Ghost,
    titre: "Le « VIP » qui peut disparaître",
    texte:
      "Beaucoup de vendeurs encaissent les abonnements puis ferment leur page du jour au lendemain. Sans paiement traçable, votre argent est perdu.",
  },
  {
    icon: Megaphone,
    titre: "Les faux témoignages et les liasses de billets",
    texte:
      "Photos de liasses de billets, fausses captures de gains, avis dithyrambiques postés par des comptes factices : une mise en scène fabriquée pour gagner votre confiance.",
  },
];

const CHECKLIST = [
  "Suivez un service plusieurs semaines AVANT de payer le moindre franc.",
  "Exigez un bilan COMPLET — pertes incluses —, idéalement horodaté avant la course.",
  "Méfiez-vous de tout « garanti », « sûr » ou « 100 % de réussite ».",
  "Refusez le paiement anonyme (numéro personnel, WhatsApp) ; privilégiez un paiement traçable.",
  "Vérifiez vous-même l'arrivée officielle (PMU, Geny) plutôt que de croire une capture.",
];

const ELITE = [
  {
    icon: Eye,
    titre: "Des résultats publics — gagnants ET perdants",
    texte:
      "Chaque pronostic est publié avant le départ, horodaté, et son résultat (gagnant, partiel ou perdant) reste visible par tous sur notre page Performances. Aucun pronostic n'est effacé ni réécrit après coup.",
  },
  {
    icon: ShieldCheck,
    titre: "Aucune promesse de gain « garanti »",
    texte:
      "Le pari hippique comporte un risque de perte et nous ne le cachons pas. Nous ne vendons jamais de « coupon sûr » : nous publions des analyses, pas des miracles.",
  },
  {
    icon: CreditCard,
    titre: "Un paiement traçable et sécurisé",
    texte:
      "Le paiement se fait par carte bancaire sécurisée (toutes cartes, tous pays), avec accès activé immédiatement — jamais par transfert vers un numéro personnel. Le Mobile Money direct arrive prochainement.",
  },
  {
    icon: Gift,
    titre: "Une garantie écrite",
    texte:
      "Si votre premier pronostic expert est perdant, nous prolongeons votre accès de 7 jours, offerts (une fois par abonné, après vérification du résultat). Un vendeur d'arnaque ne prend jamais ce genre d'engagement.",
  },
];

export default function ArnaquesPronosticsPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <PageHero
        image="/images/heroes/hero-a-propos.jpg"
        titre="Comment repérer une arnaque de pronostics PMU"
        sousTitre="Faux bilans, faux taux de réussite, coupons « sûrs », paiement sans recours : les pièges à connaître — et comment s'en protéger."
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary">Repérer une arnaque de pronostics</span>
        </nav>

        {/* Intro */}
        <div className="mb-12">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary mb-4 leading-tight">
            Les pièges des vendeurs de pronostics — et comment les éviter
          </h1>
          <p className="text-text-secondary text-base sm:text-lg leading-relaxed">
            Le turf attire les arnaqueurs : sites de pronostics « miracles », « gourous » sur
            WhatsApp ou Telegram, coupons « garantis »… Beaucoup de parieurs se font piéger. Voici
            les signaux d&apos;alerte à connaître pour ne plus jamais payer pour du vent — et les
            réflexes pour payer en sécurité.
          </p>
        </div>

        {/* Signaux d'alerte */}
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-6 flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-gold-primary" />
          Les 8 signaux d&apos;alerte d&apos;une arnaque
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 mb-16">
          {SIGNAUX.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="card-base p-5">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-status-loss/10 border border-status-loss/30 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-status-loss" />
                  </div>
                  <h3 className="font-serif text-base font-bold text-text-primary leading-snug pt-1">
                    {s.titre}
                  </h3>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed">{s.texte}</p>
              </div>
            );
          })}
        </div>

        {/* Vigilance Afrique francophone */}
        <div className="mb-16 p-6 sm:p-8 rounded-2xl bg-bg-card border border-gold-primary/30">
          <div className="flex items-start gap-4">
            <Globe className="w-8 h-8 text-gold-primary flex-shrink-0" />
            <div>
              <h3 className="font-serif text-xl font-bold text-text-primary mb-2">
                Vigilance particulière en Afrique francophone
              </h3>
              <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
                Les arnaques de pronostics y sont nombreuses, au point que la brigade de lutte contre
                la cybercriminalité (BCLCC) au Burkina Faso a émis une alerte publique : ne payez
                jamais pour un pronostic ou un coupon présenté comme « sûr ». La plupart de ces
                vendeurs exigent un paiement par Mobile Money vers un numéro personnel, via WhatsApp,
                sans aucun reçu ni recours possible. Un service sérieux propose toujours un paiement
                traçable.
              </p>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-6 flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-status-win" />
          La checklist du parieur prudent
        </h2>
        <div className="card-base p-6 sm:p-8 mb-16">
          <ul className="space-y-3">
            {CHECKLIST.map((c, i) => (
              <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-text-secondary">
                <CheckCircle2 className="w-5 h-5 text-status-win flex-shrink-0 mt-0.5" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Comment Elite Turf fonctionne à l'inverse */}
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-3 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-gold-primary" />
          À l&apos;inverse : comment fonctionne Elite Turf
        </h2>
        <p className="text-text-secondary text-sm sm:text-base leading-relaxed mb-6">
          Elite Turf a été conçu sur l&apos;exact opposé de ces pratiques. Voici nos engagements,
          vérifiables à tout moment :
        </p>
        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          {ELITE.map((e, i) => {
            const Icon = e.icon;
            return (
              <div key={i} className="card-base p-5">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gold-primary" />
                  </div>
                  <h3 className="font-serif text-base font-bold text-text-primary leading-snug pt-1">
                    {e.titre}
                  </h3>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed">{e.texte}</p>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mb-16">
          <Link
            href="/performances"
            className="inline-flex items-center gap-1 px-5 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all"
          >
            Voir nos performances <ChevronRight className="w-4 h-4" />
          </Link>
          <Link
            href="/methodologie"
            className="inline-flex items-center gap-1 px-5 py-3 bg-bg-elevated border border-border text-text-secondary text-sm rounded-xl hover:border-gold-primary/40 transition-all"
          >
            Notre méthodologie <ChevronRight className="w-4 h-4" />
          </Link>
          <Link
            href="/abonnements"
            className="inline-flex items-center gap-1 px-5 py-3 bg-bg-elevated border border-border text-text-secondary text-sm rounded-xl hover:border-gold-primary/40 transition-all"
          >
            Découvrir les abonnements <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* FAQ visible + JSON-LD (même source de vérité) */}
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-2 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-gold-primary" />
          Questions fréquentes
        </h2>
        <FaqJsonLd items={FAQ} />
        <FaqSection items={FAQ} title="" />

        {/* Disclaimer jeu responsable */}
        <div className="mt-8 p-5 rounded-xl bg-bg-elevated border border-status-loss/20">
          <h3 className="font-serif text-base font-bold text-text-primary mb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-status-loss" />
            Jeu responsable
          </h3>
          <p className="text-text-muted text-xs sm:text-sm leading-relaxed">
            Le pari hippique est un jeu d&apos;argent comportant un risque de perte. Elite Turf publie
            des analyses à titre informatif — nous ne garantissons aucun gain. Jouez avec modération.
            En cas de besoin, contactez{" "}
            <a href="https://www.joueurs-info-service.fr" target="_blank" rel="noopener noreferrer" className="text-gold-primary hover:text-gold-light underline">
              Joueurs Info Service
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}

const FAQ = [
  {
    question: "Comment reconnaître un bon pronostiqueur PMU ?",
    answer:
      "Un service fiable publie un bilan complet (pertes incluses), idéalement horodaté avant la course, ne promet jamais de gain garanti, et propose un paiement traçable. Fuyez les « 100 % de réussite » et les « coupons sûrs ».",
  },
  {
    question: "Un taux de réussite de 100 % au PMU est-il possible ?",
    answer:
      "Non. Aucun pronostiqueur ne peut garantir l'ordre d'arrivée d'une course. Un bilan parfait, ou des promesses de gains garantis, sont un signal d'arnaque clair.",
  },
  {
    question: "Faut-il payer un pronostic présenté comme « sûr » ?",
    answer:
      "Non. La brigade de lutte contre la cybercriminalité (BCLCC) au Burkina Faso recommande de ne jamais payer pour un pronostic ou un coupon présenté comme « sûr ». Le « sûr » n'existe pas au turf.",
  },
  {
    question: "Comment payer un service de pronostics en sécurité ?",
    answer:
      "Privilégiez un paiement traçable (carte bancaire) sur une plateforme officielle. Évitez les transferts Mobile Money ou Western Union vers un numéro personnel négociés par WhatsApp : sans reçu ni recours, vous ne pourrez pas être remboursé.",
  },
  {
    question: "Comment Elite Turf prouve ses résultats ?",
    answer:
      "Chaque pronostic est publié avant le départ, horodaté, et son résultat (gagnant, partiel ou perdant) reste public sur la page Performances. Rien n'est effacé ni réécrit après la course.",
  },
];
