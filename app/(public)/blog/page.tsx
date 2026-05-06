import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Clock, Tag, ArrowRight, Star, BookOpen, Zap, TrendingUp, Trophy, ChevronRight } from "lucide-react";
import { BLOG_ARTICLES } from "@/lib/blog-data";
import { createServiceClient } from "@/lib/supabase/server";
import PageHero from "@/components/layout/PageHero";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const metadata: Metadata = {
  title: "Blog PMU — Analyses, Guides & Stratégies pour les parieurs francophones | Elite Turf",
  description:
    "Guides et analyses PMU rédigés par des experts hippiques : Quinté+, Tiercé, déferrage, lecture de la musique, gestion de bankroll. Pour les parieurs de Côte d'Ivoire, Sénégal, Maroc et France.",
  keywords: [
    "blog pronostic PMU",
    "guide paris hippiques",
    "Quinté+ analyse expert",
    "pronostic PMU Côte d'Ivoire",
    "stratégie pari PMU",
    "analyse hippique Afrique",
  ],
  alternates: { canonical: `${APP_URL}/blog` },
  openGraph: {
    title: "Blog PMU — Analyses & Guides hippiques | Elite Turf",
    description: "Guides et analyses PMU par nos experts. Quinté+, Tiercé, stratégies de bankroll. Pour les parieurs francophones d'Afrique et de France.",
    url: `${APP_URL}/blog`,
    siteName: "Elite Turf",
    locale: "fr_FR",
    type: "website",
  },
};

// Couleurs par catégorie
const CATEGORIE_COLORS: Record<string, string> = {
  "Stratégie":    "text-gold-primary bg-gold-faint border-gold-primary/30",
  "Expertise":    "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "Finance":      "text-status-win bg-status-win/10 border-status-win/20",
  "Technique":    "text-purple-400 bg-purple-500/10 border-purple-500/30",
  "Grands Prix":  "text-gold-light bg-gold-primary/10 border-gold-primary/20",
  "Débutants":    "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  "Innovation":   "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  "Communauté":   "text-pink-400 bg-pink-400/10 border-pink-400/20",
  "Acteurs":      "text-orange-400 bg-orange-400/10 border-orange-400/20",
  "Marché":       "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
  "Actualités":   "text-red-400 bg-red-400/10 border-red-400/20",
};

// Groupes de filtres
const FILTRES = [
  { label: "Tous les articles", value: "all" },
  { label: "Expertise & Stratégie", value: "expertise", cats: ["Stratégie", "Expertise", "Technique", "Finance"] },
  { label: "Actualités & Marché", value: "actu", cats: ["Actualités", "Grands Prix", "Communauté", "Acteurs", "Marché", "Innovation"] },
  { label: "Débutants", value: "debutants", cats: ["Débutants"] },
];

// Maillage interne
const MAILLAGE_LINKS = [
  { href: "/pronostics",   label: "Pronostics du jour",         desc: "Nos sélections analysées chaque matin" },
  { href: "/performances", label: "Résultats & Performances",   desc: "Historique complet de nos pronostics" },
  { href: "/abonnements",  label: "Nos formules d'abonnement",  desc: "Pack Starter, Pro et Elite" },
  { href: "/archives",     label: "Archives des courses",       desc: "Résultats PMU vérifiables" },
  { href: "/a-propos",     label: "Notre équipe",               desc: "Qui sommes-nous ?" },
  { href: "/contact",      label: "Nous contacter",             desc: "Support WhatsApp & email" },
];

interface PageProps {
  searchParams: { filtre?: string };
}

