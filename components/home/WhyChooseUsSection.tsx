import { BarChart2, Users, Eye } from "lucide-react";

const BLOCS = [
  {
    icon: BarChart2,
    titre: "Analyse de Données",
    texte:
      "Nous décortiquons chaque course (chronos, forme, terrain) via nos algorithmes propriétaires.",
  },
  {
    icon: Users,
    titre: "Expertise Terrain",
    texte:
      "Une validation humaine par nos experts pour capturer les nuances de la piste.",
  },
  {
    icon: Eye,
    titre: "Transparence Totale",
    texte:
      "Tous nos résultats sont publiés et vérifiables. Pas de fausses promesses, que des faits.",
  },
];

export default function WhyChooseUsSection() {
  return (
    <section className="py-16 sm:py-20 bg-bg-primary">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Titre */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-px bg-gold-primary/60" />
            <span className="text-gold-light text-xs font-semibold uppercase tracking-widest">
              Notre approche
            </span>
            <div className="w-8 h-px bg-gold-primary/60" />
          </div>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold text-text-primary">
            Pourquoi nous choisir
          </h2>
        </div>

        {/* 3 blocs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {BLOCS.map((bloc, i) => (
            <div
              key={i}
              className="card-base p-7 flex flex-col items-center text-center group hover:border-gold-primary/30 transition-all"
            >
              <div className="w-14 h-14 rounded-2xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center mb-5 group-hover:border-gold-primary/60 transition-all">
                <bloc.icon className="w-7 h-7 text-gold-primary" />
              </div>
              <h3 className="font-serif font-bold text-text-primary text-lg mb-3">
                {bloc.titre}
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                {bloc.texte}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
