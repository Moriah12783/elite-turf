/**
 * Page détail premium pour /chevaux/[slug], /jockeys/[slug], /entraineurs/[slug].
 *
 * Phase 1 (mai 2026) — refonte complète des fiches acteurs :
 *   - Stats riches calculées à la volée depuis l'historique courses
 *     (corrige le bug "0 victoires" qui touche la BDD `chevaux` actuelle)
 *   - Composants modulaires : CarteIdentite, MusiqueCourse, GraphiqueForme,
 *     PartenairesFrequents
 *   - Future-proof : zones rendues conditionnellement quand les données
 *     Phase 2 (pedigree, propriétaire, gains…) seront peuplées
 *   - JSON-LD enrichi : BreadcrumbList + Person/Animal + FAQPage
 *
 * Composant serveur (RSC). Pas d'interactivité (sauf liens internes).
 */

import Link from "next/link";
import {
  Trophy, Calendar, ChevronRight, BarChart3, ArrowLeft, MapPin,
  Target, TrendingUp, Zap, Award,
} from "lucide-react";
import PageHero from "@/components/layout/PageHero";
import HistoriqueCourses from "./HistoriqueCourses";
import CarteIdentite from "./CarteIdentite";
import MusiqueCourse from "./MusiqueCourse";
import GraphiqueForme from "./GraphiqueForme";
import PartenairesFrequents from "./PartenairesFrequents";
import {
  type Entite, type CourseLine, type EntiteType, type RichStats,
  ENTITE_LABEL, formatSexeCheval,
} from "@/lib/seo/acteurs";
import { formatDateLong } from "@/lib/seo/dates";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface Props {
  type:    EntiteType;
  entite:  Entite;
  rows:    CourseLine[];
  stats:   RichStats;
  /** Image hero locale */
  heroImg: string;
}

/**
 * Sous-titre dynamique du hero : agrège les chiffres clés en 1 ligne lisible.
 * Ex : "Hongre · 11 ans · 50 courses · 5 victoires · 33% top 3"
 */
function buildHeroSousTitre(type: EntiteType, entite: Entite, stats: RichStats): string {
  const parts: string[] = [];

  if (type === "chevaux") {
    if (entite.sexe) parts.push(formatSexeCheval(entite.sexe));
    if (entite.age)  parts.push(`${entite.age} ans`);
  } else {
    parts.push(ENTITE_LABEL[type].singular);
  }

  parts.push(`${stats.nb_courses_terminees} courses`);

  if (stats.nb_victoires > 0) {
    parts.push(`${stats.nb_victoires} victoires`);
  }
  if (stats.taux_place !== null && stats.nb_courses_terminees >= 3) {
    parts.push(`${stats.taux_place.toFixed(0)}% top 3`);
  }

  return parts.join(" · ");
}

/**
 * JSON-LD Schema.org enrichi.
 * Pour chevaux : on utilise un Thing custom (Schema.org Animal existe mais
 * peu reconnu en SERP, Thing est plus universel).
 * Pour jockeys/entraineurs : Person.
 */
