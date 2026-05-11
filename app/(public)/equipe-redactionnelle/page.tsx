import { Metadata } from "next";
import Link from "next/link";
import { User, Shield, Search, RefreshCw, AlertCircle, Mail, ArrowRight } from "lucide-react";
import PageHero from "@/components/layout/PageHero";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const metadata: Metadata = {
  title: "Équipe Rédactionnelle & Politique Éditoriale — Elite Turf",
  description:
    "Découvrez l'équipe rédactionnelle d'Elite Turf, notre processus éditorial, nos sources, notre politique de corrections et notre charte de transparence.",
  alternates: { canonical: `${APP_URL}/equipe-redactionnelle` },
  // Index obligatoire — Google News Publisher Center DOIT pouvoir crawler cette page
  // pour vérifier l'identité des auteurs et la politique éditoriale.
  robots: { index: true, follow: true },
};

// JSON-LD Person + Article — relie cette page aux auteurs cités dans les NewsArticle
const personJsonLd = {
  "@context": "https://schema.org",
  "@type":    "Person",
  name:       "Stéphane Y.",
  alternateName: "Yapi Landry Stéphane",
  url:        `${APP_URL}/equipe-redactionnelle`,
  jobTitle:   "Fondateur & Directeur de la publication",
  worksFor: {
    "@type": "NewsMediaOrganization",
    name:    "Elite Turf",
    url:     APP_URL,
  },
  description: "Fondateur d'Elite Turf, expert en analyse hippique et innovation décisionnelle. Plus de 10 ans d'expérience dans l'analyse des courses PMU françaises.",
};

