import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ArrowLeft, Star, ArrowRight, Tag, Zap } from "lucide-react";
import { BLOG_ARTICLES, getArticle } from "@/lib/blog-data";
import NewsletterSignup from "@/components/blog/NewsletterSignup";
import StickyBanner from "@/components/blog/StickyBanner";
import ExitIntentPopup from "@/components/blog/ExitIntentPopup";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

export async function generateStaticParams() {
  return BLOG_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Article introuvable" };

  return {
    title: article.titre,
    description: article.description,
    keywords: article.keywords,
    alternates: { canonical: `${APP_URL}/blog/${article.slug}` },
    openGraph: {
      title: article.titre,
      description: article.description,
      url: `${APP_URL}/blog/${article.slug}`,
      type: "article",
      publishedTime: article.date,
      authors: ["Elite Turf — Paris"],
      images: [{ url: article.image.startsWith("http") ? article.image : `${APP_URL}${article.image}`, width: 1200, height: 630, alt: article.titre }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.titre,
      description: article.description,
      images: [article.image.startsWith("http") ? article.image : `${APP_URL}${article.image}`],
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  // Articles liés : même catégorie en priorité, sinon les autres
  const articlesMemeCategorie = BLOG_ARTICLES.filter(
    (a) => a.slug !== slug && a.categorie === article.categorie
  ).slice(0, 3);

  const autresArticles = articlesMemeCategorie.length >= 2
    ? articlesMemeCategorie
    : BLOG_ARTICLES.filter((a) => a.slug !== slug).slice(0, 3);

  // 3 derniers pour "Dernière minute"
  const derniersArticles = [...BLOG_ARTICLES]
    .filter((a) => a.slug !== slug)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  // ── JSON-LD : schéma Article pour Google ─────────────────────────────
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.titre,
    description: article.description,
    image: article.image.startsWith("http") ? article.image : `${APP_URL}${article.image}`,
    datePublished: article.date,
    dateModified: article.date,
    author: {
      "@type": "Organization",
      name: "Elite Turf",
      url: APP_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Elite Turf",
      logo: {
        "@type": "ImageObject",
        url: `${APP_URL}/og-image.jpg`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${APP_URL}/blog/${article.slug}`,
    },
    keywords: article.keywords.join(", "),
    articleSection: article.categorie,
    inLanguage: "fr-FR",
  };

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    {/* Bannière sticky + popup exit-intent — client components */}
    <StickyBanner />
    <ExitIntentPopup />
    <div className="min-h-screen bg-bg-primary pt-24 pb-16">

      {/* Hero image */}
      <div className="relative h-64 sm:h-80 overflow-hidden mb-0">
        <img
          src={article.image}
          alt={article.titre}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/30 to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── ARTICLE PRINCIPAL ──────────────────────────────── */}
          <article className="lg:col-span-2">
            {/* Breadcrumb + Schema BreadcrumbList */}
            <nav aria-label="fil d'ariane" className="flex items-center gap-2 text-xs text-text-muted mb-4">
              <Link href="/" className="hover:text-gold-primary transition-colors">Accueil</Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-gold-primary transition-colors">Blog PMU</Link>
              <span>/</span>
              <span className="text-text-secondary truncate">{article.categorie}</span>
            </nav>

            {/* Carte article */}
            <div className="card-base p-6 sm:p-8">
              {/* Meta */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Link
                  href={`/blog?filtre=expertise`}
                  className="text-xs font-bold px-3 py-1 rounded-full bg-gold-faint border border-gold-primary/30 text-gold-primary hover:bg-gold-primary hover:text-bg-primary transition-colors"
                >
                  {article.categorie}
                </Link>
                <span className="flex items-center gap-1 text-text-muted text-xs">
                  <Clock className="w-3.5 h-3.5" /> {article.readTime} min de lecture
                </span>
                <time dateTime={article.date} className="text-text-muted text-xs">
                  {new Date(article.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </time>
              </div>

              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-3 leading-tight">
                {article.titre}
              </h1>
              <p className="text-text-secondary text-base leading-relaxed mb-6 italic">
                {article.description}
              </p>

              <hr className="gold-divider mb-6" />

              {/* Contenu HTML */}
              <div
                className="prose-elite"
                dangerouslySetInnerHTML={{ __html: article.contenu }}
              />

              {/* Keywords SEO */}
              <div className="mt-8 pt-6 border-t border-border/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-4 h-4 text-text-muted" />
                  {article.keywords.map((k) => (
                    <span key={k} className="text-xs px-2.5 py-1 bg-bg-elevated text-text-muted rounded-full border border-border">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── NEWSLETTER SIGNUP ─────────────────────────────── */}
            <div className="mt-6">
              <NewsletterSignup context={article.slug} />
            </div>

            {/* Articles liés (intermaillage interne) */}
            {autresArticles.length > 0 && (
              <div className="mt-6 card-base p-5">
                <h2 className="font-serif font-bold text-text-primary text-base mb-4 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-gold-primary" />
                  Articles liés — {article.categorie}
                </h2>
                <div className="space-y-3">
                  {autresArticles.map((a) => (
                    <Link
                      key={a.slug}
                      href={`/blog/${a.slug}`}
                      className="flex items-start gap-3 hover:opacity-80 transition-opacity group"
                    >
                      <img
                        src={a.image}
                        alt={a.titre}
                        className="w-16 h-12 object-cover rounded-lg flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-text-primary text-xs font-semibold leading-snug line-clamp-2 group-hover:text-gold-light transition-colors">
                          {a.titre}
                        </p>
                        <p className="text-text-muted text-xs mt-0.5">{a.readTime} min · {a.categorie}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Nav retour */}
            <div className="flex justify-between items-center mt-6">
              <Link href="/blog" className="flex items-center gap-2 text-text-muted hover:text-gold-primary text-sm transition-colors">
                <ArrowLeft className="w-4 h-4" /> Tous les articles
              </Link>
              <Link href="/abonnements" className="flex items-center gap-2 text-gold-primary text-sm font-semibold hover:text-gold-light transition-colors">
                S&apos;abonner <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </article>

          {/* ── SIDEBAR ──────────────────────────────────────── */}
          <aside className="space-y-6">

            {/* CTA sticky */}
            <div className="card-base border-gold-primary/30 p-5 text-center sticky top-28">
              <div className="w-12 h-12 rounded-2xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center mx-auto mb-3">
                <Star className="w-6 h-6 text-gold-primary" />
              </div>
              <h3 className="font-serif font-bold text-text-primary mb-2">
                Pronostics du Quinté+
              </h3>
              <p className="text-text-secondary text-sm mb-4">
                Chaque matin avant 8h (heure de Paris), nos experts publient leur sélection pour Vincennes et Longchamp.
              </p>
              <div className="space-y-2 mb-4">
                {["Quinté+ du jour dès 8h00", "Tiercé & Quarté+ inclus", "Analyse vidéo (Plan Elite)"].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs text-text-secondary">
                    <div className="w-1.5 h-1.5 rounded-full bg-status-win flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/abonnements" className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
                Dès 65€
              </Link>
            </div>

            {/* Dernière minute */}
            <div className="card-base p-5">
              <h3 className="font-serif font-bold text-text-primary text-base mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-gold-primary" />
                Dernière minute
              </h3>
              <div className="space-y-3">
                {derniersArticles.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/blog/${a.slug}`}
                    className="flex items-start gap-3 hover:opacity-80 transition-opacity group"
                  >
                    <img
                      src={a.image}
                      alt={a.titre}
                      className="w-14 h-10 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-text-primary text-xs font-semibold leading-snug line-clamp-2 group-hover:text-gold-light transition-colors">
                        {a.titre}
                      </p>
                      <time dateTime={a.date} className="text-text-muted text-[10px] mt-0.5 block">
                        {new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </time>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </aside>
        </div>
      </div>
    </div>
    </>
  );
}
