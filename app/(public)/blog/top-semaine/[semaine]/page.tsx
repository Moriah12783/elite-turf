/**
 * /blog/top-semaine/[semaine] — Top performers PMU de la semaine.
 *
 * Article auto-généré chaque semaine, au format ISO 8601 (YYYY-WNN).
 * Capte le trafic SEO long-tail "top jockeys mai 2026", "meilleurs chevaux
 * semaine 19", "bilan PMU semaine du [date]".
 */

import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, TrendingUp, MapPin, Calendar } from "lucide-react";
import AutoArticleLayout from "@/components/blog-auto/AutoArticleLayout";
import {
  isValidWeekParam, getWeekDateRange, formatWeekHumanLong,
  generateRecentWeekParams, currentWeekISO,
} from "@/lib/blog-auto/dates";
import {
  getPeriodStats, getTopJockeysForPeriod,
  getTopChevauxForPeriod, getQuintesForPeriod,
} from "@/lib/blog-auto/queries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface PageProps { params: { semaine: string } }

export const dynamicParams = true;
export const revalidate = 3600; // 1h — semaine en cours peut bouger en milieu de cycle

export async function generateStaticParams() {
  return generateRecentWeekParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!isValidWeekParam(params.semaine)) return { title: "Semaine invalide — Elite Turf" };
  const human = formatWeekHumanLong(params.semaine);
  return {
    title: `Top performers PMU — ${human} | Elite Turf`,
    description: `Bilan hebdomadaire des courses PMU : top jockeys, meilleurs chevaux, Quinté+ marquants — ${human}.`,
    alternates: { canonical: `${APP_URL}/blog/top-semaine/${params.semaine}` },
    openGraph: {
      title: `Top performers PMU — ${human}`,
      description: `Top jockeys + chevaux + Quinté+ marquants de la ${human.toLowerCase()}.`,
      url: `${APP_URL}/blog/top-semaine/${params.semaine}`,
      type: "article",
    },
  };
}

export default async function TopSemainePage({ params }: PageProps) {
  if (!isValidWeekParam(params.semaine)) notFound();

  // Limite : pas plus de 3 ans dans le passé, pas plus de 1 semaine dans le futur
  const current = currentWeekISO();
  if (params.semaine > current) notFound();

  const { debut, fin } = getWeekDateRange(params.semaine);
  const human = formatWeekHumanLong(params.semaine);

  const [stats, topJockeys, topChevaux, quintes] = await Promise.all([
    getPeriodStats(debut, fin),
    getTopJockeysForPeriod(debut, fin, 10),
    getTopChevauxForPeriod(debut, fin, 10),
    getQuintesForPeriod(debut, fin, 5),
  ]);

  const publishedHuman = new Date(fin + "T20:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  // ── JSON-LD Article ──────────────────────────────────────────────
  const jsonLd = {
    "@context":  "https://schema.org",
    "@type":     "Article",
    headline:    `Top performers PMU — ${human}`,
    description: `Bilan hebdomadaire des courses PMU : ${stats.nb_courses_termine} courses, ${stats.nb_quintes_termine} Quinté+, ${stats.hippodromes_actifs.length} hippodromes actifs.`,
    datePublished: fin,
    dateModified:  fin,
    author:    { "@type": "Organization", name: "Elite Turf", url: APP_URL },
    publisher: {
      "@type": "Organization",
      name:    "Elite Turf",
      logo: { "@type": "ImageObject", url: `${APP_URL}/og-image.jpg` },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id":   `${APP_URL}/blog/top-semaine/${params.semaine}`,
    },
    inLanguage: "fr-FR",
  };

  return (
    <AutoArticleLayout
      titre={`Top performers PMU — ${human}`}
      sousTitre={`Bilan hebdomadaire : ${stats.nb_courses_termine} courses analysées, ${stats.nb_quintes_termine} Quinté+ disputés sur ${stats.hippodromes_actifs.length} hippodromes.`}
      category="Bilan hebdomadaire"
      heroImage="/images/heroes/hero-performances.jpg"
      publishedISO={fin}
      publishedHuman={publishedHuman}
      readTimeMin={4}
      breadcrumb={[
        { label: "Accueil", href: "/" },
        { label: "Blog",    href: "/blog" },
        { label: "Top semaine", href: undefined },
        { label: human },
      ]}
      jsonLd={jsonLd}
    >
      {/* ── Stats clés ─────────────────────────────────────────── */}
      <section className="not-prose grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Courses" value={stats.nb_courses_termine} />
        <StatCard label="Quinté+" value={stats.nb_quintes_termine} accent />
        <StatCard label="Partants" value={stats.nb_partants} />
        <StatCard label="Hippodromes" value={stats.hippodromes_actifs.length} />
      </section>

      <p>
        Cette semaine du turf en France et à l&apos;international a vu se dérouler{" "}
        <strong>{stats.nb_courses_termine} courses</strong> sur{" "}
        <strong>{stats.hippodromes_actifs.length} hippodromes</strong> actifs.
        Voici notre bilan synthétique des performances les plus marquantes —
        données issues des arrivées officielles validées.
      </p>

      {/* ── Top jockeys ────────────────────────────────────────── */}
      {topJockeys.length > 0 && (
        <>
          <h2 className="font-serif text-text-primary mt-10 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold-primary" />
            Top jockeys de la semaine
          </h2>
          <p>
            Classement par nombre de victoires, avec taux de réussite calculé sur
            le total de courses disputées dans la semaine.
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

      {/* ── Top chevaux ────────────────────────────────────────── */}
      {topChevaux.length > 0 && (
        <>
          <h2 className="font-serif text-text-primary mt-10 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gold-primary" />
            Chevaux gagnants de la semaine
          </h2>
          <p>
            Les chevaux qui ont franchi la ligne en première position cette semaine.
            Cliquez sur un nom pour consulter leur historique complet.
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

      {/* ── Hippodromes les plus actifs ───────────────────────── */}
      {stats.hippodromes_actifs.length > 0 && (
        <>
          <h2 className="font-serif text-text-primary mt-10 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-gold-primary" />
            Hippodromes les plus actifs
          </h2>
          <div className="not-prose flex flex-wrap gap-2 my-4">
            {stats.hippodromes_actifs.map((h) => (
              <span
                key={h.nom}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-full text-xs"
              >
                <span className="text-text-secondary">{h.nom}</span>
                <span className="text-gold-primary font-mono font-bold">{h.nb}</span>
              </span>
            ))}
          </div>
        </>
      )}

      {/* ── Quinté+ marquants ──────────────────────────────────── */}
      {quintes.length > 0 && (
        <>
          <h2 className="font-serif text-text-primary mt-10 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gold-primary" />
            Quinté+ disputés cette semaine
          </h2>
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
          Aucune course terminée enregistrée pour cette semaine. Les arrivées sont
          synchronisées au fil de l&apos;eau et certaines journées peuvent être en
          attente de mise à jour.
        </p>
      )}
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
