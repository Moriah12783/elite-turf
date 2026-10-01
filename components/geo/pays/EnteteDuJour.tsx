/**
 * Bloc 1 des pages pays migrées — le Quinté+ du jour à l'heure locale
 * (brief « pages pays », §3). Masqué par la page si une donnée manque.
 */
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import type { EnteteDuJour as Entete } from "@/lib/geo/contenu-pays";

export default function EnteteDuJour({ entete }: { entete: Entete }) {
  return (
    <section className="mb-10 card-base p-5 sm:p-6 border-gold-primary/40" aria-labelledby="entete-du-jour">
      <h2 id="entete-du-jour" className="text-gold-light text-xs font-semibold uppercase tracking-widest mb-2 flex items-center gap-2">
        <Clock className="w-4 h-4" aria-hidden="true" /> Quinté+ du jour, heure de {entete.ville}
      </h2>
      <p className="font-serif text-xl sm:text-2xl font-bold text-text-primary leading-snug">
        {entete.phrase}
      </p>
      <Link
        href="/quinte-plus"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-primary hover:text-gold-light"
      >
        Voir la course et notre pronostic <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
