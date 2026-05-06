/**
 * /blog/bilan-mensuel/[mois] — Bilan PMU mensuel.
 *
 * Article auto-généré chaque mois, format YYYY-MM. Capte le SEO long-tail
 * "bilan PMU mai 2026", "résultats hippiques mois", "statistiques turf mensuelles".
 */

import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, TrendingUp, MapPin, Calendar, Sparkles } from "lucide-react";
import AutoArticleLayout from "@/components/blog-auto/AutoArticleLayout";
import {
  isValidMonthParam, getMonthDateRange, formatMonthHuman,
  generateRecentMonthParams, currentMonth,
} from "@/lib/blog-auto/dates";
import {
  getPeriodStats, getTopJockeysForPeriod,
  getTopChevauxForPeriod, getQuintesForPeriod,
} from "@/lib/blog-auto/queries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface PageProps { params: { mois: string } }

export const dynamicParams = true;
export const revalidate = 7200; // 2h — un mois passé est stable

export async function generateStaticParams() {
  return generateRecentMonthParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!isValidMonthParam(params.mois)) return { title: "Mois invalide — Elite Turf" };
  const human = formatMonthHuman(params.mois);
  return {
    title: `Bilan PMU — ${human} | Statistiques mensuelles | Elite Turf`,
    description: `Récap PMU complet de ${human} : top jockeys, chevaux gagnants, Quinté+ marquants, hippodromes les plus actifs.`,
    alternates: { canonical: `${APP_URL}/blog/bilan-mensuel/${params.mois}` },
    openGraph: {
      title: `Bilan PMU — ${human}`,
      description: `Statistiques mensuelles complètes du turf en France et à l'international.`,
      url: `${APP_URL}/blog/bilan-mensuel/${params.mois}`,
      type: "article",
    },
  };
}

