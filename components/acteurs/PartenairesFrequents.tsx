/**
 * Top partenaires d'un acteur :
 *   - Pour un cheval : jockeys les plus fréquents
 *   - Pour un jockey ou entraîneur : chevaux les plus montés/entraînés
 *
 * Affichage en pills compactes, scrollable horizontalement sur mobile.
 * SEO : ce sont des liens internes vers d'autres fiches du même type
 * (mailage interne, distribution PageRank).
 */

import Link from "next/link";
import { Users } from "lucide-react";
import type { EntiteType } from "@/lib/seo/acteurs";
import { slugify } from "@/lib/seo/slugs";

interface Props {
  /** Type de l'entité courante (détermine vers où on link). */
  type:        EntiteType;
  /** [(nom, nb_courses_ensemble), ...] trié desc. */
  partenaires: Array<[string, number]>;
}

export default function PartenairesFrequents({ type, partenaires }: Props) {
  if (partenaires.length === 0) return null;

  // Cible des liens : pour un cheval, on link vers les jockeys.
  // Pour un jockey/entraîneur, on link vers les chevaux.
  const targetType: EntiteType = type === "chevaux" ? "jockeys" : "chevaux";

  const title = type === "chevaux"
    ? "Jockeys récurrents"
    : type === "jockeys"
    ? "Chevaux les plus montés"
    : "Chevaux les plus entraînés";

  return (
    <section className="card-base p-5 sm:p-6">
      <h2 className="font-serif font-bold text-text-primary text-lg mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-gold-primary" />
        {title}
        <span className="text-text-muted text-xs font-normal normal-case ml-1">
          — {partenaires.length}
        </span>
      </h2>

      <div className="flex flex-wrap gap-2">
        {partenaires.map(([nom, count]) => {
          const slug = slugify(nom);
          return (
            <Link
              key={nom}
              href={`/${targetType}/${slug}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-elevated hover:bg-bg-hover border border-border hover:border-gold-primary/40 transition-colors group"
            >
              <span className="text-text-primary group-hover:text-gold-light text-xs font-medium">
                {nom}
              </span>
              <span className="text-text-muted text-xs">·</span>
              <span className="text-gold-primary font-mono font-bold text-xs">
                {count}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