export default async function BlogPage({ searchParams }: PageProps) {
  const filtre = searchParams.filtre || "all";
  const filtreConfig = FILTRES.find((f) => f.value === filtre) ?? FILTRES[0];

  // Article vedette : le plus récent (toujours affiché)
  const articlesSorted = [...BLOG_ARTICLES].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const vedette = articlesSorted[0];

  // Articles filtrés (hors vedette si filtre = all)
  const articlesFiltered = filtre === "all"
    ? BLOG_ARTICLES.filter((a) => a.slug !== vedette.slug)
    : BLOG_ARTICLES.filter((a) => filtreConfig.cats?.includes(a.categorie));

  // 3 derniers pour sidebar
  const derniersArticles = articlesSorted.slice(1, 4);

  // Derniers pronostics gratuits pour la sidebar
  let pronosticsGratuits: { id: string; analyse_courte: string; type_pari: string; course: { libelle?: string } | null }[] = [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("pronostics")
      .select("id, analyse_courte, type_pari, course:course_id(libelle)")
      .eq("publie", true)
      .eq("niveau_acces", "GRATUIT")
      .order("date_publication", { ascending: false })
      .limit(3);
    pronosticsGratuits = (data as typeof pronosticsGratuits) || [];
  } catch { /* pas de données encore */ }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Blog PMU", item: `${APP_URL}/blog` },
    ],
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <PageHero
        image="/images/heroes/hero-blog.jpg"
        titre="Blog PMU & Analyses hippiques"
        sousTitre="Guides, stratégies et décryptages pour les parieurs francophones"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">

        {/* ── EN-TÊTE ÉDITORIAL ──────────────────────────────────── */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold-faint border border-gold-primary/30 rounded-full mb-4">
            <BookOpen className="w-4 h-4 text-gold-primary" />
            <span className="text-gold-light text-xs font-semibold uppercase tracking-wider">
              {BLOG_ARTICLES.length} articles d&apos;expertise
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary mb-3">
            Guides & Analyses PMU par nos experts
          </h1>
          <p className="text-text-secondary text-base max-w-2xl leading-relaxed">
            Chaque semaine, nos spécialistes hippiques publient des analyses de courses, des guides stratégiques
            et des décryptages des signaux du marché — pour que vous pariiez avec méthode sur le PMU.
          </p>
        </div>

        {/* ── ARTICLE VEDETTE ────────────────────────────────────── */}
        {filtre === "all" && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-gold-primary" />
              <span className="text-gold-light text-xs font-bold uppercase tracking-wider">À la une</span>
            </div>
            <Link
              href={`/blog/${vedette.slug}`}
              className="card-base overflow-hidden flex flex-col sm:flex-row hover:border-gold-primary/50 transition-all group relative"
            >
              {/* Badge vedette */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1 bg-gold-primary/90 rounded-full">
                <Trophy className="w-3 h-3 text-bg-primary" />
                <span className="text-bg-primary text-[10px] font-bold uppercase tracking-wider">Article du moment</span>
              </div>

              {/* Image grande */}
              <div className="sm:w-72 lg:w-80 h-52 sm:h-auto flex-shrink-0 overflow-hidden relative">
                <Image
                  src={vedette.image}
                  alt={vedette.titre}
                  fill
                  sizes="(max-width: 640px) 100vw, 320px"
                  priority
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Contenu */}
              <div className="p-6 sm:p-8 flex flex-col justify-between flex-1">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${CATEGORIE_COLORS[vedette.categorie] || "text-text-muted bg-bg-elevated border-border"}`}>
                      {vedette.categorie}
                    </span>
                    {vedette.popular && (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-status-win/90 text-white border border-status-win/30">
                        ✦ Populaire
                      </span>
                    )}
                  </div>
                  <h2 className="font-serif font-bold text-text-primary text-xl sm:text-2xl leading-snug mb-3 group-hover:text-gold-light transition-colors">
                    {vedette.titre}
                  </h2>
                  <p className="text-text-secondary text-sm leading-relaxed line-clamp-3">{vedette.description}</p>
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {vedette.readTime} min de lecture
                    </span>
                    <time dateTime={vedette.date}>
                      {new Date(vedette.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </time>
                  </div>
                  <span className="flex items-center gap-1.5 text-gold-primary text-sm font-bold group-hover:gap-2.5 transition-all">
                    Lire l&apos;analyse <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* ── FILTRES CATÉGORIES ─────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-8">
          {FILTRES.map((f) => (
            <Link
              key={f.value}
              href={f.value === "all" ? "/blog" : `/blog?filtre=${f.value}`}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                filtre === f.value
                  ? "bg-gold-primary text-bg-primary border-gold-primary shadow-gold-sm"
                  : "bg-bg-elevated text-text-secondary border-border hover:border-gold-primary/40 hover:text-gold-light"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── ARTICLES — 2/3 ──────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">
            {articlesFiltered.length === 0 ? (
              <div className="card-base p-10 text-center">
                <BookOpen className="w-10 h-10 text-text-muted mx-auto mb-3" />
                <p className="text-text-secondary">Aucun article dans cette catégorie.</p>
              </div>
            ) : (
              articlesFiltered.map((article) => (
                <Link
                  key={article.slug}
                  href={`/blog/${article.slug}`}
                  className="card-base overflow-hidden flex flex-col sm:flex-row hover:border-gold-primary/40 transition-all group"
                >
                  {/* Image */}
                  <div className="sm:w-44 h-36 sm:h-auto flex-shrink-0 overflow-hidden relative">
                    <Image
                      src={article.image}
                      alt={article.titre}
                      fill
                      sizes="(max-width: 640px) 100vw, 176px"
                      loading="lazy"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {article.popular && (
                      <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-status-win/90 text-white">
                        ✦ Populaire
                      </span>
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="p-5 flex flex-col justify-between flex-1">
                    <div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${CATEGORIE_COLORS[article.categorie] || "text-text-muted bg-bg-elevated border-border"}`}>
                          {article.categorie}
                        </span>
                      </div>
                      <h2 className="font-serif font-bold text-text-primary text-base sm:text-lg leading-snug mb-2 group-hover:text-gold-light transition-colors">
                        {article.titre}
                      </h2>
                      <p className="text-text-secondary text-sm line-clamp-2">{article.description}</p>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {article.readTime} min
                        </span>
                        <time dateTime={article.date}>
                          {new Date(article.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                        </time>
                      </div>
                      <span className="flex items-center gap-1 text-gold-primary text-xs font-semibold group-hover:gap-2 transition-all">
                        Lire <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* ── SIDEBAR — 1/3 ───────────────────────────────────── */}
          <aside className="space-y-6">

            {/* Dernière minute — 3 articles les plus récents */}
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
                    <Image
                      src={a.image}
                      alt={a.titre}
                      width={56}
                      height={40}
                      loading="lazy"
                      className="w-14 h-10 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-text-primary text-xs font-semibold leading-snug line-clamp-2 group-hover:text-gold-light transition-colors">
                        {a.titre}
                      </p>
                      <time dateTime={a.date} className="text-text-muted text-[10px] mt-0.5 block">
                        {new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </time>
                    </div>
                  </Link>
                ))}
                <Link href="/blog" className="flex items-center gap-1 text-gold-primary text-xs font-semibold hover:gap-2 transition-all pt-1">
                  Tous les articles <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Thèmes populaires */}
            <div className="card-base p-5">
              <h3 className="font-serif font-bold text-text-primary text-base mb-3">Thèmes populaires</h3>
              <div className="flex flex-wrap gap-2">
                {["Quinté+", "Vincennes", "Longchamp", "Chantilly", "PMU Côte d'Ivoire", "PMU Sénégal", "Tiercé", "Quarté+", "Trot", "Bankroll"].map((tag) => (
                  <span key={tag} className="text-xs px-3 py-1.5 bg-bg-elevated text-text-secondary rounded-full border border-border hover:border-gold-primary/30 hover:text-gold-light transition-colors cursor-default">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Maillage interne sidebar */}
            <div className="card-base p-5">
              <h3 className="font-serif font-bold text-text-primary text-base mb-3">Explorer Elite Turf</h3>
              <nav className="space-y-2">
                <Link href="/pronostics" className="flex items-center gap-2 text-sm text-text-secondary hover:text-gold-light transition-colors py-1 group">
                  <ChevronRight className="w-3.5 h-3.5 text-gold-primary/60 group-hover:text-gold-primary transition-colors" />
                  Pronostics du jour
                </Link>
                <Link href="/performances" className="flex items-center gap-2 text-sm text-text-secondary hover:text-gold-light transition-colors py-1 group">
                  <ChevronRight className="w-3.5 h-3.5 text-gold-primary/60 group-hover:text-gold-primary transition-colors" />
                  Résultats & Performances
                </Link>
                <Link href="/abonnements" className="flex items-center gap-2 text-sm text-text-secondary hover:text-gold-light transition-colors py-1 group">
                  <ChevronRight className="w-3.5 h-3.5 text-gold-primary/60 group-hover:text-gold-primary transition-colors" />
                  Nos abonnements
                </Link>
                <Link href="/archives" className="flex items-center gap-2 text-sm text-text-secondary hover:text-gold-light transition-colors py-1 group">
                  <ChevronRight className="w-3.5 h-3.5 text-gold-primary/60 group-hover:text-gold-primary transition-colors" />
                  Archives des courses
                </Link>
              </nav>
            </div>

            {/* Derniers pronostics gratuits */}
            {pronosticsGratuits.length > 0 && (
              <div className="card-base p-5">
                <h3 className="font-serif font-bold text-text-primary text-base mb-4 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-gold-primary" />
                  Pronostics gratuits
                </h3>
                <div className="space-y-3">
                  {pronosticsGratuits.map((p) => (
                    <Link
                      key={p.id}
                      href={`/pronostics/${p.id}`}
                      className="block p-3 bg-bg-elevated rounded-lg hover:bg-bg-hover transition-colors"
                    >
                      <p className="text-text-primary text-sm font-semibold truncate">
                        {(p.course as { libelle?: string } | null)?.libelle || "Pronostic PMU"}
                      </p>
                      <p className="text-text-muted text-xs mt-0.5 line-clamp-1">{p.analyse_courte}</p>
                    </Link>
                  ))}
                  <Link href="/pronostics" className="flex items-center gap-1 text-gold-primary text-xs font-semibold hover:gap-2 transition-all">
                    Tous les pronostics <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* CTA abonnement — en bas de sidebar */}
            <div className="card-base border-gold-primary/30 p-5 text-center">
              <Star className="w-8 h-8 text-gold-primary mx-auto mb-3" fill="#C9A84C" />
              <h3 className="font-serif font-bold text-text-primary text-base mb-2">
                Accédez aux pronostics experts
              </h3>
              <p className="text-text-secondary text-sm mb-4">
                Pack Starter dès 65€. Analyses Quinté+, Tiercé et Quarté+ par nos spécialistes.
              </p>
              <Link href="/abonnements" className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
                <Star className="w-4 h-4" />
                Voir les formules
              </Link>
            </div>

          </aside>
        </div>

        {/* ── MAILLAGE INTERNE — BAS DE PAGE ─────────────────────── */}
        <div className="mt-16 pt-10 border-t border-border/30">
          <div className="text-center mb-8">
            <h2 className="font-serif text-xl font-bold text-text-primary mb-2">
              Tout ce qu&apos;il faut pour parier avec méthode
            </h2>
            <p className="text-text-secondary text-sm">
              Pronostics, performances vérifiables, guides et support — tout est accessible depuis Elite Turf.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {MAILLAGE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="card-base p-4 hover:border-gold-primary/30 transition-all group"
              >
                <p className="font-semibold text-text-primary text-sm group-hover:text-gold-light transition-colors mb-1">
                  {link.label}
                </p>
                <p className="text-text-muted text-xs">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
