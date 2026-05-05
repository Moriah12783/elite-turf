/**
 * Page index partagée pour /chevaux, /jockeys, /entraineurs.
 *
 * Affiche les top entités triées par activité récente (dernière course),
 * avec stats agrégées. Composant serveur.
 */

import Link from "next/link";
import { ChevronRight, Trophy, Calendar } from "lucide-react";
import PageHero from "@/components/layout/PageHero";
import {
  type Entite, type EntiteType,
  ENTITE_LABEL, tauxVictoire,
} from "@/lib/seo/acteurs";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface Props {
  type:    EntiteType;
  entites: Entite[];
  heroImg: string;
}

export default function ActeurIndexPage({ type, entites, heroImg }: Props) {
  const label = ENTITE_LABEL[type];

  const itemListLd = {
    "@context": "https://schema.org",
    "@type":    "ItemList",
    name:        `${label.plural} — Elite Turf`,
    numberOfItems: entites.length,
    itemListElement: entites.slice(0, 100).map((e, idx) => ({
      "@type":  "ListItem",
      position: idx + 1,
      item: {
        "@type": type === "chevaux" ? "Animal" : "Person",
        name:    e.nom,
        url:     `${APP_URL}/${type}/${e.slug}`,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />

      <PageHero
        image={heroImg}
        titre={label.plural}
        sousTitre={`${entites.length} ${label.plural.toLowerCase()} actifs récemment`}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <nav className="mb-6 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary">{label.plural}</span>
        </nav>

        {entites.length === 0 ? (
          <div className="card-base p-10 text-center">
            <p className="text-text-secondary text-sm font-medium mb-2">
              Aucun {label.singular.toLowerCase()} référencé pour le moment
            </p>
            <p className="text-text-muted text-xs">
              Les {label.plural.toLowerCase()} sont indexés automatiquement à partir des courses PMU.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {entites.map((e) => {
              const tauxVic = tauxVictoire(e);
              return (
                <Link
                  key={e.id}
                  href={`/${type}/${e.slug}`}
                  className="card-base p-4 hover:border-gold-primary/40 transition-all group"
                >
                  <h3 className="font-serif font-semibold text-text-primary text-sm mb-2 truncate group-hover:text-gold-light transition-colors">
                    {e.nom}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {e.nb_courses ?? 0} courses
                    </span>
                    {(e.nb_victoires ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-status-win">
                        <Trophy className="w-3 h-3" />
                        {e.nb_victoires}
                        {tauxVic !== null && tauxVic > 0 && (
                          <span className="text-text-muted">· {tauxVic.toFixed(0)} %</span>
                        )}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
