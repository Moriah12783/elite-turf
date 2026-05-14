import { Metadata } from "next";
import Link from "next/link";
import { Brain, Eye, Users, ArrowRight, Sparkles } from "lucide-react";
import PageHero from "@/components/layout/PageHero";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const metadata: Metadata = {
  title: "À Propos — Elite Turf",
  description:
    "Fondé par Stéphane Y., Elite Turf offre aux parieurs francophones une approche rigoureuse et stratégique des courses hippiques, alliant IA et expertise humaine.",
  alternates: { canonical: `${APP_URL}/a-propos` },
};

const VALEURS = [
  {
    icon: Brain,
    titre: "Excellence analytique",
    texte:
      "Chaque publication repose sur une lecture rigoureuse des courses, une sélection méthodique des informations utiles et une exigence constante de cohérence. Chez Elite Turf, l'intuition n'a de valeur que lorsqu'elle est soutenue par le travail, l'observation et la méthode.",
  },
  {
    icon: Sparkles,
    titre: "IA & expertise humaine",
    texte:
      "Nous mobilisons la technologie comme un levier d'avance, non comme un artifice. L'intelligence artificielle nous permet d'exploiter les données avec puissance et rapidité ; l'expertise humaine, elle, conserve le dernier mot : celui de l'interprétation, de la nuance et du jugement.",
  },
  {
    icon: Eye,
    titre: "Transparence",
    texte:
      "Le prestige n'a de sens que lorsqu'il repose sur la vérité. Nous privilégions une communication claire, digne et responsable, sans promesses irréalistes ni artifices marketing. Notre vision s'inscrit dans la durée, avec sérieux et lucidité.",
  },
  {
    icon: Users,
    titre: "Communauté sélective",
    texte:
      "Elite Turf s'adresse à une communauté de parieurs qui partagent une même exigence : avancer avec méthode, sang-froid et ambition. Plus qu'un service, nous construisons un univers de confiance, où la passion du turf rencontre la culture de l'excellence.",
  },
];

export default function AProposPage() {
  return (
    <div className="min-h-screen bg-bg-primary">

      <PageHero
        image="/images/heroes/hero-a-propos.jpg"
        titre="À Propos d'Elite Turf"
        sousTitre="L'excellence hippique pensée pour les parieurs francophones exigeants"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-16">

        {/* ── INTRODUCTION ── */}
        <div className="card-base p-8 sm:p-10 space-y-6">
          <p className="text-text-secondary text-lg leading-relaxed">
            Dans l&apos;univers des paris hippiques, la véritable différence ne se joue pas dans le bruit,
            mais dans la maîtrise.
          </p>
          <p className="text-text-secondary text-base leading-relaxed">
            Elite Turf est né de cette vision : offrir aux parieurs francophones une lecture plus raffinée,
            plus rigoureuse et plus stratégique des courses, loin des illusions faciles et des promesses
            tapageuses.
          </p>
          <p className="text-text-secondary text-base leading-relaxed">
            Fondé par <span className="text-gold-light font-semibold">Stéphane Y.</span>, passionné de courses
            hippiques, d&apos;innovation technologique et d&apos;analyse décisionnelle, Elite Turf s&apos;est
            construit autour d&apos;une ambition claire : élever l&apos;approche du pari vers un standard plus
            professionnel, plus intelligent et plus sélectif.
          </p>
          <p className="text-text-secondary text-base leading-relaxed">
            Nous considérons le turf comme un univers d&apos;expertise, où chaque détail compte, où chaque
            décision mérite méthode, recul et discernement. C&apos;est pourquoi nous avons conçu un service
            fondé sur une alliance rare : la{" "}
            <span className="text-gold-light font-medium">précision de l&apos;intelligence artificielle</span>{" "}
            dans l&apos;exploitation des données, et la{" "}
            <span className="text-gold-light font-medium">finesse de l&apos;expertise humaine</span>{" "}
            dans l&apos;interprétation finale.
          </p>
          <p className="text-text-secondary text-base leading-relaxed">
            Cette combinaison donne naissance à une approche sobre, structurée et résolument haut de gamme,
            pensée pour celles et ceux qui recherchent davantage qu&apos;un simple pronostic :
            une vision, une méthode, une signature.
          </p>
        </div>

        {/* ── PRÉSENCE ── */}
        <div className="card-base p-8 sm:p-10 border-l-4 border-gold-primary/60">
          <p className="text-text-secondary text-base leading-relaxed mb-4">
            Aujourd&apos;hui, Elite Turf accompagne des parieurs à travers la francophonie, en Afrique comme
            en Europe, avec la volonté constante de proposer un cadre sérieux, une lecture claire et une
            exigence de qualité à chaque publication.
          </p>
          <p className="text-gold-light font-medium text-base leading-relaxed">
            Notre engagement est simple : faire d&apos;Elite Turf une référence pour les passionnés qui
            privilégient la discipline à l&apos;agitation, la cohérence à l&apos;improvisation, et la
            qualité à la quantité.
          </p>
        </div>

        {/* ── VALEURS ── */}
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary text-center mb-10">
            Nos valeurs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {VALEURS.map((v, i) => (
              <div key={i} className="card-base p-6 sm:p-8">
                <div className="w-12 h-12 rounded-2xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center mb-5">
                  <v.icon className="w-6 h-6 text-gold-primary" />
                </div>
                <h3 className="font-serif font-bold text-text-primary text-lg mb-3">{v.titre}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{v.texte}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── ENTITÉ LÉGALE ── */}
        <div className="card-base p-6 border border-border/50">
          <h2 className="font-serif font-semibold text-text-primary text-base mb-3">Entité légale</h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            Elite Turf est une marque commerciale exploitée par{" "}
            <strong className="text-text-primary">TSALACH VENTURES LLC</strong>, société de droit
            américain (Wyoming LLC), 30 N Gould St, STE R, Sheridan, WY 82801, États-Unis.
          </p>
          <p className="text-text-muted text-xs mt-2 leading-relaxed">
            Directeur de la publication : Landry Stéphane Y. — Contact :{" "}
            <a href="mailto:contact@elite-turf.fr" className="text-gold-light hover:underline">
              contact@elite-turf.fr
            </a>
          </p>
        </div>

        {/* ── CTA ── */}
        <div className="text-center py-8 border-t border-border">
          <p className="text-text-secondary mb-6 text-lg">
            Prêt à rejoindre une communauté de parieurs exigeants ?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/abonnements"
              className="flex items-center gap-2 px-7 py-3.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
            >
              Voir les abonnements
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="flex items-center gap-2 px-7 py-3.5 bg-bg-elevated hover:bg-bg-hover border border-border hover:border-gold-primary/30 text-text-secondary hover:text-text-primary font-semibold text-sm rounded-xl transition-all"
            >
              Nous contacter
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
