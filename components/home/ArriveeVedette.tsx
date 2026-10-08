import Link from "next/link";
import { Trophy, ChevronRight, History } from "lucide-react";
import { ArriveePodium } from "@/components/arrivees/ArriveePodium";
import { resumeCourse, lignesRapports, type PartantNomme } from "@/lib/turf/arrivee-vedette";
import type { RapportsPMU } from "@/lib/sync/geny-rapports-parser";
import type { QuinteDuJourResume } from "@/app/(public)/quinte-plus/donnees";
import { arriveeEnTexte } from "@/lib/courses/rangs";

/**
 * Bandeau « Quinté+ d'hier » sous la carte vedette, tant que le Quinté+ du
 * jour n'est pas couru : l'arrivée de la veille (5 premiers) et un lien vers
 * sa page datée, très recherchée le matin (« arrivée quinté d'hier »).
 */
export function QuinteHier({ resume }: { resume: QuinteDuJourResume & { arrivee: number[] } }) {
  return (
    <Link
      href={`/quinte-plus/${resume.date}`}
      className="group -mt-7 mb-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-bg-card/60 px-4 py-3 text-sm transition-colors hover:border-gold-primary/40"
    >
      <span className="inline-flex items-center gap-1.5 text-text-muted text-xs font-semibold uppercase tracking-wider">
        <History className="w-3.5 h-3.5" />
        Quinté+ d&apos;hier
      </span>
      <span className="text-text-primary font-medium break-words">{resume.libelle}</span>
      <span className="text-gold-light font-bold tracking-wide">{arriveeEnTexte(resume.arrivee, resume.rangs, 5)}</span>
      <span className="ml-auto inline-flex items-center gap-1 text-gold-primary group-hover:text-gold-light text-xs font-medium">
        Voir l&apos;arrivée
        <ChevronRight className="w-3.5 h-3.5" />
      </span>
    </Link>
  );
}

/**
 * Contenu de la carte « Vedette du Jour » une fois le Quinté+ couru : arrivée
 * officielle (podium nommé) + résumé factuel, puis liens vers les arrivées du
 * jour et la page du Quinté+. Cf. lib/turf/arrivee-vedette.ts.
 */
export function ArriveeVedette({
  course,
  date,
  partants,
  rapports = null,
}: {
  course: any;
  date: string;
  partants: PartantNomme[];
  /** `arrivees.rapports_pmu` du Quinté+ (rapports PMU définitifs), s'ils sont connus. */
  rapports?: RapportsPMU | null;
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
    course.arrivee_rangs,
  );
  const rapportsAffiches = lignesRapports(rapports);

  return (
    <>
      <div className="rounded-xl bg-bg-elevated/60 border border-gold-primary/20 p-4 mb-5">
        <p className="text-gold-light text-xs font-semibold uppercase tracking-wider mb-3">Arrivée officielle</p>
        <ArriveePodium arrivee={course.arrivee_officielle} partants={partants} rangs={course.arrivee_rangs} />
      </div>

      {resume && (
        <div className="mb-5">
          <p className="text-text-primary text-sm font-semibold mb-1.5">Résumé de la course</p>
          <p className="text-text-secondary text-sm leading-relaxed">{resume.join(" ")}</p>
        </div>
      )}

      {rapportsAffiches.length > 0 && (
        <div className="mb-5">
          <p className="text-text-primary text-sm font-semibold mb-1.5">Rapports PMU définitifs</p>
          <ul className="space-y-1 text-sm text-text-secondary">
            {rapportsAffiches.map((l) => (
              <li key={l.pari}>
                <span className="text-text-primary font-medium">{l.pari}</span>{" "}
                <span className="text-text-muted text-xs">({l.mise})</span> : {l.detail}
              </li>
            ))}
          </ul>
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
    </>
  );
}
