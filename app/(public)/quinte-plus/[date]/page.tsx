/**
 * /quinte-plus/[date] — Page dédiée au Quinté+ d'une date.
 *
 * LEVIER SEO #1 : "quinté+ du jour" est la requête Google la plus tapée du turf
 * français (≈ 100k searches/jour selon Ahrefs). Concurrents Geny / Zone-Turf /
 * Paris-Turf monopolisent le top 5 SERP avec des URLs canoniques par date.
 *
 * Stratégie :
 *  - URL canonique propre `/quinte-plus/2026-05-04` au lieu de `/courses/{uuid}`
 *  - ISR : 60s aujourd'hui, 600s futur, 24h passé
 *  - Schema.org SportsEvent + BreadcrumbList
 *  - Si pronostic Elite Turf publié pour la course → highlight dans la page
 *  - Si arrivée disponible (date passée) → afficher arrivée + commentaire
 *  - Sinon → partants + cotes + analyse partants
 */

import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar, MapPin, Users, Clock, Star,
  ArrowLeft, ChevronRight, TrendingUp, Trophy, Lock,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import PageHero from "@/components/layout/PageHero";
import DateRangeNav from "@/components/ui/DateRangeNav";
import {
  isValidDateParam, formatDateLong, formatDateCompact, formatDateShort,
  isToday, isFuture, todayParis, generateDateRangeParams,
} from "@/lib/seo/dates";
import { buildNewsArticleJsonLd } from "@/lib/seo/newsarticle-jsonld";
import { buildSportsEventJsonLd } from "@/lib/seo/sportsevent-jsonld";
import TrackPageView from "@/components/analytics/TrackPageView";
import LeadCaptureCompact from "@/components/leads/LeadCaptureCompact";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface PageProps { params: { date: string } }

export async function generateStaticParams() {
  return generateDateRangeParams();
}

export const dynamicParams = true;
// Past dates / future : ISR 600s. Aujourd'hui : noStore() ci-dessous (full-dynamic)
// pour que les arrivées du Quinté+ s'affichent dès la sync Geny → DB sans cache.
export const revalidate    = 600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!isValidDateParam(params.date)) return { title: "Date invalide — Elite Turf" };
  const dateLong    = formatDateLong(params.date);
  const dateCompact = formatDateCompact(params.date);
  const today       = isToday(params.date);

  // Récupérer libellé Quinté+ pour titre encore plus précis si possible
  let quinteTitle = "";
  let hippoName   = "";
  try {
    const supabase = createServiceClient();
    const { data: c } = await supabase
      .from("courses")
      .select("libelle, hippodrome:hippodromes(nom)")
      .eq("date_course", params.date)
      .contains("paris_disponibles", ["QUINTE_PLUS"])
      .limit(1)
      .single();
    if (c) {
      quinteTitle = c.libelle || "";
      hippoName   = (c.hippodrome as any)?.nom || "";
    }
  } catch {}

  const titleSuffix = quinteTitle && hippoName
    ? ` — ${quinteTitle}, ${hippoName}`
    : "";

  // ── Boost CTR : trophée + "gratuit" + appel à action ──
  // Le mot "Quinté+" est très concurrentiel → on doit se démarquer en SERP.
  // Emoji 🏆 = signal "championnat" → ⭐ pour le pronostic Elite Turf.
  // Mention explicite "gratuit" = lève la friction d'achat.
  return {
    title: `🏆 Quinté+ ${today ? "du jour" : `du ${dateCompact}`}${titleSuffix} : pronostic gratuit | Elite Turf`,
    description: quinteTitle
      ? `🏆 Pronostic Quinté+ du ${dateLong} : ${quinteTitle} à ${hippoName}. Sélection Elite Turf, partants, cotes en direct, arrivée officielle et rapports PMU.`
      : `🏆 Pronostic Quinté+ gratuit du ${dateLong} : partants, cotes probables, arrivée officielle et rapports. Sélection experte Elite Turf publiée avant le départ.`,
    alternates: { canonical: `${APP_URL}/quinte-plus/${params.date}` },
    openGraph: {
      title: `🏆 Quinté+ ${dateCompact}${titleSuffix} — Pronostic Elite Turf`,
      description: `Pronostic + partants + arrivée du Quinté+ du ${dateLong}.`,
      url: `${APP_URL}/quinte-plus/${params.date}`,
      type: "website",
    },
  };
}

