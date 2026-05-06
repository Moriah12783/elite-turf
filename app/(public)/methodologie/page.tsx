/**
 * /methodologie — Comment Elite Turf fait ses pronostics.
 *
 * Page E-E-A-T (Expertise, Experience, Authoritativeness, Trustworthiness)
 * crucial pour Google YMYL (Your Money Your Life — qui inclut le pari hippique).
 *
 * Cible : prospects sceptiques + Google. Établit la crédibilité avant la
 * conversion. Référencée depuis le footer + ancrée depuis homepage.
 */

import { Metadata } from "next";
import Link from "next/link";
import {
  Brain, Database, Eye, ShieldCheck, Award, ChevronRight,
  CheckCircle2, MapPin, BookOpen, Zap,
} from "lucide-react";
import PageHero from "@/components/layout/PageHero";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const revalidate = 86400; // 24h — page statique éditoriale

export const metadata: Metadata = {
  title: "Notre méthodologie — Comment nous analysons les courses PMU | Elite Turf",
  description:
    "Découvrez la méthodologie Elite Turf : analyse data-driven combinée à 5 ans d'expertise hippique. IA, données PMU officielles, validation experte humaine. Transparence totale.",
  alternates: { canonical: `${APP_URL}/methodologie` },
  openGraph: {
    title: "Notre méthodologie — Elite Turf",
    description: "Comment Elite Turf produit ses pronostics PMU : data + IA + expertise humaine.",
    url: `${APP_URL}/methodologie`,
    type: "article",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type":    "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil",      item: APP_URL },
    { "@type": "ListItem", position: 2, name: "Méthodologie", item: `${APP_URL}/methodologie` },
  ],
};

