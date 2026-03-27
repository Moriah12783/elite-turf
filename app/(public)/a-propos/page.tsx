import { Metadata } from "next";
import Link from "next/link";
import { Brain, Eye, Users, ArrowRight, Trophy } from "lucide-react";

export const metadata: Metadata = {
  title: "À Propos — Elite Turf",
  description:
    "Découvrez l'histoire et la mission d'Elite Turf. Fondée par des passionnés de courses hippiques et d'innovation technologique, basée à Paris.",
};

const VALEURS = [
  {
    icon: Brain,
    titre: "IA + Expertise Humaine",
    texte: "Algorithmes propriétaires validés par nos experts terrain",
  },
  {
    icon: Eye,
    titre: "Transparence",
    texte: "Tous nos résultats publiés, vérifiables, sans fausses promesses",
  },
  {
    icon: Users,
    titre: "Communauté",
    texte: "Des centaines de parieurs accompagnés en Afrique et en Europe",
  },
];

export default function AProposPage() {
  return (
    <div className="min-h-screen bg-bg-primary">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1526094633853-031707a44819?w=1400&q=80"
            alt="Elite Turf — À Propos"
            className="w-full h-full object-cover opacity-8"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/70 via-bg-primary/85 to-bg-primary" />
        </div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/60 to-transparent" />

        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-sm border border-gold-primary/40 rounded-full mb-6">
            <Trophy className="w-4 h-4 text-gold-primary" />
            <span className="text-gold-light text-xs font-semibold tracking-wide">
              Experts PMU depuis Paris
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-bold text-text-primary mb-6 leading-tight">
            L&apos;Expertise derrière{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #C9A84C, #E8D5A3, #A07830)" }}
            >
              EliteTurf
            </span>
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-16">

        {/* ── HISTOIRE ── */}
        <div className="card-base p-8 sm:p-10">
          <div className="max-w-2xl">
            <p className="text-text-secondary text-lg leading-relaxed mb-6">
              Fondée par <span className="text-gold-light font-semibold">Stéphane Y.</span>,
              passionné d&apos;innovation technologique et de courses hippiques,
              EliteTurf est née d&apos;un constat simple : le parieur a besoin
              d&apos;outils professionnels pour gagner sur la durée.
            </p>
            <p className="text-text-secondary text-base leading-relaxed">
              Nous combinons <span className="text-gold-light font-medium">l&apos;intelligence artificielle</span> pour
              le traitement des données et l&apos;instinct humain pour la décision finale.
              Notre agence basée à Paris accompagne désormais des centaines de parieurs
              à travers l&apos;Afrique francophone et l&apos;Europe dans leur quête de rentabilité.
            </p>
          </div>
        </div>

        {/* ── VALEURS ── */}
        <div>
          <h2 className="font-serif text-2xl font-bold text-text-primary text-center mb-8">
            Nos valeurs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {VALEURS.map((v, i) => (
              <div key={i} className="card-base p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center mx-auto mb-4">
                  <v.icon className="w-6 h-6 text-gold-primary" />
                </div>
                <h3 className="font-serif font-bold text-text-primary mb-2">{v.titre}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{v.texte}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="text-center py-8 border-t border-border">
          <p className="text-text-secondary mb-6">
            Prêt à rejoindre des centaines de parieurs qui nous font confiance ?
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