export default async function QuintePlusPage({ params }: PageProps) {
  if (!isValidDateParam(params.date)) notFound();

  // Aujourd'hui : bypass du cache ISR pour afficher cotes/partants/arrivée
  // dès qu'ils sont sync depuis Geny. Past/futur restent en ISR 600s.
  if (isToday(params.date)) noStore();

  const today    = todayParis();
  const minDate  = new Date(new Date(today).getTime() - 90 * 24 * 3600 * 1000)
    .toISOString().split("T")[0];
  const maxDate  = new Date(new Date(today).getTime() + 30 * 24 * 3600 * 1000)
    .toISOString().split("T")[0];
  if (params.date < minDate || params.date > maxDate) notFound();

  const supabase = createServiceClient();

  const { data: course } = await supabase
    .from("courses")
    .select(`
      id, numero_reunion, numero_course, libelle,
      date_course, heure_depart, distance_metres,
      categorie, terrain, nb_partants, statut, arrivee_officielle,
      paris_disponibles,
      hippodrome:hippodromes(id, nom, pays, ville),
      partants(
        id, numero, nom_cheval, jockey, entraineur,
        cote, musique, poids_kg, place_corde, age, sexe, non_partant
      ),
      pronostics(
        id, niveau_acces, type_pari, selection,
        confiance, analyse_courte, publie, date_publication
      )
    `)
    .eq("date_course", params.date)
    .contains("paris_disponibles", ["QUINTE_PLUS"])
    .limit(1)
    .single();

  const c = course as any;

  // ── Dates avec Quinté+ disponibles (30 derniers jours) ──────────────
  // Pour la nav : pastille ✓ sur les jours qui ont au moins 1 course Quinté+.
  const minPillDate = new Date(new Date(today).getTime() - 30 * 24 * 3600 * 1000)
    .toISOString().split("T")[0];
  const maxPillDate = new Date(new Date(today).getTime() + 7 * 24 * 3600 * 1000)
    .toISOString().split("T")[0];
  const { data: rawDates } = await supabase
    .from("courses")
    .select("date_course")
    .gte("date_course", minPillDate)
    .lte("date_course", maxPillDate)
    .contains("paris_disponibles", ["QUINTE_PLUS"]);
  const datesWithQuinte = Array.from(
    new Set((rawDates ?? []).map((r: { date_course: string }) => r.date_course)),
  );

  const dateLong   = formatDateLong(params.date);
  const dateShort  = formatDateShort(params.date);
  const today2     = isToday(params.date);
  const isFut      = isFuture(params.date);

  // ── Cas pas de Quinté+ trouvé (rare hors lundi/relâche) ──────────
  if (!c) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <PageHero
          image="/images/heroes/hero-pronostics.jpg"
          titre={`Quinté+ ${today2 ? "du jour" : ""}`}
          sousTitre={dateLong}
        />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <DateRangeNav
            currentDate={params.date}
            basePath="/quinte-plus"
            datesWithContent={datesWithQuinte}
            contentLabel="Quinté+ disponible"
            pastDays={90}
          />
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-12 text-center">
          <div className="card-base p-10">
            <Star className="w-10 h-10 text-text-muted mx-auto mb-4" />
            <h2 className="font-serif text-xl font-bold text-text-primary mb-2">
              {isFut ? "Quinté+ pas encore publié" : "Pas de Quinté+ ce jour"}
            </h2>
            <p className="text-text-secondary text-sm mb-6 max-w-md mx-auto">
              {isFut
                ? "Le Quinté+ de cette date sera disponible la veille à 17h45 (publication PMU)."
                : "Aucune course n'a été désignée Quinté+ pour cette date."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/programme/${params.date}`} className="px-5 py-2.5 bg-bg-elevated border border-border rounded-xl text-text-secondary text-sm hover:border-gold-primary/40 transition-all">
                Voir le programme du {dateShort}
              </Link>
              <Link href={`/quinte-plus/${todayParis()}`} className="px-5 py-2.5 bg-gold-primary text-bg-primary text-sm font-bold rounded-xl">
                Quinté+ du jour
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hippo = Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome;
  const partants = (c.partants ?? [])
    .filter((p: any) => !p.non_partant)
    .sort((a: any, b: any) => (a.numero || 0) - (b.numero || 0));

  const pronosticPublie = (c.pronostics ?? []).find(
    (p: any) => p.publie && p.type_pari === "QUINTE_PLUS",
  );

  const arrivee = Array.isArray(c.arrivee_officielle) && c.arrivee_officielle.length > 0
    ? c.arrivee_officielle
    : null;
  const isFini  = c.statut === "TERMINE" && arrivee;
  // Anti-fuite : la sélection premium du Quinté+ n'est révélée publiquement que
  // si la course est courue (preuve a posteriori) ou si le prono est GRATUIT.
  // Sinon (prono PRO/ELITE d'une course à venir) → teaser verrouillé, sinon le
  // pari premium du jour serait lisible gratuitement sur cette page SEO publique.
  const revealPronostic =
    isFini || params.date < today || pronosticPublie?.niveau_acces === "GRATUIT";

  // Top 5 partants par cote (favoris)
  const favoris = [...partants]
    .filter((p: any) => p.cote != null && p.cote > 0)
    .sort((a: any, b: any) => (a.cote || 99) - (b.cote || 99))
    .slice(0, 5);

  // ── Schema.org ───────────────────────────────────────────────────
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",   item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Pronostics", item: `${APP_URL}/pronostics` },
      { "@type": "ListItem", position: 3, name: `Quinté+ ${dateShort}`, item: `${APP_URL}/quinte-plus/${params.date}` },
    ],
  };

  // NewsArticle JSON-LD : critère Google News + Top Stories carousel.
  const newsArticleLd = buildNewsArticleJsonLd({
    url:           `${APP_URL}/quinte-plus/${params.date}`,
    headline:      `Quinté+ du ${dateLong} : ${c.libelle} (${hippo?.nom})`,
    description:   `Pronostic Quinté+ du ${dateLong}. ${c.libelle} à ${hippo?.nom} : ${c.nb_partants} partants, ${c.distance_metres ? c.distance_metres + "m" : ""} ${c.categorie || ""}. Analyse, partants, arrivée et rapports.`,
    datePublished: today2
      ? new Date().toISOString()
      : `${params.date}T08:00:00.000Z`,
    dateModified:  new Date().toISOString(),
    image:         `${APP_URL}/images/heroes/hero-pronostics.jpg`,
    keywords:      ["Quinté+", "pronostic Quinté+", "arrivée Quinté+", "rapports Quinté+", hippo?.nom].filter(Boolean) as string[],
    articleSection: "Hippisme — Quinté+",
  });

  // SportsEvent enrichi (champs recommandés Google complets)
  const eventLd = buildSportsEventJsonLd(
    { ...c, hippodrome: hippo },
    { url: `${APP_URL}/quinte-plus/${params.date}` },
  );

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* 📊 Funnel haut : vue de la page vedette (cf lib/analytics/track.ts) */}
      <TrackPageView event="view_vedette" params={{ source: "quinte-plus", date: params.date }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventLd) }}
      />

      <PageHero
        image="/images/heroes/hero-pronostics.jpg"
        titre={`Quinté+ ${today2 ? "du jour" : ""}`}
        sousTitre={`${c.libelle} · ${hippo?.nom}`}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Breadcrumb ──────────────────────────────────────────── */}
        <nav className="mb-4 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/pronostics" className="hover:text-gold-primary">Pronostics</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary">Quinté+ {dateShort}</span>
        </nav>

        {/* ── Navigation entre dates (historique des Quinté+) ──────── */}
        <DateRangeNav
          currentDate={params.date}
          basePath="/quinte-plus"
          datesWithContent={datesWithQuinte}
          contentLabel="Quinté+ disponible"
          pastDays={90}
        />

        {/* ── En-tête course ──────────────────────────────────────── */}
        <div className="card-base p-5 mb-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-4 h-4 text-gold-primary" fill="currentColor" />
                <span className="text-gold-primary text-xs font-bold uppercase tracking-wider">
                  Quinté+ R{c.numero_reunion}C{c.numero_course}
                </span>
              </div>
              <h1 className="font-serif font-bold text-text-primary text-xl sm:text-2xl mb-1">
                {c.libelle}
              </h1>
              <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{hippo?.nom}</span>
                {c.heure_depart && (
                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{c.heure_depart.substring(0, 5)}</span>
                )}
                {c.distance_metres && <span>· {c.distance_metres} m</span>}
                {c.categorie && <span>· {c.categorie}</span>}
                {c.terrain && <span>· {c.terrain}</span>}
                <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{c.nb_partants} partants</span>
              </div>
            </div>
            <Link
              href={`/courses/${c.id}`}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-secondary text-xs hover:border-gold-primary/40 whitespace-nowrap"
            >
              Fiche complète <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* ── Arrivée officielle (course terminée) ────────────────── */}
        {isFini && (
          <section className="card-base p-5 mb-6 border-status-win/30">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-status-win" />
              <h2 className="font-serif font-bold text-text-primary text-base">
                Arrivée officielle
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {arrivee!.map((num: number, idx: number) => {
                const part = partants.find((p: any) => p.numero === num);
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      idx === 0
                        ? "bg-status-win/15 border border-status-win/40"
                        : "bg-bg-elevated border border-border"
                    }`}
                  >
                    <span className="text-text-muted text-xs font-mono">
                      {idx + 1}<sup>e</sup>
                    </span>
                    <span className="text-gold-primary font-bold text-sm">
                      {num}
                    </span>
                    {part?.nom_cheval && (
                      <span className="text-text-primary text-sm font-medium">
                        {part.nom_cheval}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Pronostic Elite (si publié) ──────────────────────────── */}
        {pronosticPublie && (
          <section className="card-base p-5 mb-6 border-gold-primary/30 bg-gradient-to-br from-bg-card to-[#1A1610]">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-5 h-5 text-gold-primary" fill="currentColor" />
              <h2 className="font-serif font-bold text-text-primary text-base">
                Pronostic Elite Turf
              </h2>
              {pronosticPublie.confiance && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded bg-gold-primary/20 text-gold-light font-semibold">
                  Confiance {pronosticPublie.confiance}/5
                </span>
              )}
            </div>

            {revealPronostic ? (
              <>
                {Array.isArray(pronosticPublie.selection) && pronosticPublie.selection.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {pronosticPublie.selection.map((num: number, i: number) => (
                      <span key={i} className="px-3 py-1.5 rounded-lg bg-gold-primary/10 border border-gold-primary/30 text-gold-light text-sm font-bold">
                        {num}
                      </span>
                    ))}
                  </div>
                )}

                {pronosticPublie.analyse_courte && (
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {pronosticPublie.analyse_courte}
                  </p>
                )}
              </>
            ) : (
              <div className="mb-1">
                <div className="flex flex-wrap gap-2 mb-3">
                  {Array.from({ length: Math.min(Array.isArray(pronosticPublie.selection) ? pronosticPublie.selection.length : 5, 6) }).map((_, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-lg bg-bg-elevated border border-border text-text-muted text-sm font-bold select-none">
                      ?
                    </span>
                  ))}
                </div>
                <p className="inline-flex items-center gap-1.5 text-gold-primary text-sm font-semibold">
                  <Lock className="w-4 h-4" />
                  Sélection réservée aux abonnés
                </p>
              </div>
            )}

            <Link
              href={`/pronostics/${pronosticPublie.id}`}
              className="inline-flex items-center gap-1 mt-3 text-gold-primary text-xs font-semibold hover:text-gold-light"
            >
              Voir l&apos;analyse complète <ChevronRight className="w-3 h-3" />
            </Link>
          </section>
        )}

        {/* ── Top favoris (cotes) ─────────────────────────────────── */}
        {favoris.length > 0 && !isFini && (
          <section className="card-base p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-gold-primary" />
              <h2 className="font-serif font-bold text-text-primary text-base">
                Top 5 favoris (cotes Geny)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-muted text-xs">
                    <th className="py-2 text-left font-medium">N°</th>
                    <th className="py-2 text-left font-medium">Cheval</th>
                    <th className="py-2 text-left font-medium hidden sm:table-cell">Jockey</th>
                    <th className="py-2 text-right font-medium">Cote</th>
                  </tr>
                </thead>
                <tbody>
                  {favoris.map((p: any) => (
                    <tr key={p.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 text-gold-primary font-bold">{p.numero}</td>
                      <td className="py-2 text-text-primary font-medium">{p.nom_cheval}</td>
                      <td className="py-2 text-text-muted text-xs hidden sm:table-cell">{p.jockey || "—"}</td>
                      <td className="py-2 text-right text-text-secondary font-mono">{p.cote ? p.cote.toFixed(1) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Tous les partants ───────────────────────────────────── */}
        {partants.length > 0 && (
          <section className="card-base p-5 mb-6">
            <h2 className="font-serif font-bold text-text-primary text-base mb-3">
              Partants ({partants.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-muted text-xs">
                    <th className="py-2 text-left font-medium">N°</th>
                    <th className="py-2 text-left font-medium">Cheval</th>
                    <th className="py-2 text-left font-medium hidden md:table-cell">Jockey</th>
                    <th className="py-2 text-left font-medium hidden lg:table-cell">Entraîneur</th>
                    <th className="py-2 text-left font-medium hidden sm:table-cell">Musique</th>
                    <th className="py-2 text-right font-medium">Cote</th>
                  </tr>
                </thead>
                <tbody>
                  {partants.map((p: any) => (
                    <tr key={p.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 text-gold-primary font-bold">{p.numero}</td>
                      <td className="py-2 text-text-primary font-medium">{p.nom_cheval}</td>
                      <td className="py-2 text-text-secondary text-xs hidden md:table-cell">{p.jockey || "—"}</td>
                      <td className="py-2 text-text-muted text-xs hidden lg:table-cell">{p.entraineur || "—"}</td>
                      <td className="py-2 text-text-muted font-mono text-xs hidden sm:table-cell">{p.musique || "—"}</td>
                      <td className="py-2 text-right text-text-secondary font-mono">{p.cote ? p.cote.toFixed(1) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Capture email (funnel Étage 2) ──────────────────────── */}
        {/*
          Réutilise le pipeline leads existant (guide de l'Initié).
          Placé avant les liens annexes : Clarity montre 91,8% de bounce
          sur ces pages SEO — on propose une raison de laisser un email
          avant que le visiteur reparte.
        */}
        <LeadCaptureCompact source="quinte-plus" />

        {/* ── Liens annexes ───────────────────────────────────────── */}
        {/*
          Card "Voir tous nos pronostics" en 1ere position : Clarity 14j montre
          que les pages /quinte-plus/[date] ont 91,8% de bounce. Le footer
          existant pointe vers /programme et /arrivees mais pas vers /pronostics
          (le hub). On capte ici le visiteur SEO avant qu'il reparte.
        */}
        <div className="grid sm:grid-cols-3 gap-3 mt-8">
          <Link
            href="/pronostics"
            className="card-base p-4 hover:border-gold-primary/60 transition-all flex items-center gap-3 border-gold-primary/30 bg-gradient-to-br from-bg-card to-[#1A1610]"
          >
            <Star className="w-5 h-5 text-gold-primary flex-shrink-0" fill="currentColor" />
            <div className="flex-1">
              <div className="text-text-primary text-sm font-semibold">Tous nos pronostics</div>
              <div className="text-text-muted text-xs">Tiercé, Quarté+, Quinté+ du jour</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gold-primary" />
          </Link>
          <Link
            href={`/programme/${params.date}`}
            className="card-base p-4 hover:border-gold-primary/40 transition-all flex items-center gap-3"
          >
            <Calendar className="w-5 h-5 text-gold-primary" />
            <div className="flex-1">
              <div className="text-text-primary text-sm font-semibold">Programme du {dateShort}</div>
              <div className="text-text-muted text-xs">Toutes les courses du jour</div>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted" />
          </Link>
          {!isFut && (
            <Link
              href={`/arrivees/${params.date}`}
              className="card-base p-4 hover:border-gold-primary/40 transition-all flex items-center gap-3"
            >
              <Trophy className="w-5 h-5 text-gold-primary" />
              <div className="flex-1">
                <div className="text-text-primary text-sm font-semibold">Arrivées du {dateShort}</div>
                <div className="text-text-muted text-xs">Résultats officiels et rapports</div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </Link>
          )}
        </div>

        {/* ── CTA abonnement ──────────────────────────────────────── */}
        {!pronosticPublie && (
          <div className="mt-8 p-5 rounded-2xl bg-gradient-to-r from-bg-card via-[#1A1610] to-bg-card border border-gold-primary/30 text-center">
            <p className="text-text-primary font-semibold text-sm mb-2">
              Pronostic Quinté+ Elite Turf chaque jour à 7h
            </p>
            <p className="text-text-muted text-xs mb-4">
              Sélection détaillée + analyse experte. À partir de 65€/mois.
            </p>
            <Link
              href="/abonnements"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all"
            >
              Voir les offres
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