export default async function BilanMensuelPage({ params }: PageProps) {
  if (!isValidMonthParam(params.mois)) notFound();

  const cur = currentMonth();
  if (params.mois > cur) notFound();

  const { debut, fin } = getMonthDateRange(params.mois);
  const human = formatMonthHuman(params.mois);

  const [stats, topJockeys, topChevaux, quintes] = await Promise.all([
    getPeriodStats(debut, fin),
    getTopJockeysForPeriod(debut, fin, 15),
    getTopChevauxForPeriod(debut, fin, 12),
    getQuintesForPeriod(debut, fin, 10),
  ]);

  const publishedHuman = new Date(fin + "T20:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  const jsonLd = {
    "@context":  "https://schema.org",
    "@type":     "Article",
    headline:    `Bilan PMU — ${human}`,
    description: `Récap mensuel : ${stats.nb_courses_termine} courses, ${stats.nb_quintes_termine} Quinté+, ${stats.hippodromes_actifs.length} hippodromes.`,
    datePublished: fin,
    dateModified:  fin,
    author:    { "@type": "Organization", name: "Elite Turf", url: APP_URL },
    publisher: {
      "@type": "Organization", name: "Elite Turf",
      logo: { "@type": "ImageObject", url: `${APP_URL}/og-image.jpg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${APP_URL}/blog/bilan-mensuel/${params.mois}` },
    inLanguage: "fr-FR",
  };

  return (
    <AutoArticleLayout
      titre={`Bilan PMU — ${human}`}
      sousTitre={`${stats.nb_courses_termine} courses analysées, ${stats.nb_quintes_termine} Quinté+ disputés sur ${stats.hippodromes_actifs.length} hippodromes en ${human.toLowerCase()}.`}
      category="Bilan mensuel"
      heroImage="/images/heroes/hero-blog.jpg"
      publishedISO={fin}
      publishedHuman={publishedHuman}
      readTimeMin={6}
      breadcrumb={[
        { label: "Accueil", href: "/" },
        { label: "Blog",    href: "/blog" },
        { label: "Bilan mensuel", href: undefined },
        { label: human },
      ]}
      jsonLd={jsonLd}
    >
      <section className="not-prose grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Courses" value={stats.nb_courses_termine} />
        <StatCard label="Quinté+" value={stats.nb_quintes_termine} accent />
        <StatCard label="Partants" value={stats.nb_partants} />
        <StatCard label="Hippodromes" value={stats.hippodromes_actifs.length} />
      </section>

      <p>
        Le mois de <strong>{human}</strong> a livré un bilan riche pour le turf
        en France et à l&apos;international. Voici la synthèse exhaustive
        établie à partir des arrivées officielles validées sur Elite Turf.
      </p>

      {topJockeys.length > 0 && (
        <>
          <h2 className="font-serif text-text-primary mt-10 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold-primary" />
            Top {topJockeys.length} jockeys du mois
          </h2>
          <p>
            Classement par nombre de victoires totales sur le mois. Les taux
            de réussite sont calculés sur l&apos;ensemble des montes du jockey.
          </p>
          <div className="not-prose card-base overflow-hidden my-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted text-xs">
                  <th className="py-2 px-3 text-left font-medium">#</th>
                  <th className="py-2 px-3 text-left font-medium">Jockey</th>
                  <th className="py-2 px-3 text-right font-medium">Victoires</th>
                  <th className="py-2 px-3 text-right font-medium hidden sm:table-cell">Courses</th>
                  <th className="py-2 px-3 text-right font-medium">Taux</th>
                </tr>
              </thead>
              <tbody>
                {topJockeys.map((j, i) => (
                  <tr key={j.slug} className="border-b border-border/50 last:border-0">
                    <td className="py-2 px-3 text-text-muted text-xs">{i + 1}</td>
                    <td className="py-2 px-3">
                      <Link href={`/jockeys/${j.slug}`} className="text-text-primary font-medium hover:text-gold-primary">
                        {j.nom}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-right text-status-win font-bold">{j.victoires}</td>
                    <td className="py-2 px-3 text-right text-text-muted text-xs hidden sm:table-cell">{j.courses}</td>
                    <td className="py-2 px-3 text-right text-text-secondary font-mono text-xs">{j.taux.toFixed(1)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {topChevaux.length > 0 && (
        <>
          <h2 className="font-serif text-text-primary mt-10 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gold-primary" />
            Chevaux marquants du mois
          </h2>
          <p>
            Les chevaux ayant remporté au moins une course sur le mois,
            triés par nombre de victoires.
          </p>
          <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
            {topChevaux.map((c) => (
              <Link
                key={c.slug}
                href={`/chevaux/${c.slug}`}
                className="card-base p-3 flex items-center justify-between gap-3 hover:border-gold-primary/40 transition-all"
              >
                <span className="text-text-primary text-sm font-medium truncate">{c.nom}</span>
                <span className="inline-flex items-center gap-1 text-xs">
                  <Trophy className="w-3 h-3 text-status-win" />
                  <span className="font-bold text-status-win">{c.victoires}</span>
                  <span className="text-text-muted">/ {c.courses}</span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {stats.hippodromes_actifs.length > 0 && (
        <>
          <h2 className="font-serif text-text-primary mt-10 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-gold-primary" />
            Hippodromes les plus actifs
          </h2>
          <p>
            Volume de courses programmées par hippodrome sur le mois — un bon
            indicateur du dynamisme local du turf.
          </p>
          <div className="not-prose flex flex-wrap gap-2 my-4">
            {stats.hippodromes_actifs.map((h) => (
              <span
                key={h.nom}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-full text-xs"
              >
                <span className="text-text-secondary font-medium">{h.nom}</span>
                <span className="text-gold-primary font-mono font-bold">{h.nb}</span>
              </span>
            ))}
          </div>
        </>
      )}

      {quintes.length > 0 && (
        <>
          <h2 className="font-serif text-text-primary mt-10 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gold-primary" />
            Tous les Quinté+ du mois
          </h2>
          <p>
            Liste complète des Quinté+ disputés ce mois-ci avec leur arrivée
            officielle. Cliquez sur une ligne pour consulter les détails.
          </p>
          <ul className="not-prose space-y-2 my-4">
            {quintes.map((q) => (
              <li key={q.course_id}>
                <Link
                  href={`/quinte-plus/${q.date_course}`}
                  className="card-base p-3 flex items-center gap-3 hover:border-gold-primary/40 transition-all"
                >
                  <span className="text-gold-primary font-mono text-xs font-bold flex-shrink-0">
                    R{q.numero_reunion}C{q.numero_course}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-text-primary text-sm font-medium truncate">{q.libelle}</div>
                    <div className="text-text-muted text-xs">
                      {q.hippodrome_nom} · {new Date(q.date_course + "T12:00:00").toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  {q.arrivee && (
                    <div className="hidden sm:flex flex-wrap gap-1">
                      {q.arrivee.slice(0, 5).map((n, idx) => (
                        <span
                          key={idx}
                          className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold ${
                            idx === 0
                              ? "bg-status-win/15 text-status-win border border-status-win/30"
                              : "bg-bg-card text-text-secondary border border-border"
                          }`}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {stats.nb_courses_termine === 0 && (
        <p className="text-text-muted italic">
          Aucune course terminée enregistrée pour ce mois. Les bilans mensuels
          sont alimentés progressivement à mesure que les arrivées officielles
          sont synchronisées.
        </p>
      )}

      {/* CTA */}
      <div className="not-prose mt-10 p-5 rounded-2xl bg-gradient-to-r from-bg-card via-[#1A1610] to-bg-card border border-gold-primary/30 flex items-center gap-4">
        <Sparkles className="w-6 h-6 text-gold-primary flex-shrink-0" />
        <div className="flex-1">
          <p className="text-text-primary font-semibold text-sm mb-1">
            Recevez le bilan PMU chaque mois
          </p>
          <p className="text-text-muted text-xs">
            Nos experts publient un récap complet au début de chaque mois. Abonnez-vous pour ne rien manquer.
          </p>
        </div>
        <Link
          href="/abonnements"
          className="px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all whitespace-nowrap"
        >
          Voir les offres
        </Link>
      </div>
    </AutoArticleLayout>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`card-base p-4 text-center ${accent ? "border-gold-primary/30" : ""}`}>
      <div className={`font-serif font-bold text-2xl ${accent ? "text-gold-primary" : "text-text-primary"}`}>
        {value}
      </div>
      <div className="text-text-muted text-xs uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}