export default function EquipeRedactionnellePage() {
  return (
    <div className="min-h-screen bg-bg-primary">

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />

      <PageHero
        image="/images/heroes/hero-a-propos.jpg"
        titre="Équipe Rédactionnelle"
        sousTitre="Qui écrit Elite Turf et comment nos pronostics sont produits"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-12">

        {/* ── ÉQUIPE ── */}
        <section>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
            <User className="w-7 h-7 text-gold-primary" />
            Notre équipe
          </h2>
          <p className="text-text-muted text-sm mb-6">
            Elite Turf est édité par une équipe restreinte, soucieuse d&apos;excellence et de transparence.
          </p>

          <div className="card-base p-6 sm:p-8">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center flex-shrink-0">
                <User className="w-8 h-8 text-gold-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif font-bold text-text-primary text-xl mb-1">
                  Stéphane Y.
                </h3>
                <p className="text-gold-light text-sm font-semibold mb-3">
                  Fondateur · Directeur de la publication · Rédacteur en chef
                </p>
                <p className="text-text-secondary text-sm leading-relaxed mb-3">
                  Passionné de courses hippiques et d&apos;innovation décisionnelle, Stéphane combine plus de
                  10 ans d&apos;observation des courses françaises avec une expertise en analyse de données et
                  intelligence artificielle. Il a fondé Elite Turf en 2026 avec l&apos;ambition d&apos;offrir
                  aux parieurs francophones une lecture méthodique et stratégique du turf.
                </p>
                <p className="text-text-muted text-xs">
                  Domaines : analyse des partants Quinté+, performances jockeys/entraîneurs, ROI des stratégies de pari.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── PROCESSUS ÉDITORIAL ── */}
        <section>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
            <Search className="w-7 h-7 text-gold-primary" />
            Notre processus éditorial
          </h2>
          <p className="text-text-muted text-sm mb-6">
            Chaque pronostic publié sur Elite Turf suit une méthodologie en 4 étapes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                num: "01",
                titre: "Collecte des données",
                texte:
                  "Programme officiel PMU, partants, cotes, musique des chevaux, performances historiques des jockeys et entraîneurs — agrégés depuis Geny.com et PMU.fr quotidiennement avant 8h.",
              },
              {
                num: "02",
                titre: "Analyse algorithmique",
                texte:
                  "Croisement automatisé de 40+ critères (cote vs taux victoire historique, forme récente, distance préférée, terrain, etc.) pour produire un score composite par cheval.",
              },
              {
                num: "03",
                titre: "Validation experte humaine",
                texte:
                  "Notre rédacteur en chef relit chaque sélection, ajuste si nécessaire en fonction de signaux non-quantifiables (état du terrain, déclarations entraîneurs, conditions météo) et rédige une analyse courte.",
              },
              {
                num: "04",
                titre: "Publication avant le départ",
                texte:
                  "Chaque pronostic est publié AVANT la course (jamais après) avec timestamp vérifiable. Le résultat est ensuite confronté à l'arrivée officielle PMU pour un suivi de performance transparent.",
              },
            ].map((step) => (
              <div key={step.num} className="card-base p-5">
                <div className="flex items-start gap-3">
                  <span className="text-3xl font-serif font-bold text-gold-primary leading-none">{step.num}</span>
                  <div className="flex-1">
                    <h3 className="font-serif font-bold text-text-primary text-base mb-2">{step.titre}</h3>
                    <p className="text-text-secondary text-sm leading-relaxed">{step.texte}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SOURCES ── */}
        <section>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
            <Shield className="w-7 h-7 text-gold-primary" />
            Nos sources
          </h2>
          <p className="text-text-muted text-sm mb-6">
            Pour garantir la fiabilité de nos analyses, nous nous appuyons sur des sources officielles et reconnues.
          </p>

          <div className="card-base p-6 space-y-3 text-text-secondary text-sm leading-relaxed">
            <p>
              <strong className="text-text-primary">PMU.fr</strong> — Programme officiel des courses françaises,
              arrivées officielles, rapports des paris (gagnant, placé, tiercé, quarté, quinté).
            </p>
            <p>
              <strong className="text-text-primary">Geny.com</strong> — Détails des partants (musique, poids,
              jockey, entraîneur), cotes probables, commentaires de course.
            </p>
            <p>
              <strong className="text-text-primary">LONACI / LONASE / PMU Maroc</strong> — Sources locales pour
              les courses jouables en Afrique francophone (Côte d&apos;Ivoire, Sénégal, Maroc).
            </p>
            <p>
              <strong className="text-text-primary">Données historiques internes</strong> — Base de données
              propriétaire Elite Turf agrégeant les performances de chevaux, jockeys et entraîneurs sur
              plusieurs années pour produire les statistiques affichées sur les pages de course.
            </p>
          </div>
        </section>

        {/* ── POLITIQUE DE CORRECTION ── */}
        <section>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
            <RefreshCw className="w-7 h-7 text-gold-primary" />
            Politique de corrections
          </h2>
          <p className="text-text-muted text-sm mb-6">
            Notre engagement vis-à-vis des erreurs et de la mise à jour de nos contenus.
          </p>

          <div className="card-base p-6 space-y-4 text-text-secondary text-sm leading-relaxed">
            <p>
              Elite Turf s&apos;engage à corriger toute erreur factuelle dans les meilleurs délais. Les corrections
              significatives (modification d&apos;une sélection, retrait d&apos;un pronostic, mise à jour de
              statistiques) sont :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-text-primary">Tracées</strong> avec un horodatage indiquant la date et l&apos;heure de la mise à jour.</li>
              <li><strong className="text-text-primary">Identifiées</strong> par une mention explicite (<em>« Mise à jour le …, raison : … »</em>) dans le corps de l&apos;article concerné.</li>
              <li><strong className="text-text-primary">Notifiées</strong> aux abonnés Premium par WhatsApp ou email si le pronostic du jour est modifié après publication.</li>
            </ul>
            <p>
              Pour <strong className="text-text-primary">signaler une erreur</strong>, contactez-nous à{" "}
              <a href="mailto:contact@elite-turf.fr" className="text-gold-light hover:underline">
                contact@elite-turf.fr
              </a>{" "}
              — nous nous engageons à étudier toute remarque sous 48h ouvrées.
            </p>
          </div>
        </section>

        {/* ── ÉTHIQUE & TRANSPARENCE ── */}
        <section>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
            <AlertCircle className="w-7 h-7 text-gold-primary" />
            Charte éthique & jeu responsable
          </h2>
          <p className="text-text-muted text-sm mb-6">
            Nos engagements de transparence et de prévention.
          </p>

          <div className="card-base p-6 space-y-4 text-text-secondary text-sm leading-relaxed">
            <p>
              <strong className="text-text-primary">Indépendance éditoriale.</strong> Aucun pronostic Elite Turf
              n&apos;est sponsorisé, payé ou influencé par des propriétaires, entraîneurs, jockeys, opérateurs
              de paris ou hippodromes. Notre analyse est strictement basée sur les données publiques + notre
              méthodologie interne.
            </p>
            <p>
              <strong className="text-text-primary">Transparence des résultats.</strong> Chaque pronostic publié
              est suivi de son résultat (GAGNANT, PARTIEL, PERDANT) après la course. Notre taux de réussite global
              est consultable publiquement sur la page{" "}
              <Link href="/stats" className="text-gold-light hover:underline">Statistiques</Link>.
            </p>
            <p>
              <strong className="text-text-primary">Disclaimer.</strong> Elite Turf est un site d&apos;analyse et
              d&apos;information à but informatif. Les pronostics sont fournis sans garantie de résultat. Nous ne
              sommes pas responsables des pertes financières liées aux paris.
            </p>
            <div className="p-4 bg-orange-500/5 border border-orange-500/30 rounded-xl mt-2">
              <p>
                <strong className="text-orange-400">Jeu responsable.</strong> Jouer comporte des risques :
                endettement, isolement, dépendance. Pour être aidé, appelez le{" "}
                <strong className="text-text-primary">09 74 75 13 13</strong> (appel non surtaxé).
                Les paris sont interdits aux mineurs (moins de 18 ans).
              </p>
            </div>
          </div>
        </section>

        {/* ── CONTACT ── */}
        <section>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
            <Mail className="w-7 h-7 text-gold-primary" />
            Contact rédaction
          </h2>
          <p className="text-text-muted text-sm mb-6">
            Une question, un signalement, une suggestion ?
          </p>

          <div className="card-base p-6 sm:p-8 text-center">
            <p className="text-text-secondary text-base leading-relaxed mb-5">
              Nous lisons et répondons à <strong className="text-text-primary">chaque message</strong> sous 24h ouvrées.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
            >
              Nous contacter
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
