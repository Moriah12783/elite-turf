import { ExternalLink, Shield } from "lucide-react";

const OPERATEURS = [
  {
    nom: "PMU",
    url: "https://www.pmu.fr",
    domaine: "pmu.fr",
    description: "Opérateur historique français de paris hippiques et sportifs, agréé ANJ depuis l'origine.",
    couleur: "from-blue-900/40 to-blue-800/20",
    bordure: "border-blue-500/30 hover:border-blue-400/60",
  },
  {
    nom: "Zeturf",
    url: "https://www.zeturf.fr",
    domaine: "zeturf.fr",
    description: "Spécialiste des courses hippiques en ligne, pionnier du pari hippique sur internet en France.",
    couleur: "from-green-900/40 to-green-800/20",
    bordure: "border-green-500/30 hover:border-green-400/60",
  },
  {
    nom: "Unibet",
    url: "https://www.unibet.fr",
    domaine: "unibet.fr",
    description: "Opérateur international de paris sportifs et hippiques disposant d'un agrément ANJ France.",
    couleur: "from-red-900/40 to-red-800/20",
    bordure: "border-red-500/30 hover:border-red-400/60",
  },
  {
    nom: "Betclic",
    url: "https://www.betclic.fr",
    domaine: "betclic.fr",
    description: "Opérateur français de paris sportifs et hippiques, agréé ANJ, leader sur le marché national.",
    couleur: "from-orange-900/40 to-orange-800/20",
    bordure: "border-orange-500/30 hover:border-orange-400/60",
  },
  {
    nom: "Winamax",
    url: "https://www.winamax.fr",
    domaine: "winamax.fr",
    description: "Opérateur français de poker et paris sportifs, agréé ANJ, reconnu pour sa transparence.",
    couleur: "from-yellow-900/40 to-yellow-800/20",
    bordure: "border-yellow-500/30 hover:border-yellow-400/60",
  },
];

export default function OperateursANJ() {
  return (
    <section className="py-16 sm:py-20 bg-bg-primary border-t border-border/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* En-tête */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-gold-primary" />
            <span className="text-gold-light text-sm font-medium uppercase tracking-wider">
              Partenaires officiels
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary">
            Opérateurs de paris agréés ANJ
          </h2>
          <p className="text-text-secondary mt-3 max-w-2xl mx-auto text-sm leading-relaxed">
            Elite Turf collabore avec des opérateurs officiellement agréés par l&apos;
            <strong className="text-text-primary">Autorité Nationale des Jeux (ANJ)</strong> en France.
            Vos paris sont placés exclusivement auprès d&apos;opérateurs légaux, sûrs et régulés.
          </p>
        </div>

        {/* Grille des opérateurs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {OPERATEURS.map((op) => (
            <a
              key={op.nom}
              href={op.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex flex-col p-5 rounded-2xl border bg-gradient-to-br ${op.couleur} ${op.bordure} transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}
            >
              {/* Nom + Badge */}
              <div className="flex items-start justify-between mb-3">
                <span className="font-serif font-bold text-lg text-text-primary group-hover:text-gold-light transition-colors">
                  {op.nom}
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold whitespace-nowrap">
                  ✓ Agréé ANJ
                </span>
              </div>

              {/* Description */}
              <p className="text-text-muted text-xs leading-relaxed flex-1 mb-4">
                {op.description}
              </p>

              {/* Lien */}
              <div className="flex items-center gap-1.5 text-gold-light text-xs font-semibold group-hover:text-gold-primary transition-colors">
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Visiter {op.domaine} →</span>
              </div>
            </a>
          ))}
        </div>

        {/* Mention légale + lien ANJ */}
        <div className="mt-10 p-5 rounded-xl bg-bg-card/50 border border-border/50 text-center">
          <p className="text-text-muted text-xs leading-relaxed max-w-3xl mx-auto">
            Ces opérateurs sont titulaires d&apos;une licence délivrée par l&apos;
            <strong className="text-text-secondary">Autorité Nationale des Jeux (ANJ)</strong>.
            Elite Turf est un service éditorial d&apos;information indépendant et ne collecte aucune mise de jeu.
            Vérifiez la liste officielle des opérateurs agréés sur{" "}
            <a
              href="https://anj.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-light hover:text-gold-primary hover:underline font-semibold transition-colors"
            >
              anj.fr
            </a>
            .
          </p>
        </div>

      </div>
    </section>
  );
}
