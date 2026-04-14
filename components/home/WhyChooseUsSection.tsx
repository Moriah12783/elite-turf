import { BarChart2, Users, Eye, CreditCard } from "lucide-react";

const BLOCS = [
  {
    icon: BarChart2,
    titre: "Analyse rigoureuse",
    texte:
      "Chaque course est décortiquée en profondeur : chronos, forme récente, terrain, côtes — avant toute publication.",
  },
  {
    icon: Users,
    titre: "Expertise confirmée",
    texte:
      "5 ans d'analyses hippiques PMU. Des spécialistes qui publient leurs résultats — les bons comme les moins bons.",
  },
  {
    icon: Eye,
    titre: "Transparence totale",
    texte:
      "Tous nos résultats sont publiés et vérifiables sur la page Performances. Aucun chiffre retouché, aucune sélection cachée.",
  },
  {
    icon: CreditCard,
    titre: "Accès immédiat",
    texte:
      "Paiement par Orange Money CI, MTN MoMo, Wave ou carte bancaire. Activation de votre abonnement en moins de 2 minutes.",
  },
];

export default function WhyChooseUsSection() {
  return (
    <section className="py-14 sm:py-20 bg-bg-primary border-y border-border/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Titre */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-px bg-gold-primary/60" />
            <span className="text-gold-light text-xs font-semibold uppercase tracking-widest">
              Notre engagement
            </span>
            <div className="w-8 h-px bg-gold-primary/60" />
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary">
            Pourquoi faire confiance à Elite Turf
          </h2>
        </div>

        {/* 4 blocs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {BLOCS.map((bloc, i) => (
            <div
              key={i}
              className="card-base p-5 sm:p-6 flex flex-col items-center text-center group hover:border-gold-primary/30 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center mb-4 flex-shrink-0 group-hover:border-gold-primary/60 transition-all">
                <bloc.icon className="w-6 h-6 text-gold-primary" />
              </div>
              <h3 className="font-serif font-bold text-text-primary text-sm sm:text-base mb-2 leading-snug">
                {bloc.titre}
              </h3>
              <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
                {bloc.texte}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
