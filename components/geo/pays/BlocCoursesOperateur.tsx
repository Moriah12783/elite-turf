/**
 * Bloc 3 des pages pays migrées — les courses du jour chez l'opérateur
 * (brief §3). Seul le programme de la LONACI est connu (synchro LONACI) :
 * Côte d'Ivoire uniquement. Masqué par la page sans ligne complète.
 */
import { CalendarDays } from "lucide-react";
import type { LigneNationale } from "@/lib/geo/contenu-pays";

export default function BlocCoursesOperateur({ lignes, ville }: { lignes: LigneNationale[]; ville: string }) {
  return (
    <section className="mb-12" aria-labelledby="courses-operateur">
      <h2 id="courses-operateur" className="font-serif text-2xl font-bold text-text-primary mb-2 flex items-center gap-2">
        <CalendarDays className="w-6 h-6 text-gold-primary" aria-hidden="true" />
        Les Nationales du jour à la LONACI
      </h2>
      <p className="text-text-secondary text-sm mb-5">
        D&apos;après le programme de la LONACI, heures de départ à {ville}.
      </p>
      <ul className="card-base divide-y divide-border/60">
        {lignes.map((l) => (
          <li key={l.rang} className="p-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-gold-primary text-xs font-bold uppercase tracking-wider w-28 flex-shrink-0">{l.rang}</span>
            <span className="text-text-primary text-sm flex-1 min-w-0">{l.course}</span>
            <span className="text-text-secondary text-sm tabular-nums">{l.heure}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
