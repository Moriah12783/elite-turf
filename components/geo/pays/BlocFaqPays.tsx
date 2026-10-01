/**
 * Bloc 6 des pages pays migrées — la FAQ du registre, relue et validée par
 * Steph. Le JSON-LD FAQPage est construit par la page à partir des MÊMES
 * questions (exigence Google : FAQ visible = FAQ structurée).
 */
import { ChevronRight } from "lucide-react";

export default function BlocFaqPays({ titre, faq }: { titre: string; faq: { q: string; a: string }[] }) {
  if (faq.length === 0) return null;
  return (
    <section className="mb-12" aria-labelledby="faq-pays">
      <h2 id="faq-pays" className="font-serif text-2xl font-bold text-text-primary mb-6">{titre}</h2>
      <div className="space-y-3">
        {faq.map((f) => (
          <details key={f.q} className="card-base p-5 group cursor-pointer">
            <summary className="font-semibold text-text-primary text-base list-none flex items-start justify-between gap-3">
              {f.q}
              <ChevronRight className="w-4 h-4 text-gold-primary flex-shrink-0 mt-1 transition-transform group-open:rotate-90" aria-hidden="true" />
            </summary>
            <p className="text-text-secondary text-sm leading-relaxed mt-3 pt-3 border-t border-border/50">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