const articleJsonLd = {
  "@context":     "https://schema.org",
  "@type":        "Article",
  headline:       "Notre méthodologie de pronostic PMU",
  description:    "Comment Elite Turf produit ses analyses : data PMU officielles + IA + validation experte.",
  datePublished:  "2026-05-06",
  dateModified:   "2026-05-06",
  author:    { "@type": "Organization", name: "Elite Turf", url: APP_URL },
  publisher: {
    "@type": "Organization",
    name:    "Elite Turf",
    logo:    { "@type": "ImageObject", url: `${APP_URL}/og-image.jpg` },
  },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${APP_URL}/methodologie` },
  inLanguage: "fr-FR",
};

const STEPS = [
  {
    icon: Database,
    title: "1. Sources de données officielles",
    text: "Nos pronostics s'appuient exclusivement sur les données officielles des programmes PMU France et des hippodromes africains (LONACI Côte d'Ivoire, LONASE Sénégal, MDJS Maroc). Partants, jockeys, entraîneurs, cotes probables, musique, terrain, distance — tout est synchronisé en temps réel via les flux Geny et PMU.",
    bullets: [
      "Programmes PMU France synchronisés à J−1 vers 17h45",
      "Cotes Geny actualisées toutes les heures",
      "Arrivées officielles publiées dès la fin de chaque course",
      "Historique de plusieurs années consultable sur fiche cheval/jockey/entraineur",
    ],
  },
  {
    icon: Brain,
    title: "2. Analyse data-driven",
    text: "Pour chaque course retenue, notre système croise plus de 30 critères mesurables : forme récente du cheval (musique sur 6 dernières courses), affinité jockey-piste, performance entraîneur sur l'hippodrome, terrain, distance, place de corde, poids, série gagnante en cours, qualité des concurrents. Aucune divination — uniquement des signaux quantifiables.",
    bullets: [
      "Croisement musique cheval × distance × terrain",
      "Performance jockey sur l'hippodrome ciblé (top jockeys par lieu)",
      "Score d'entraînement basé sur les 30 derniers jours",
      "Détection des chevaux en remontée de forme (musique progressive)",
    ],
  },
  {
    icon: Award,
    title: "3. Validation par un expert humain",
    text: "Aucun pronostic n'est publié sans validation humaine. Notre expert hippique, basé à Paris avec 5 ans de couverture quotidienne du turf, relit chaque sélection avant publication. Il intègre les variables que la machine ne capte pas : déclaration de non-partants de dernière minute, conditions de piste live, intuitions sur les acteurs.",
    bullets: [
      "Tour de relecture systématique avant publication",
      "Intégration des dernières infos (forfait, pénalité, terrain dégradé)",
      "Validation de la cohérence stratégique (ne pas tout miser sur favoris)",
      "Confidence score 1 à 5 attribué pour chaque pronostic",
    ],
  },
  {
    icon: Eye,
    title: "4. Publication transparente",
    text: "Chaque pronostic est publié AVANT le départ de la course (généralement 7h pour le Quinté+, 9h pour Tiercé/Quarté). Une fois la course terminée, l'arrivée officielle est mise à jour automatiquement et le résultat est visible publiquement — gagnant, partiel ou perdant. Pas de réécriture après coup.",
    bullets: [
      "Publication horodatée (date_publication non modifiable)",
      "Résultat affiché GAGNANT / PARTIEL / PERDANT visible par tous",
      "Lien direct vers Geny pour vérifier l'arrivée officielle",
      "Historique complet sur la page Performances",
    ],
  },
  {
    icon: ShieldCheck,
    title: "5. Vérifiabilité totale",
    text: "Notre page Performances expose l'historique complet de tous nos pronostics publiés — gagnants ET perdants. Vous pouvez vérifier le taux de réussite, le ROI cumulé, les performances par type de pari ou par hippodrome. Aucun cherry-picking, aucune réécriture.",
    bullets: [
      "Taux de réussite calculé en temps réel sur tout l'historique",
      "ROI cumulé sur 30 jours affiché en page d'accueil",
      "Statistiques par type (Quinté+ / Quarté+ / Tiercé)",
      "Statistiques par hippodrome",
    ],
  },
];

const FAQ = [
  {
    q: "Pourquoi parlez-vous d'IA ?",
    a: "Notre système utilise des modèles statistiques pour scorer les partants sur des critères mesurables (musique, jockey, entraîneur, etc.). Ce n'est pas de la magie — c'est de l'analyse data-driven assistée. Le mot 'IA' est utilisé au sens large d'intelligence augmentée, pas de garantie de gain.",
  },
  {
    q: "Les pronostics sont-ils 100 % fiables ?",
    a: "Non. Aucun pronostic hippique n'est fiable à 100 % — sinon les hippodromes auraient fait faillite. Notre objectif est de battre le hasard sur le long terme avec un taux de réussite et un ROI vérifiables. Le pari sportif/hippique reste un jeu d'argent et comporte un risque de perte.",
  },
  {
    q: "Pourquoi parler de transparence ?",
    a: "La majorité des sites de pronostics ne publient que leurs gagnants ou réécrivent leur historique. Nous publions tout, perdants compris. Notre taux de réussite global est calculé sur l'intégralité des pronostics publiés, pas sur une sélection biaisée.",
  },
  {
    q: "Pourquoi un site français pour l'Afrique francophone ?",
    a: "Nous couvrons les courses PMU France (programmes officiels) ET les courses LONACI Côte d'Ivoire. Les courses françaises restent les plus jouées en Afrique francophone — via PMU-CI, LONASE Sénégal, MDJS Maroc. Notre méthodologie est identique pour tous les marchés.",
  },
];

export default function MethodologiePage() {
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
        titre="Notre méthodologie"
        sousTitre="Data PMU officielles · IA assistée · Validation experte humaine · Publication transparente"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary">Méthodologie</span>
        </nav>

        {/* Intro */}
        <div className="mb-10">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary mb-4 leading-tight">
            Comment nous analysons les courses PMU
          </h1>
          <p className="text-text-secondary text-base sm:text-lg leading-relaxed">
            Elite Turf publie chaque jour des pronostics PMU. Voici exactement comment ils sont produits :
            les sources de données utilisées, l&apos;analyse algorithmique, la validation par notre expert,
            et la manière dont les résultats sont rendus publics et vérifiables.
          </p>
        </div>

        {/* Étapes */}
        <div className="space-y-10 mb-16">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <section key={idx} className="card-base p-6 sm:p-8">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-gold-primary" />
                  </div>
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-text-primary leading-tight pt-1">
                    {step.title}
                  </h2>
                </div>
                <p className="text-text-secondary text-sm sm:text-base leading-relaxed mb-4">
                  {step.text}
                </p>
                <ul className="space-y-2">
                  {step.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                      <CheckCircle2 className="w-4 h-4 text-status-win flex-shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {/* Bandeau "vérifiable" */}
        <div className="mb-16 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-bg-card via-[#1A1610] to-bg-card border border-gold-primary/30">
          <div className="flex items-start gap-4">
            <Zap className="w-8 h-8 text-gold-primary flex-shrink-0" />
            <div>
              <h3 className="font-serif text-xl font-bold text-text-primary mb-2">
                Tout est vérifiable
              </h3>
              <p className="text-text-secondary text-sm sm:text-base leading-relaxed mb-4">
                Vous pouvez consulter à tout moment l&apos;historique complet de nos pronostics
                avec leurs résultats officiels — gagnants ou perdants. Pas de filtrage,
                pas de réécriture.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/performances"
                  className="inline-flex items-center gap-1 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all"
                >
                  Voir nos performances <ChevronRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/archives"
                  className="inline-flex items-center gap-1 px-4 py-2 bg-bg-elevated border border-border text-text-secondary text-sm rounded-xl hover:border-gold-primary/40 transition-all"
                >
                  Archives complètes <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-gold-primary" />
            Questions fréquentes sur notre méthode
          </h2>
          <div className="space-y-4">
            {FAQ.map((item, idx) => (
              <details
                key={idx}
                className="card-base p-5 group cursor-pointer"
              >
                <summary className="font-semibold text-text-primary text-base list-none flex items-start justify-between gap-3">
                  <span>{item.q}</span>
                  <ChevronRight className="w-4 h-4 text-gold-primary flex-shrink-0 mt-1 transition-transform group-open:rotate-90" />
                </summary>
                <p className="text-text-secondary text-sm leading-relaxed mt-3 pt-3 border-t border-border/50">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>

        {/* Disclaimer jeu responsable */}
        <div className="mb-12 p-5 rounded-xl bg-bg-elevated border border-status-loss/20">
          <h3 className="font-serif text-base font-bold text-text-primary mb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-status-loss" />
            Jeu responsable
          </h3>
          <p className="text-text-muted text-xs sm:text-sm leading-relaxed">
            Le pari hippique est un jeu d&apos;argent comportant un risque de perte. Elite Turf publie des
            analyses à titre informatif — nous ne garantissons aucun gain. Jouez avec modération,
            fixez-vous une bankroll et ne jouez jamais l&apos;argent dont vous avez besoin pour vivre.
            En cas de problème, contactez{" "}
            <a href="https://www.joueurs-info-service.fr" target="_blank" rel="noopener noreferrer" className="text-gold-primary hover:text-gold-light underline">
              Joueurs Info Service
            </a>.
          </p>
        </div>

        {/* Lien équipe */}
        <div className="text-center pt-8 border-t border-border/50">
          <p className="text-text-muted text-sm mb-4 inline-flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gold-primary" />
            Nos experts sont basés à Paris depuis 5 ans
          </p>
          <Link
            href="/a-propos"
            className="inline-flex items-center gap-1 text-gold-primary hover:text-gold-light text-sm font-semibold"
          >
            En savoir plus sur l&apos;équipe Elite Turf <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
