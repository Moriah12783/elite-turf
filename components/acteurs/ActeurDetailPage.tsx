/**
 * Page détail partagée pour /chevaux/[slug], /jockeys/[slug], /entraineurs/[slug].
 *
 * Composant serveur. Reçoit l'entité (déjà fetchée) et son historique.
 * Évite la duplication entre 3 pages quasi-identiques.
 */

import Link from "next/link";
import {
  Trophy, Calendar, ChevronRight, BarChart3, ArrowLeft, MapPin,
} from "lucide-react";
import PageHero from "@/components/layout/PageHero";
import HistoriqueCourses from "./HistoriqueCourses";
import {
  type Entite, type CourseLine, type EntiteType,
  ENTITE_LABEL, tauxVictoire, tauxPlace,
} from "@/lib/seo/acteurs";
import { formatDateLong } from "@/lib/seo/dates";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface Props {
  type:    EntiteType;
  entite:  Entite;
  rows:    CourseLine[];
  /** Image hero locale */
  heroImg: string;
}

export default function ActeurDetailPage({ type, entite, rows, heroImg }: Props) {
  const label   = ENTITE_LABEL[type];
  const tauxVic = tauxVictoire(entite);
  const tauxPlc = tauxPlace(entite);

  // Top hippodromes pour cette entité (5 plus fréquents)
  const hippoCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.hippodrome_nom) {
      hippoCounts.set(r.hippodrome_nom, (hippoCounts.get(r.hippodrome_nom) ?? 0) + 1);
    }
  }
  const topHippos = Array.from(hippoCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Schema.org BreadcrumbList
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL },
      { "@type": "ListItem", position: 2, name: label.plural, item: `${APP_URL}/${type}` },
      { "@type": "ListItem", position: 3, name: entite.nom,  item: `${APP_URL}/${type}/${entite.slug}` },
    ],
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <PageHero
        image={heroImg}
        titre={entite.nom}
        sousTitre={`${label.singular} · ${entite.nb_courses ?? 0} courses enregistrées`}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <nav className="mb-6 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href={`/${type}`} className="hover:text-gold-primary">{label.plural}</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary">{entite.nom}</span>
        </nav>

        {/* ── Stats agrégées ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="card-base p-4">
            <div className="text-text-muted text-xs uppercase tracking-wider mb-1">Courses</div>
            <div className="text-text-primary font-serif text-2xl font-bold">{entite.nb_courses ?? 0}</div>
          </div>
          <div className="card-base p-4">
            <div className="text-text-muted text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Victoires
            </div>
            <div className="text-status-win font-serif text-2xl font-bold">{entite.nb_victoires ?? 0}</div>
            {tauxVic !== null && (
              <div className="text-text-muted text-xs mt-1">{tauxVic.toFixed(1)} %</div>
            )}
          </div>
          <div className="card-base p-4">
            <div className="text-text-muted text-xs uppercase tracking-wider mb-1">Top 3</div>
            <div className="text-gold-primary font-serif text-2xl font-bold">{entite.nb_places ?? 0}</div>
            {tauxPlc !== null && (
              <div className="text-text-muted text-xs mt-1">{tauxPlc.toFixed(1)} %</div>
            )}
          </div>
          <div className="card-base p-4">
            <div className="text-text-muted text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Dernière
            </div>
            <div className="text-text-primary font-serif text-base font-bold">
              {entite.derniere_course_at
                ? formatDateLong(entite.derniere_course_at).replace(/^./, (c) => c.toUpperCase())
                : "—"}
            </div>
          </div>
        </div>

        {/* ── Top hippodromes ─────────────────────────────────────── */}
        {topHippos.length > 0 && (
          <section className="mb-8">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gold-primary" />
              Hippodromes fréquents
            </h2>
            <div className="flex flex-wrap gap-2">
              {topHippos.map(([nom, count]) => (
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

        {/* ── Historique courses ──────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="font-serif font-bold text-text-primary text-lg mb-3 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gold-primary" />
            Historique des courses ({rows.length})
          </h2>
          <HistoriqueCourses
            type={type}
            rows={rows}
            showCheval={type !== "chevaux"}
            showJockey={type !== "jockeys"}
            showEntraineur={type !== "entraineurs"}
          />
        </section>

        <div className="mt-8">
          <Link href={`/${type}`} className="inline-flex items-center gap-2 text-text-muted text-sm hover:text-gold-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Tous les {label.plural.toLowerCase()}
          </Link>
        </div>
      </div>
    </div>
  );
}
