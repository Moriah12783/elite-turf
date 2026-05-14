/**
 * components/courses/TabStatsRich.tsx
 *
 * Section "Statistiques" enrichie d'une page course détail.
 * Affiche des KPIs RÉELS calculés à partir du croisement partants × tables
 * historiques (chevaux/jockeys/entraineurs) — peuplées par lib/sync/seo-etl.ts.
 *
 * Sections :
 *   A. Quinté probable     — top 5 par score composite multifactoriel
 *   B. Vedettes du field   — chevaux avec >25% taux victoire historique
 *   C. Outsiders / Value bets — cote ≥ 8 ET taux ≥ 15%
 *   D. Acteurs en forme    — top jockeys + entraineurs du field
 *   E. Forme récente musique — top par ratio top-3 dans la musique (existant)
 *   F. CTA subtil          — vers /pronostics si pronostic publié, sinon /abonnements
 *
 * Toutes les stats portent un libellé "Calculé sur N courses BDD" pour montrer
 * la rigueur du calcul (signal de sérieux pour conversion abonnement).
 */

"use client";

import Link from "next/link";
import {
  BarChart3, TrendingUp, Star, Trophy, Zap,
  Crown, Diamond, Flame, Info, Users, Award,
} from "lucide-react";
import type { CourseStatsEnrichies, PartantEnrichi, StatsHistoriques } from "@/lib/courses/stats-types";
import { MIN_COURSES_FIABLES } from "@/lib/courses/stats-types";

interface Props {
  stats:               CourseStatsEnrichies;
  hasPublishedPronostic: boolean;
  isSubscribed:        boolean;
  courseStatut:        string;
}

// ── Helpers visuels ────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || isNaN(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

function rankColor(rank: number): string {
  if (rank === 0) return "bg-status-win/20 border-status-win/40 text-status-win";
  if (rank === 1) return "bg-gold-faint border-gold-primary/40 text-gold-light";
  if (rank === 2) return "bg-orange-500/15 border-orange-500/40 text-orange-400";
  return "bg-bg-elevated border-border text-text-muted";
}

function coteColor(cote: number | null | undefined): string {
  if (!cote) return "text-text-muted";
  if (cote <= 3) return "text-status-win font-bold";
  if (cote <= 7) return "text-gold-light font-semibold";
  return "text-text-secondary";
}

// ── Sous-composants ────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="p-8 text-center">
      <BarChart3 className="w-8 h-8 text-text-muted mx-auto mb-3" />
      <p className="text-text-muted text-sm">
        Statistiques disponibles après la publication des partants
      </p>
    </div>
  );
}

/** Petit label "🛈 Calculé sur N courses BDD" — signal de transparence. */
function StatBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
      <Info className="w-2.5 h-2.5" />
      {n} {n > 1 ? "courses" : "course"} BDD
    </span>
  );
}

// ── Section A : Quinté probable (top 5 score composite) ───────────────────