function buildJsonLd(type: EntiteType, entite: Entite, stats: RichStats) {
  const url = `${APP_URL}/${type}/${entite.slug}`;
  const label = ENTITE_LABEL[type];

  // ── BreadcrumbList ──
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",     item: APP_URL },
      { "@type": "ListItem", position: 2, name: label.plural,  item: `${APP_URL}/${type}` },
      { "@type": "ListItem", position: 3, name: entite.nom,    item: url },
    ],
  };

  // ── Entité elle-même (Person ou Animal/Thing) ──
  let entityLd: Record<string, unknown>;
  if (type === "chevaux") {
    entityLd = {
      "@context":   "https://schema.org",
      "@type":      "Thing",
      "@id":        url,
      name:         entite.nom,
      url,
      description:  `Cheval de course PMU : ${stats.nb_courses_terminees} courses, ${stats.nb_victoires} victoires, ${stats.nb_places} top 3.`,
      ...(entite.sexe && { additionalType: formatSexeCheval(entite.sexe) }),
    };
  } else {
    entityLd = {
      "@context": "https://schema.org",
      "@type":    "Person",
      "@id":      url,
      name:       entite.nom,
      url,
      jobTitle:   label.singular,
      description: `${label.singular} PMU : ${stats.nb_courses_terminees} courses, ${stats.nb_victoires} victoires (${(stats.taux_victoire ?? 0).toFixed(1)}%).`,
    };
  }

  // ── FAQPage : 3-4 questions/réponses générées depuis les stats ──
  const faqItems: Array<{ q: string; a: string }> = [];

  if (stats.nb_courses_terminees > 0) {
    faqItems.push({
      q: `Combien de courses ${entite.nom} a-t-il${type === "chevaux" ? "" : "/elle"} couru ?`,
      a: `${entite.nom} a participé à ${stats.nb_courses_terminees} courses enregistrées sur Elite Turf, avec ${stats.nb_victoires} victoires et ${stats.nb_places} places dans le top 3.`,
    });
  }
  if (stats.taux_victoire !== null && stats.nb_courses_terminees >= 3) {
    faqItems.push({
      q: `Quel est le taux de victoire de ${entite.nom} ?`,
      a: `Le taux de victoire de ${entite.nom} est de ${stats.taux_victoire.toFixed(1)}% sur ${stats.nb_courses_terminees} courses, soit ${stats.nb_victoires} victoires.`,
    });
  }
  if (stats.hippodromes_freq.length > 0) {
    const topH = stats.hippodromes_freq[0][0];
    faqItems.push({
      q: `Sur quel hippodrome ${entite.nom} court-il${type === "chevaux" ? "" : "/elle"} le plus ?`,
      a: `${entite.nom} se présente le plus souvent sur l'hippodrome de ${topH} (${stats.hippodromes_freq[0][1]} courses recensées).`,
    });
  }
  if (stats.musique_textuelle) {
    faqItems.push({
      q: `Quelle est la musique récente de ${entite.nom} ?`,
      a: `Musique des dernières courses : ${stats.musique_textuelle}.`,
    });
  }

  const faqLd = faqItems.length > 0 ? {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: faqItems.map((it) => ({
      "@type": "Question",
      name:    it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  } : null;

  return { breadcrumb, entityLd, faqLd };
}

/** Carte stat compacte réutilisable. */
function StatCard({
  icon: Icon, label, value, sub, accentColor,
}: {
  icon:        React.ElementType;
  label:       string;
  value:       string | number;
  sub?:        string;
  accentColor?: "win" | "gold" | "blue" | "default";
}) {
  const valueClass = accentColor === "win"
    ? "text-status-win"
    : accentColor === "gold"
    ? "text-gold-primary"
    : accentColor === "blue"
    ? "text-blue-300"
    : "text-text-primary";

  return (
    <div className="card-base p-4">
      <div className="text-text-muted text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={`font-serif text-2xl font-bold ${valueClass}`}>{value}</div>
      {sub && <div className="text-text-muted text-xs mt-1">{sub}</div>}
    </div>
  );
}

export default function ActeurDetailPage({ type, entite, rows, stats, heroImg }: Props) {
  const label = ENTITE_LABEL[type];
  const sousTitre = buildHeroSousTitre(type, entite, stats);
  const { breadcrumb, entityLd, faqLd } = buildJsonLd(type, entite, stats);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* ── JSON-LD ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(entityLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}

      <PageHero
        image={heroImg}
        titre={entite.nom}
        sousTitre={sousTitre}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        <nav className="flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href={`/${type}`} className="hover:text-gold-primary">{label.plural}</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary">{entite.nom}</span>
        </nav>

        {/* ── Stats principales (4 cards) ─────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={BarChart3}
            label="Courses"
            value={stats.nb_courses_terminees}
            sub={stats.nb_courses > stats.nb_courses_terminees
              ? `+ ${stats.nb_courses - stats.nb_courses_terminees} à venir`
              : undefined}
          />
          <StatCard
            icon={Trophy}
            label="Victoires"
            value={stats.nb_victoires}
            sub={stats.taux_victoire !== null ? `${stats.taux_victoire.toFixed(1)} %` : undefined}
            accentColor="win"
          />
          <StatCard
            icon={Award}
            label="Top 3"
            value={stats.nb_places}
            sub={stats.taux_place !== null ? `${stats.taux_place.toFixed(1)} %` : undefined}
            accentColor="gold"
          />
          <StatCard
            icon={Calendar}
            label="Dernière"
            value={entite.derniere_course_at
              ? formatDateLong(entite.derniere_course_at).replace(/^./, (c) => c.toUpperCase())
              : "—"}
            sub={stats.jours_derniere_course !== null && stats.jours_derniere_course > 0
              ? `il y a ${stats.jours_derniere_course} j`
              : undefined}
          />
        </div>

        {/* ── Stats secondaires ────────────────────────────────────── */}
        {(stats.nb_courses_terminees >= 3 || stats.cote_moyenne !== null) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.taux_top5 !== null && (
              <StatCard
                icon={Target}
                label="Top 5"
                value={`${stats.taux_top5.toFixed(0)}%`}
                sub={`${stats.nb_top5} courses`}
                accentColor="blue"
              />
            )}
            {stats.cote_moyenne !== null && (
              <StatCard
                icon={TrendingUp}
                label="Cote moy."
                value={stats.cote_moyenne.toFixed(1)}
                sub={stats.cote_min !== null && stats.cote_max !== null
                  ? `${stats.cote_min.toFixed(1)} – ${stats.cote_max.toFixed(1)}`
                  : undefined}
              />
            )}
            {stats.tendance_90j.courses > 0 && (
              <StatCard
                icon={Zap}
                label="90 jours"
                value={`${stats.tendance_90j.courses}c`}
                sub={`${stats.tendance_90j.victoires}V · ${stats.tendance_90j.places} top 3`}
              />
            )}
            {stats.meilleur_resultat !== null && (
              <StatCard
                icon={Trophy}
                label="Meilleur"
                value={stats.meilleur_resultat === 1
                  ? "1ᵉʳ"
                  : `${stats.meilleur_resultat}ᵉ`}
                sub="position record"
                accentColor={stats.meilleur_resultat === 1 ? "win" : "gold"}
              />
            )}
          </div>
        )}

        {/* ── Carte d'identité ────────────────────────────────────── */}
        <CarteIdentite type={type} entite={entite} stats={stats} />

        {/* ── Musique + Graphique de forme côte-à-côte ─────────────── */}
        {stats.nb_courses_terminees > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MusiqueCourse rows={rows} limit={10} />
            <GraphiqueForme forme={stats.forme_recente} />
          </div>
        )}

        {/* ── Top hippodromes ─────────────────────────────────────── */}
        {stats.hippodromes_freq.length > 0 && (
          <section className="card-base p-5 sm:p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gold-primary" />
              Hippodromes fréquents
              <span className="text-text-muted text-xs font-normal normal-case ml-1">
                — {stats.hippodromes_freq.length}
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {stats.hippodromes_freq.map(([nom, count]) => (
                <span
                  key={nom}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-elevated border border-border text-text-secondary text-xs"
                >
                  <span className="font-medium">{nom}</span>
                  <span className="text-text-muted">·</span>
                  <span className="text-gold-primary font-mono font-bold">{count}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Partenaires fréquents (jockeys pour cheval, chevaux pour jockey/entr.) ── */}
        <PartenairesFrequents type={type} partenaires={stats.partenaires_freq} />

        {/* ── Historique détaillé ─────────────────────────────────── */}
        <section>
          <h2 className="font-serif font-bold text-text-primary text-lg mb-3 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gold-primary" />
            Historique des courses
            <span className="text-text-muted text-xs font-normal normal-case ml-1">
              — {rows.length}
            </span>
          </h2>
          <HistoriqueCourses
            type={type}
            rows={rows}
            showCheval={type !== "chevaux"}
            showJockey={type !== "jockeys"}
            showEntraineur={type !== "entraineurs"}
          />
        </section>

        <div className="pt-4">
          <Link
            href={`/${type}`}
            className="inline-flex items-center gap-2 text-text-muted text-sm hover:text-gold-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Tous les {label.plural.toLowerCase()}
          </Link>
        </div>
      </div>
    </div>
  );
}
