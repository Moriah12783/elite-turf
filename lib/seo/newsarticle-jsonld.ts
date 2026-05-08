/**
 * lib/seo/newsarticle-jsonld.ts
 *
 * Génère un objet JSON-LD Schema.org NewsArticle prêt à insérer dans
 * <script type="application/ld+json"> sur les pages éditoriales.
 *
 * Utilisé sur :
 *  - /arrivees/[date]      → arrivées + rapports du jour
 *  - /quinte-plus/[date]   → focus Quinté+ du jour
 *  - /blog/top-semaine/…   → bilans hebdo
 *  - /blog/bilan-mensuel/… → bilans mensuels
 *
 * Référence Schema.org : https://schema.org/NewsArticle
 * Critères Google News : https://developers.google.com/search/docs/appearance/structured-data/article
 */

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface NewsArticleArgs {
  /** URL canonique de la page (sans trailing slash). */
  url:           string;
  /** Titre H1 de la page (50-110 chars idéal pour Google News). */
  headline:      string;
  /** Description courte (1-2 phrases). */
  description?:  string;
  /** Date ISO de publication (la première fois où le contenu est apparu). */
  datePublished: string;
  /** Date ISO de dernière modification (= datePublished si pas modifié). */
  dateModified?: string;
  /**
   * Image principale qui représente l'article. Ratio 16:9 ou 4:3 idéal.
   * Hauteur minimum 1200px côté Google News pour passer "AMP-quality".
   * Fallback : logo Elite Turf.
   */
  image?:        string;
  /** Mots-clés (5-10 max). */
  keywords?:     string[];
  /** Section éditoriale. */
  articleSection?: string;
}

/**
 * Construit le JSON-LD NewsArticle d'Elite Turf.
 * Author + Publisher sont fixés en dur (Elite Turf est sa propre rédaction).
 */
export function buildNewsArticleJsonLd(args: NewsArticleArgs): Record<string, unknown> {
  const dateModified = args.dateModified ?? args.datePublished;
  const image = args.image ?? `${APP_URL}/images/og-default.jpg`;

  return {
    "@context": "https://schema.org",
    "@type":    "NewsArticle",
    "@id":      `${args.url}#newsarticle`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id":   args.url,
    },
    headline:    args.headline.slice(0, 110), // Google News tronque au-delà
    description: args.description,
    image: [image],
    datePublished: args.datePublished,
    dateModified,
    author: {
      "@type": "Organization",
      name:    "Elite Turf",
      url:     APP_URL,
    },
    publisher: {
      "@type": "Organization",
      name:    "Elite Turf",
      url:     APP_URL,
      logo: {
        "@type":  "ImageObject",
        url:      `${APP_URL}/images/logo.png`,
        width:    512,
        height:   512,
      },
    },
    keywords:       args.keywords?.join(", "),
    articleSection: args.articleSection ?? "Sports — Hippisme",
    inLanguage:     "fr-FR",
    isAccessibleForFree: true,
  };
}