function SectionQuinteProbable({ items }: { items: PartantEnrichi[] }) {
  if (items.length === 0) return null;

  return (
    <div className="p-4">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <p className="text-text-muted text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
            <Crown className="w-3.5 h-3.5 text-gold-primary" />
            Quinté probable — score composite
          </p>
          <p className="text-text-muted text-[10px] mt-0.5">
            Calculé sur 4 facteurs : cote, victoires historiques, forme récente, jockey
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((p, i) => {
          const scorePct = Math.round(p.score_composite * 100);
          return (
            <div
              key={p.id}
              className={`relative p-3 rounded-xl border ${
                i === 0
                  ? "bg-gradient-to-r from-gold-faint/40 to-bg-elevated border-gold-primary/40"
                  : "bg-bg-elevated/50 border-border/50"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Rang */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${rankColor(i)}`}>
                    {i + 1}
                  </span>
                </div>

                {/* Numéro + Cheval */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-text-muted text-xs font-mono">#{p.numero}</span>
                    <p className="text-text-primary text-sm font-semibold truncate">
                      {p.nom_cheval}
                    </p>
                    {p.badges.favori && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-status-win/15 text-status-win border border-status-win/30 font-bold uppercase">Favori</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-[11px]">
                    <span className={coteColor(p.cote)}>
                      Cote {p.cote ? p.cote.toFixed(1) : "—"}
                    </span>
                    {p.stats_cheval && p.stats_cheval.nb_courses >= MIN_COURSES_FIABLES && (
                      <span className="text-text-secondary">
                        Victoires : <span className="text-gold-light font-semibold">{fmtPct(p.stats_cheval.taux_victoire)}</span>
                      </span>
                    )}
                    {p.forme_musique && p.forme_musique.courses > 0 && (
                      <span className="text-text-secondary">
                        Forme : <span className="text-gold-light font-semibold">{p.forme_musique.top3}/{p.forme_musique.courses}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className={`text-lg font-bold leading-none ${i === 0 ? "text-gold-light" : "text-text-primary"}`}>
                    {scorePct}
                  </span>
                  <span className="text-text-muted text-[9px] uppercase tracking-wide">score</span>
                </div>
              </div>

              {/* Barre score */}
              <div className="mt-2 h-1 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    i === 0 ? "bg-gradient-to-r from-gold-primary to-gold-light"
                            : "bg-gold-primary/50"
                  }`}
                  style={{ width: `${Math.min(100, scorePct)}%` }}
                />
              </div>

              {/* Mini breakdown (1er seulement, pour pas surcharger) */}
              {i === 0 && (
                <div className="mt-2 grid grid-cols-4 gap-1 text-[9px]">
                  {[
                    { label: "Cote",     v: p.score_breakdown.cote,           max: 0.35 },
                    { label: "Vict.",    v: p.score_breakdown.vict_cheval,    max: 0.30 },
                    { label: "Forme",    v: p.score_breakdown.forme_musique,  max: 0.20 },
                    { label: "Jockey",   v: p.score_breakdown.vict_jockey,    max: 0.15 },
                  ].map((b) => (
                    <div key={b.label} className="bg-bg-elevated/60 rounded px-1.5 py-1 text-center border border-border/30">
                      <p className="text-text-muted">{b.label}</p>
                      <p className="text-gold-light font-bold">{Math.round((b.v / b.max) * 100)}%</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section B : Vedettes du field ─────────────────────────────────────────

function SectionVedettes({ items }: { items: PartantEnrichi[] }) {
  if (items.length === 0) return null;

  return (
    <div className="p-4">
      <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
        <Star className="w-3.5 h-3.5 text-gold-primary" fill="currentColor" />
        Vedettes du field
        <span className="text-[10px] font-normal normal-case text-text-muted">— taux victoire ≥ 25% sur ≥ {MIN_COURSES_FIABLES} courses</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {items.map((p) => (
          <div key={p.id} className="p-3 rounded-xl bg-gradient-to-br from-gold-faint/40 to-bg-elevated border border-gold-primary/40">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-7 h-7 rounded-full bg-gold-faint border border-gold-primary/40 text-gold-light flex items-center justify-center text-xs font-bold flex-shrink-0">
                {p.numero}
              </span>
              <p className="text-text-primary text-sm font-semibold truncate">{p.nom_cheval}</p>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-gold-light text-xl font-bold leading-none">
                  {fmtPct(p.stats_cheval?.taux_victoire, 0)}
                </p>
                <p className="text-text-muted text-[10px] mt-0.5">de victoires</p>
              </div>
              {p.stats_cheval && (
                <StatBadge n={p.stats_cheval.nb_courses} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section C : Outsiders / Value bets ───────────────────────────────────

function SectionValueBets({ items }: { items: PartantEnrichi[] }) {
  if (items.length === 0) return null;

  return (
    <div className="p-4">
      <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
        <Diamond className="w-3.5 h-3.5 text-blue-400" />
        Outsiders à surveiller
        <span className="text-[10px] font-normal normal-case text-text-muted">— cote ≥ 8 mais ≥ 15% de victoires</span>
      </p>
      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.id} className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {p.numero}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-sm font-semibold truncate">{p.nom_cheval}</p>
              <p className="text-text-muted text-xs">
                Cote <span className={coteColor(p.cote)}>{p.cote?.toFixed(1)}</span>
                {" · "}
                <span className="text-blue-400 font-semibold">
                  {fmtPct(p.stats_cheval?.taux_victoire, 0)}
                </span>{" "}
                de victoires sur {p.stats_cheval?.nb_courses} courses
              </p>
            </div>
            <span className="text-[10px] px-1.5 py-1 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 font-bold uppercase flex items-center gap-1 flex-shrink-0">
              <Diamond className="w-2.5 h-2.5" /> Value
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section D : Top jockeys & entraineurs ───────────────────────────────

function ActeursCard({
  title, icon: Icon, items, type,
}: {
  title: string;
  icon: any;
  items: Array<StatsHistoriques & { nom: string }>;
  type: "jockeys" | "entraineurs";
}) {
  if (items.length === 0) return null;
  return (
    <div className="p-3 rounded-xl bg-bg-elevated/50 border border-border/50">
      <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-gold-primary" />
        {title}
      </p>
      <div className="space-y-1.5">
        {items.map((a, i) => {
          // ── SEO : pas de lien vers les acteurs noindex (thin content) ─────
          // Les pages /jockeys/[slug] et /entraineurs/[slug] mettent noindex
          // pour les acteurs avec <3 courses (anti "Page en double sans URL
          // canonique sélectionnée" de GSC). On évite donc de les linker depuis
          // les pages de courses — Google gaspillait du crawl budget sur 144
          // pages noindex (diagnostic SEO du 14/05/2026).
          const isIndexable = (a.nb_courses ?? 0) >= 3 && Boolean(a.slug);
          return (
            <div key={a.slug || `noslug-${i}`} className="flex items-center gap-2">
              <span className="w-5 text-center text-text-muted text-[10px] font-mono">{i + 1}.</span>
              {isIndexable ? (
                <Link
                  href={`/${type}/${a.slug}`}
                  className="flex-1 text-text-primary text-xs font-medium hover:text-gold-light transition-colors truncate"
                >
                  {a.nom}
                </Link>
              ) : (
                <span
                  className="flex-1 text-text-primary text-xs font-medium truncate"
                  title="Acteur sans historique suffisant"
                >
                  {a.nom}
                </span>
              )}
              <span className="text-gold-light text-xs font-bold flex-shrink-0">
                {fmtPct(a.taux_victoire, 0)}
              </span>
              <span className="text-text-muted text-[9px] flex-shrink-0 w-12 text-right">
                {a.nb_courses} c.
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionActeurs({
  jockeys, entraineurs,
}: {
  jockeys:     Array<StatsHistoriques & { nom: string }>;
  entraineurs: Array<StatsHistoriques & { nom: string }>;
}) {
  if (jockeys.length === 0 && entraineurs.length === 0) return null;

  return (
    <div className="p-4">
      <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
        <Award className="w-3.5 h-3.5 text-gold-primary" />
        Acteurs en forme
        <span className="text-[10px] font-normal normal-case text-text-muted">— classement par taux victoire historique</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ActeursCard title="Jockeys"     icon={Users}  items={jockeys}     type="jockeys" />
        <ActeursCard title="Entraîneurs" icon={Trophy} items={entraineurs} type="entraineurs" />
      </div>
    </div>
  );
}

// ── Section E : Forme récente musique (préserve la section historique) ───

function SectionFormeMusique({ items }: { items: PartantEnrichi[] }) {
  const withMusique = items
    .filter((p) => p.forme_musique && p.forme_musique.courses >= 3)
    .sort((a, b) => (b.forme_musique?.ratio ?? 0) - (a.forme_musique?.ratio ?? 0))
    .slice(0, 5);

  if (withMusique.length === 0) return null;

  return (
    <div className="p-4">
      <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
        <Flame className="w-3.5 h-3.5 text-gold-primary" />
        Meilleure forme récente
        <span className="text-[10px] font-normal normal-case text-text-muted">— ratio top-3 sur la musique PMU</span>
      </p>
      <div className="space-y-2">
        {withMusique.map((p) => {
          const fm = p.forme_musique!;
          const pct = Math.round(fm.ratio * 100);
          return (
            <div key={p.id} className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                fm.ratio >= 0.5 ? "bg-status-win/20 border border-status-win/40 text-status-win" :
                fm.ratio >= 0.3 ? "bg-gold-faint border border-gold-primary/40 text-gold-light" :
                "bg-bg-elevated border border-border text-text-muted"
              }`}>
                {p.numero}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-text-primary text-sm font-medium truncate">{p.nom_cheval}</p>
                  <span className="text-text-muted text-xs flex-shrink-0">{fm.top3}/{fm.courses} top-3</span>
                </div>
                <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      fm.ratio >= 0.5 ? "bg-status-win" :
                      fm.ratio >= 0.3 ? "bg-gold-primary" : "bg-border"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className={`text-xs font-bold flex-shrink-0 ${
                fm.ratio >= 0.5 ? "text-status-win" :
                fm.ratio >= 0.3 ? "text-gold-light" : "text-text-muted"
              }`}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section F : CTA subtil conversion ────────────────────────────────────

function CtaConversion({ hasPronostic, isSubscribed, courseStatut }: {
  hasPronostic: boolean;
  isSubscribed: boolean;
  courseStatut: string;
}) {
  // Pas de CTA pour les abonnés ni pour les courses terminées
  if (isSubscribed || courseStatut === "TERMINE") return null;

  if (hasPronostic) {
    return (
      <div className="p-4">
        <div className="rounded-xl bg-gradient-to-r from-gold-faint/40 to-bg-elevated border border-gold-primary/30 px-4 py-3 flex items-center gap-3">
          <Zap className="w-4 h-4 text-gold-primary flex-shrink-0" fill="currentColor" />
          <div className="flex-1 min-w-0">
            <p className="text-text-primary text-xs font-semibold">
              Notre pronostic est-il aligné avec ces stats ?
            </p>
            <p className="text-text-muted text-[11px] mt-0.5">
              Découvrez l'analyse complète des experts Elite Turf.
            </p>
          </div>
          <Link
            href="/abonnements"
            className="text-xs font-bold text-gold-light hover:text-gold-primary transition-colors whitespace-nowrap"
          >
            Voir →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="rounded-xl bg-bg-elevated/60 border border-border/50 px-4 py-3 text-center">
        <p className="text-text-muted text-[11px]">
          Stats publiques · Pronostic expert publié avant le départ
        </p>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────

export default function TabStatsRich({
  stats, hasPublishedPronostic, isSubscribed, courseStatut,
}: Props) {
  if (stats.partants.length === 0) return <EmptyState />;

  const hasAnyHistorique =
    stats.meta.chevaux_avec_stats > 0 ||
    stats.meta.jockeys_avec_stats > 0 ||
    stats.meta.entraineurs_avec_stats > 0;

  return (
    <div className="divide-y divide-border/30">
      {/* Section A : Quinté probable */}
      <SectionQuinteProbable items={stats.quinte_probable} />

      {/* Section B : Vedettes (si on en a) */}
      <SectionVedettes items={stats.vedettes} />

      {/* Section C : Value bets */}
      <SectionValueBets items={stats.value_bets} />

      {/* Section D : Top jockeys & entraineurs */}
      <SectionActeurs jockeys={stats.top_jockeys} entraineurs={stats.top_entraineurs} />

      {/* Section E : Forme musique */}
      <SectionFormeMusique items={stats.partants} />

      {/* Résumé data quality (signal sérieux) */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="p-2.5 bg-bg-elevated rounded-xl border border-border/50 text-center">
            <p className="text-text-primary font-bold text-base sm:text-lg leading-none">
              {stats.meta.chevaux_avec_stats}
            </p>
            <p className="text-text-muted text-[10px] mt-1">chevaux profilés</p>
          </div>
          <div className="p-2.5 bg-bg-elevated rounded-xl border border-border/50 text-center">
            <p className="text-text-primary font-bold text-base sm:text-lg leading-none">
              {stats.meta.jockeys_avec_stats}
            </p>
            <p className="text-text-muted text-[10px] mt-1">jockeys connus</p>
          </div>
          <div className="p-2.5 bg-bg-elevated rounded-xl border border-border/50 text-center">
            <p className="text-text-primary font-bold text-base sm:text-lg leading-none">
              {stats.meta.entraineurs_avec_stats}
            </p>
            <p className="text-text-muted text-[10px] mt-1">entraîneurs connus</p>
          </div>
        </div>
        {!hasAnyHistorique && (
          <p className="text-text-muted text-[10px] mt-3 text-center italic">
            Stats historiques en cours de constitution pour ce field. Les profils se précisent à chaque course.
          </p>
        )}
      </div>

      {/* CTA conversion */}
      <CtaConversion
        hasPronostic={hasPublishedPronostic}
        isSubscribed={isSubscribed}
        courseStatut={courseStatut}
      />
    </div>
  );
}
