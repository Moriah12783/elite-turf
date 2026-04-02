import { Metadata } from "next";
import Link from "next/link";
import { Clock, Tag, ArrowRight, Star, BookOpen, Zap } from "lucide-react";
import { BLOG_ARTICLES } from "@/lib/blog-data";
import { createServiceClient } from "@/lib/supabase/server";
import PageHero from "@/components/layout/PageHero";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

export const metadata: Metadata = {
  title: "Blog PMU — Pronostics & Guides pour les parieurs francophones",
  description:
    "Articles et guides PMU pour les parieurs francophones : Quinté+, Tiercé, Quarté+, hippodromes français, stratégies de paris. Expertise depuis Paris.",
  keywords: [
    "blog pronostic PMU",
    "guide paris PMU Afrique",
    "Quinté+ analyse",
    "hippodromes PMU France",
    "pronostic PMU Côte d'Ivoire",
  ],
  alternates: { canonical: `${APP_URL}/blog` },
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
};

// Groupes de filtres
const FILTRES = [
  { label: "Tous les articles", value: "all" },
  { label: "Expertise & Stratégie", value: "expertise", cats: ["Stratégie", "Expertise", "Technique", "Finance"] },
  { label: "Actualités & Marché", value: "actu", cats: ["Grands Prix", "Communauté", "Acteurs", "Marché", "Innovation"] },
  { label: "Débutants", value: "debutants", cats: ["Débutants"] },
];

interface PageProps {
  searchParams: { filtre?: string };
}

export default async function BlogPage({ searchParams }: PageProps) {
  const filtre = searchParams.filtre || "all";
  const filtreConfig = FILTRES.find((f) => f.value === filtre) ?? FILTRES[0];

  // Filtrage des articles
  const articles = filtre === "all"
    ? BLOG_ARTICLES
    : BLOG_ARTICLES.filter((a) => filtreConfig.cats?.includes(a.categorie));

  // 3 derniers articles pour la sidebar "Dernière minute"
  const derniersArticles = [...BLOG_ARTICLES]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

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

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHero
        image="/images/heroes/hero-blog.jpg"
        titre="Blog PMU & Conseils"
        sousTitre="Analyses, guides et stratégies pour les parieurs francophones"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">

        {/* En-tête */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold-faint border border-gold-primary/30 rounded-full mb-4">
            <BookOpen className="w-4 h-4 text-gold-primary" />
            <span className="text-gold-light text-xs font-semibold uppercase tracking-wider">
              {BLOG_ARTICLES.length} articles d&apos;expertise
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary mb-3">
            Guides & Analyses PMU
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl">
            Tout ce qu&apos;il faut savoir pour parier intelligemment sur les courses françaises.
            Par nos experts depuis Paris.
          </p>
        </div>

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
          <div className="lg:col-span-2 space-y-6">
            {articles.length === 0 ? (
              <div className="card-base p-10 text-center">
                <BookOpen className="w-10 h-10 text-text-muted mx-auto mb-3" />
                <p className="text-text-secondary">Aucun article dans cette catégorie.</p>
              </div>
            ) : (
              articles.map((article, i) => (
                <Link
                  key={article.slug}
                  href={`/blog/${article.slug}`}
                  className="card-base overflow-hidden flex flex-col sm:flex-row hover:border-gold-primary/40 transition-all group"
                >
                  {/* Image */}
                  <div className="sm:w-48 h-40 sm:h-auto flex-shrink-0 overflow-hidden relative">
                    <img
                      src={article.image}
                      alt={article.titre}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {article.popular && (
                      <span className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full bg-status-win/90 text-white">
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
                      <h2 className="font-serif font-bold text-text-primary text-lg leading-snug mb-2 group-hover:text-gold-light transition-colors">
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

            {/* CTA abonnement */}
            <div className="card-base border-gold-primary/30 p-5 text-center">
              <Star className="w-8 h-8 text-gold-primary mx-auto mb-3" />
              <h3 className="font-serif font-bold text-text-primary text-lg mb-2">
                Pronostics dès 65€
              </h3>
              <p className="text-text-secondary text-sm mb-4">
                Accédez à nos pronostics experts du Quinté+ et Tiercé. Analysés depuis Paris.
              </p>
              <Link href="/abonnements" className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
                <Star className="w-4 h-4" />
                Voir les offres
              </Link>
            </div>

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

            {/* Mots-clés populaires */}
            <div className="card-base p-5">
              <h3 className="font-serif font-bold text-text-primary text-base mb-3">Thèmes populaires</h3>
              <div className="flex flex-wrap gap-2">
                {["Quinté+", "Vincennes", "Longchamp", "Chantilly", "PMU Maroc", "PMU Côte d'Ivoire", "Tiercé", "Quarté+", "Trot", "Galop"].map((tag) => (
                  <span key={tag} className="text-xs px-3 py-1.5 bg-bg-elevated text-text-secondary rounded-full border border-border hover:border-gold-primary/30 hover:text-gold-light transition-colors cursor-default">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

          </aside>
        </div>
      </div>
    </div>
  );
}
