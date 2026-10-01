import Link from "next/link";
import { Trophy, ChevronRight } from "lucide-react";
import { ArriveePodium } from "@/components/arrivees/ArriveePodium";
import { resumeCourse, type PartantNomme } from "@/lib/turf/arrivee-vedette";

/**
 * Contenu de la carte « Vedette du Jour » une fois le Quinté+ couru : arrivée
 * officielle (podium nommé) + résumé factuel, puis liens vers les arrivées du
 * jour et la page du Quinté+. Cf. lib/turf/arrivee-vedette.ts.
 */
export function ArriveeVedette({
  course,
  date,
  partants,
}: {
  course: any;
  date: string;
  partants: PartantNomme[];
}) {
  const hippodrome = Array.isArray(course.hippodrome) ? course.hippodrome[0] : course.hippodrome;
  const resume = resumeCourse(
    {
      hippodrome: hippodrome?.nom ?? null,
      categorie: course.categorie ?? null,
      distance_metres: course.distance_metres ?? null,
      nb_partants: course.nb_partants ?? null,
    },
    course.arrivee_officielle,
    partants,
  );

  return (
    <>
      <div className="rounded-xl bg-bg-elevated/60 border border-gold-primary/20 p-4 mb-5">
        <p className="text-gold-light text-xs font-semibold uppercase tracking-wider mb-3">Arrivée officielle</p>
        <ArriveePodium arrivee={course.arrivee_officielle} partants={partants} />
      </div>

      {resume && (
        <div className="mb-5">
          <p className="text-text-primary text-sm font-semibold mb-1.5">Résumé de la course</p>
          <p className="text-text-secondary text-sm leading-relaxed">{resume.join(" ")}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/arrivees/${date}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
        >
          <Trophy className="w-4 h-4" />
          Toutes les arrivées du jour
          <ChevronRight className="w-4 h-4" />
        </Link>
        <Link
          href={`/quinte-plus/${date}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-gold-primary/40 hover:border-gold-primary text-gold-light font-semibold text-sm rounded-xl transition-colors"
        >
          Le Quinté+ en détail
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <p className="mt-4 text-text-muted text-xs">
        Nos pronostics sont publiés chaque matin entre 8h30 et 9h30 (heure GMT).
      </p>
    </>
  );
}
