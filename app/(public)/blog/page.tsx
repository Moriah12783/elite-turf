import { Metadata } from "next";
import Link from "next/link";
import { Clock, Tag, ArrowRight, Star, BookOpen } from "lucide-react";
import { BLOG_ARTICLES } from "@/lib/blog-data";
import { createServiceClient } from "@/lib/supabase/server";
import PageHero from "@/components/layout/PageHero";

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
};

const CATEGORIE_COLORS: Record<string, string> = {
  "Quinté+":         "text-gold-primary bg-gold-faint border-gold-primary/30",
  "Guide":           "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "Guide hippodromes": "text-purple-400 bg-purple-500/10 border-purple-500/30",
  "Guide paris":     "text-status-win bg-status-win/10 border-status-win/20",
};

export default async function BlogPage() {
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
        image="https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=1920&q=80"
        titre="Blog PMU & Conseils"
        sousTitre="Analyses, guides et stratégies pour les parieurs francophones"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">

        {/* En-tête */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold-faint border border-gold-primary/30 rounded-full mb-4">
            <BookOpen className="w-4 h-4 text-gold-primary" />
            <span className="text-gold-light text-xs font-semibold uppercase tracking-wider">
              Blog PMU & Conseils
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary mb-3">
            Guides & Analyses PMU
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl">
            Tout ce qu&apos;il faut savoir pour parier intelligemment sur les courses françaises
            depuis l&apos;parieurs francophones. Par nos experts depuis Paris.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Articles — 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {BLOG_ARTICLES.map((article, i) => (
              <Link
                key={article.slug}
                href={`/blog/${article.slug}`}
                className="card-base overflow-hidden flex flex-col sm:flex-row hover:border-gold-primary/40 transition-all group"
              >
                {/* Image */}
                <div className="sm:w-48 h-40 sm:h-auto flex-shrink-0 overflow-hidden">
                  <img
                    src={article.image}
                    alt={article.titre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Contenu */}
                <div className="p-5 flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${CATEGORIE_COLORS[article.categorie] || "text-text-muted bg-bg-elevated border-border"}`}>
                        {article.categorie}
                      </span>
                      {i === 0 && (
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-status-win/10 text-status-win border border-status-win/20">
                          ✦ Populaire
                        </span>
                      )}
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
                        {article.readTime}
                      </span>
                      <span>{new Date(article.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
                    </div>
                    <span className="flex items-center gap-1 text-gold-primary text-xs font-semibold group-hover:gap-2 transition-all">
                      Lire <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Sidebar — 1/3 */}
          <aside className="space-y-6">

            {/* CTA abonnement */}
            <div className="card-base border-gold-primary/30 p-5 text-center">
              <Star className="w-8 h-8 text-gold-primary mx-auto mb-3" />
              <h3 className="font-serif font-bold text-text-primary text-lg mb-2">
                Pronostics dès 29€
              </h3>
              <p className="text-text-secondary text-sm mb-4">
                Accédez à nos pronostics experts du Quinté+ et Tiercé. Analysés depuis Paris.
              </p>
              <Link href="/abonnements" className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
                <Star className="w-4 h-4" />
                Voir les offres
              </Link>
            </div>

            {/* Derniers pronostics gratuits */}
            <div className="card-base p-5">
              <h3 className="font-serif font-bold text-text-primary text-base mb-4 flex items-center gap-2">
                <Tag className="w-4 h-4 text-gold-primary" />
                Pronostics gratuits
              </h3>
              {pronosticsGratuits.length > 0 ? (
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
              ) : (
                <p className="text-text-muted text-sm">
                  <Link href="/pronostics" className="text-gold-primary hover:underline">Voir tous les pronostics</Link>
                </p>
              )}
            </div>

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
