/**
 * Layout partagé pour les articles auto-générés (top-semaine, bilan-mensuel,
 * decouvrir-hippodrome). Garde la cohérence visuelle avec /blog/[slug] mais
 * sans dépendance au format BLOG_ARTICLES.
 */

import Link from "next/link";
import Image from "next/image";
import { Clock, ArrowLeft, ChevronRight, Sparkles, Tag } from "lucide-react";

interface Props {
  titre:          string;
  sousTitre?:     string;
  category:       string;          // "Bilan hebdomadaire", etc.
  heroImage:      string;
  publishedISO:   string;          // ISO date pour <time>
  publishedHuman: string;          // "6 mai 2026"
  readTimeMin?:   number;
  breadcrumb: Array<{ label: string; href?: string }>;
  jsonLd?:    Record<string, unknown>;
  children:   React.ReactNode;
}

export default function AutoArticleLayout({
  titre, sousTitre, category, heroImage, publishedISO, publishedHuman,
  readTimeMin = 4, breadcrumb, jsonLd, children,
}: Props) {
  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <div className="min-h-screen bg-bg-primary pt-24 pb-16">

        {/* Hero image */}
        <div className="relative h-64 sm:h-80 overflow-hidden mb-0">
          <Image
            src={heroImage}
            alt={titre}
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/30 to-transparent" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative">

          {/* Breadcrumb */}
          <nav aria-label="fil d'ariane" className="flex items-center gap-2 text-xs text-text-muted mb-4">
            {breadcrumb.map((b, idx) => (
              <span key={idx} className="flex items-center gap-2">
                {b.href ? (
                  <Link href={b.href} className="hover:text-gold-primary transition-colors">{b.label}</Link>
                ) : (
                  <span className="text-text-secondary">{b.label}</span>
                )}
                {idx < breadcrumb.length - 1 && <ChevronRight className="w-3 h-3" />}
              </span>
            ))}
          </nav>

          {/* Carte article */}
          <article className="card-base p-6 sm:p-10">

            {/* Méta */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-gold-faint border border-gold-primary/30 text-gold-primary">
                <Sparkles className="w-3 h-3" />
                {category}
              </span>
              <span className="flex items-center gap-1 text-text-muted text-xs">
                <Clock className="w-3.5 h-3.5" /> {readTimeMin} min de lecture
              </span>
              <time dateTime={publishedISO} className="text-text-muted text-xs">
                {publishedHuman}
              </time>
            </div>

            {/* Titre */}
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-3 leading-tight">
              {titre}
            </h1>

            {sousTitre && (
              <p className="text-text-secondary text-base leading-relaxed mb-6 italic">
                {sousTitre}
              </p>
            )}

            <hr className="gold-divider mb-6" />

            {/* Contenu */}
            <div className="prose-elite text-text-secondary text-sm sm:text-base leading-relaxed">
              {children}
            </div>

            {/* Tag SEO */}
            <div className="mt-8 pt-6 border-t border-border/50 flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-text-muted" />
              <span className="text-xs px-2.5 py-1 bg-bg-elevated text-text-muted rounded-full border border-border">
                pmu
              </span>
              <span className="text-xs px-2.5 py-1 bg-bg-elevated text-text-muted rounded-full border border-border">
                {category.toLowerCase()}
              </span>
              <span className="text-xs px-2.5 py-1 bg-bg-elevated text-text-muted rounded-full border border-border">
                statistiques hippiques
              </span>
            </div>

            <div className="mt-6">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour au blog
              </Link>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
