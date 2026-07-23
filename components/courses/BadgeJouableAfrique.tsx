/**
 * Badge « 🌍 Jouable Afrique » — réutilisable (programme, fiche course, Quinté+).
 *
 * SENS : la course fait partie de l'offre internationale PMU, jouable dans les
 * pays africains partenaires (accord PMU France / 35 pays, dont la Côte d'Ivoire).
 *
 * ⚠️ LEXIQUE PUBLIC (non négociable) : on n'affiche JAMAIS le nom d'un opérateur
 * (LONACI, LONASE…) — Elite Turf se revendique international, pas lié à un
 * opérateur unique. Le détail du pari national va dans l'infobulle, pas dans le
 * libellé.
 *
 * SOURCE : `courses.jouable_afrique` (verdict autoritaire du sync quotidien),
 * avec repli heuristique sur `paris_disponibles` tant que la colonne est NULL
 * — cf. `resolveAfrique()` dans lib/pmu-api.ts.
 */
import { resolveAfrique } from "@/lib/pmu-api";

export interface BadgeJouableAfriqueProps {
  course: {
    jouable_afrique?:   boolean | null;
    nationale?:         number | null;
    paris_disponibles?: string[] | null;
  };
  /** Classes additionnelles (marges, taille) selon le contexte d'affichage. */
  className?: string;
}

export default function BadgeJouableAfrique({ course, className = "" }: BadgeJouableAfriqueProps) {
  const { jouable, nationaleLabel } = resolveAfrique({
    jouable_afrique:   course.jouable_afrique,
    nationale:         course.nationale,
    paris_disponibles: course.paris_disponibles ?? [],
  });

  if (!jouable) return null;

  const title = nationaleLabel
    ? `Offre internationale PMU — jouable depuis l'Afrique · ${nationaleLabel}`
    : "Offre internationale PMU — jouable depuis l'Afrique";

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-semibold bg-emerald-500/10 text-emerald-400 border-emerald-500/30 ${className}`}
    >
      🌍 Jouable Afrique
    </span>
  );
}
