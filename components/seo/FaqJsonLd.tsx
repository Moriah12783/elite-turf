/**
 * components/seo/FaqJsonLd.tsx
 *
 * Composant injecteur de JSON-LD FAQPage (schema.org).
 * Permet à Google d'afficher tes FAQ directement dans la SERP en accordéon
 * (rich snippet) → boost CTR ×1.5-2x sur les pages avec un bon match d'intent.
 *
 * Référence : https://developers.google.com/search/docs/appearance/structured-data/faqpage
 *
 * Usage :
 *   <FaqJsonLd items={[
 *     { question: "...", answer: "..." },
 *     { question: "...", answer: "..." },
 *   ]} />
 *
 * Bonnes pratiques Google :
 *   - 4-10 FAQ par page (en dessous = peu d'impact, au-dessus = surcharge)
 *   - Questions concises (~80 chars max)
 *   - Réponses 50-300 chars (visibles in-SERP)
 *   - Pas de promo/duplicat avec les concurrents (Google vérifie)
 *   - Les FAQ DOIVENT être visibles dans le HTML aussi (pas que en JSON-LD)
 *     → idéalement le composant qui affiche les FAQ et celui qui injecte le
 *       JSON-LD partagent la même source de vérité (props passées en commun)
 */

interface FaqItem {
  question: string;
  answer:   string;
}

interface Props {
  items: FaqItem[];
}

export default function FaqJsonLd({ items }: Props) {
  if (!items || items.length === 0) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name:    item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text:    item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

/**
 * Composant visuel FAQ accompagnant le JSON-LD. Affiche les FAQ en
 * accordéon HTML natif (pas de JS = SEO-friendly + accessible).
 *
 * Important : Google exige que le CONTENU des FAQ soit visible dans le HTML,
 * pas uniquement dans le JSON-LD. Ce composant remplit cette contrainte.
 */
export function FaqSection({
  items,
  title = "Questions fréquentes",
}: Props & { title?: string }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="my-12">
      <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-6 text-center">
        {title}
      </h2>
      <div className="max-w-3xl mx-auto space-y-3">
        {items.map((item, i) => (
          <details
            key={i}
            className="card-base p-5 group cursor-pointer"
          >
            <summary className="font-serif font-semibold text-text-primary text-base list-none flex items-center justify-between gap-3">
              <span>{item.question}</span>
              <span className="text-gold-primary text-xl transition-transform group-open:rotate-45 flex-shrink-0">
                +
              </span>
            </summary>
            <p className="mt-3 text-text-secondary text-sm leading-relaxed">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
