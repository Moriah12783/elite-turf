/**
 * Affichage d'une page Quinté+, partagé par :
 *   - `/quinte-plus/[date]` : le Quinté+ d'une date ;
 *   - `/quinte-plus` : la page pilier « Pronostic Quinté+ du jour » (brief SEO
 *     du 01/10/2026, B2) — une URL fixe qui accumule l'autorité, comme celles
 *     des concurrents qui se classent.
 *
 * Déplacé tel quel depuis `[date]/page.tsx` (une page Next.js ne peut pas
 * exporter de composant réutilisable). `pilier` n'ajuste que le fil d'Ariane,
 * le titre du bandeau et l'URL des données structurées ; `complement` insère
 * les blocs propres à la page pilier.
 */
import type { ReactNode } from "react";
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
import BadgeJouableAfrique from "@/components/courses/BadgeJouableAfrique";
import {
  isValidDateParam, formatDateLong, formatDateShort,
  isToday, isFuture, todayParis,
} from "@/lib/seo/dates";
import { sortPageQuinte } from "@/lib/seo/programme-fenetre";
import { buildNewsArticleJsonLd } from "@/lib/seo/newsarticle-jsonld";
import { buildSportsEventJsonLd } from "@/lib/seo/sportsevent-jsonld";
import TrackPageView from "@/components/analytics/TrackPageView";
import LeadCaptureCompact from "@/components/leads/LeadCaptureCompact";
import { chargerJourQuinte } from "./donnees";
import { niveauConfiance } from "@/lib/pronostics/confiance";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export default async function VueQuintePlus({
  date,
  pilier = false,
  complement,
}: {
  date: string;
  pilier?: boolean;
  complement?: ReactNode;
}) {
  if (!isValidDateParam(date)) notFound();

  // Aujourd'hui : bypass du cache ISR pour afficher cotes/partants/arrivée
  // dès qu'ils sont sync depuis Geny. Past/futur restent en ISR 600s.
  if (isToday(date)) noStore();

  const today    = todayParis();

  const supabase = createServiceClient();

  const jour = await chargerJourQuinte(date);
  const { data: course, error: courseError } = !jour.quinte
    ? { data: null, error: null }
    : await supabase
    .from("courses")
    .select(`
      id, numero_reunion, numero_course, libelle,
      date_course, heure_depart, distance_metres,
      categorie, terrain, nb_partants, statut, arrivee_officielle,
      paris_disponibles, jouable_afrique, nationale,
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
    .eq("id", jour.quinte.id)
    .maybeSingle();

  const c = course as any;

  // AVANT : 404 pour toute date hors [J-90, J+30], même avec un vrai Quinté+
  // (et page vide en 200 pour les dates futures). Désormais le contenu
  // décide : cf. lib/seo/programme-fenetre.ts. Une requête en échec ne
  // produit jamais de 404 (on retombe sur l'écran « pas de Quinté+ »).
  if (!jour.erreur && !courseError && sortPageQuinte(date, today, !!c, jour.nbCoursesFrance) === "introuvable") notFound();

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
    .or("nationale.eq.1,paris_disponibles.cs.{QUINTE_PLUS}");
  const datesWithQuinte = Array.from(
    new Set((rawDates ?? []).map((r: { date_course: string }) => r.date_course)),
  );

  const dateLong   = formatDateLong(date);
  const dateShort  = formatDateShort(date);
  const today2     = isToday(date);
  const isFut      = isFuture(date);

  // ── Cas pas de Quinté+ trouvé (rare hors lundi/relâche) ──────────
  if (!c) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <PageHero
          image="/images/heroes/hero-pronostics.jpg"
          titre={pilier ? "Pronostic Quinté+ du jour" : `Quinté+ ${today2 ? "du jour" : ""}`}
          sousTitre={dateLong}
        />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <DateRangeNav
            currentDate={date}
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
              {isFut ? "Quinté+ pas encore publié" : jour.nbCoursesFrance > 0 ? `Quinté+ du ${dateShort}` : "Pas de Quinté+ ce jour"}
            </h2>
            <p className="text-text-secondary text-sm mb-6 max-w-md mx-auto">
              {isFut
                ? "Le Quinté+ de cette date sera disponible la veille à 17h45 (publication PMU)."
                : jour.nbCoursesFrance > 0
                  // Un Quinté+ se court chaque jour : s'il manque ici, c'est un
                  // trou de NOS données — on ne prétend pas qu'il n'a pas eu lieu.
                  ? "Le Quinté+ de cette date n'est pas encore rattaché dans nos données. Retrouvez toutes les courses du jour dans le programme."
                  : "Aucune course n'a été désignée Quinté+ pour cette date."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/programme/${date}`} className="px-5 py-2.5 bg-bg-elevated border border-border rounded-xl text-text-secondary text-sm hover:border-gold-primary/40 transition-all">
                Voir le programme du {dateShort}
              </Link>
              <Link href="/quinte-plus" className="px-5 py-2.5 bg-gold-primary text-bg-primary text-sm font-bold rounded-xl">
                Quinté+ du jour
              </Link>
            </div>
          </div>
          {complement && <div className="mt-8 text-left">{complement}</div>}
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
    isFini || date < today || pronosticPublie?.niveau_acces === "GRATUIT";

  // Top 5 partants par cote (favoris)
  const favoris = [...partants]
    .filter((p: any) => p.cote != null && p.cote > 0)
    .sort((a: any, b: any) => (a.cote || 99) - (b.cote || 99))
    .slice(0, 5);

  // ── Schema.org ───────────────────────────────────────────────────
  const urlPage = pilier ? `${APP_URL}/quinte-plus` : `${APP_URL}/quinte-plus/${date}`;
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: pilier
      ? [
          { "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL },
          { "@type": "ListItem", position: 2, name: "Quinté+ du jour", item: `${APP_URL}/quinte-plus` },
        ]
      : [
          { "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL },
          { "@type": "ListItem", position: 2, name: "Quinté+", item: `${APP_URL}/quinte-plus` },
          { "@type": "ListItem", position: 3, name: `Quinté+ ${dateShort}`, item: `${APP_URL}/quinte-plus/${date}` },
        ],
  };

  // NewsArticle JSON-LD : critère Google News + Top Stories carousel.
  const newsArticleLd = buildNewsArticleJsonLd({
    url:           urlPage,
    headline:      `Quinté+ du ${dateLong} : ${c.libelle} (${hippo?.nom})`,
    description:   `Pronostic Quinté+ du ${dateLong}. ${c.libelle} à ${hippo?.nom} : ${c.nb_partants} partants, ${c.distance_metres ? c.distance_metres + "m" : ""} ${c.categorie || ""}. Analyse, partants, arrivée et rapports.`,
    datePublished: today2
      ? new Date().toISOString()
      : `${date}T08:00:00.000Z`,
    dateModified:  new Date().toISOString(),
    image:         `${APP_URL}/images/heroes/hero-pronostics.jpg`,
    keywords:      ["Quinté+", "pronostic Quinté+", "arrivée Quinté+", "rapports Quinté+", hippo?.nom].filter(Boolean) as string[],
    articleSection: "Hippisme — Quinté+",
  });

  // SportsEvent enrichi (champs recommandés Google complets)
  const eventLd = buildSportsEventJsonLd(
    { ...c, hippodrome: hippo },
    { url: urlPage },
  );

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* 📊 Funnel haut : vue de la page vedette (cf lib/analytics/track.ts) */}
      <TrackPageView event="view_vedette" params={{ source: pilier ? "quinte-plus-pilier" : "quinte-plus", date: date }} />
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
        titre={pilier ? "Pronostic Quinté+ du jour" : `Quinté+ ${today2 ? "du jour" : ""}`}
        sousTitre={`${c.libelle} · ${hippo?.nom}`}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Breadcrumb ──────────────────────────────────────────── */}
        <nav className="mb-4 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          {pilier ? (
            <span className="text-text-secondary">Quinté+ du jour</span>
          ) : (
            <>
              <Link href="/quinte-plus" className="hover:text-gold-primary">Quinté+</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-text-secondary">Quinté+ {dateShort}</span>
            </>
          )}
        </nav>

        {/* ── Navigation entre dates (historique des Quinté+) ──────── */}
        <DateRangeNav
          currentDate={date}
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
                <BadgeJouableAfrique course={c} />
              </div>
              <h2 className="font-serif font-bold text-text-primary text-xl sm:text-2xl mb-1">
                {c.libelle}
              </h2>
              <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{hippo?.nom}</span>
                {c.heure_depart && (
                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{c.heure_depart.substring(0, 5)}</span>
                )}
                {/* Ternaire (pas `&&`) : avec `0 && …` React afficherait un « 0 » nu. */}
                {c.distance_metres ? <span>· {c.distance_metres} m</span> : null}
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
              {niveauConfiance(pronosticPublie.confiance) && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded bg-gold-primary/20 text-gold-light font-semibold">
                  Confiance : {niveauConfiance(pronosticPublie.confiance)!.label}
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
                Top 5 favoris (cotes)
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
        {complement}

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
            href={today2 ? "/programme" : `/programme/${date}`}
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
              href={`/arrivees/${date}`}
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
              Les pronostics experts Elite Turf, chaque jour
            </p>
            <p className="text-text-muted text-xs mb-4">
              Publiés avant le départ du Quinté+. Formules dès 65 € (7 jours).
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
