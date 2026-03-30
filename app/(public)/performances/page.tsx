import { Suspense } from "react";
import type { ElementType } from "react";
import { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp, Award, Flame, CheckCircle2, XCircle,
  Minus, Clock3, Star, Zap, BarChart3, Trophy,
  ArrowRight, Calendar, ExternalLink
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { BET_TYPE_LABELS } from "@/types";
import type { BetType, PronosticResult } from "@/types";
import MonthlyChart from "@/components/performances/MonthlyChart";
import AnimatedCounter from "@/components/performances/AnimatedCounter";
import PageHero from "@/components/layout/PageHero";
import { buildGenyUrlAuto } from "@/lib/geny";

export const metadata: Metadata = {
  title: "Nos Résultats Prouvés — Elite Turf",
  description:
    "Transparence totale : consultez l'historique complet de nos pronostics, notre taux de réussite et nos statistiques par type de pari.",
};

export const dynamic = "force-dynamic";

// ── helpers ───────────────────────────────────────────────────────────
const MOIS_LABELS = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];

const RESULTAT_CONFIG: Record<PronosticResult, { label: string; icon: ElementType; classes: string }> = {
  GAGNANT:    { label: "Gagnant",  icon: CheckCircle2, classes: "text-status-win bg-status-win/10 border-status-win/20" },
  PERDANT:    { label: "Perdant",  icon: XCircle,      classes: "text-status-loss bg-status-loss/10 border-status-loss/20" },
  PARTIEL:    { label: "Partiel",  icon: Minus,        classes: "text-status-partial bg-status-partial/10 border-status-partial/20" },
  EN_ATTENTE: { label: "En cours", icon: Clock3,       classes: "text-text-muted bg-bg-elevated border-border" },
};

function winRate(items: any[]): number {
  const done = items.filter(p => p.resultat !== "EN_ATTENTE");
  if (!done.length) return 0;
  return Math.round(items.filter(p => p.resultat === "GAGNANT").length / done.length * 100);
}

export default async function PerformancesPage() {
  const supabase = createServiceClient();

  // ── Tous les pronostics publiés ──────────────────────────────────
  const { data: allPronostics } = await supabase
    .from("pronostics")
    .select(`
      id, type_pari, resultat, niveau_acces,
      date_publication, nb_vues, selection,
      arrivee_reelle, rapport_gagnant, lien_geny,
      course:courses(
        libelle, date_course, heure_depart,
        numero_reunion, numero_course,
        hippodrome:hippodromes(nom, pays)
      )
    `)
    .eq("publie", true)
    .order("date_publication", { ascending: false });

  const pronostics = allPronostics || [];

  // ── Stats globales ───────────────────────────────────────────────
  const termines   = pronostics.filter(p => p.resultat !== "EN_ATTENTE");
  const gagnants   = pronostics.filter(p => p.resultat === "GAGNANT");
  const perdants   = pronostics.filter(p => p.resultat === "PERDANT");
  const partiels   = pronostics.filter(p => p.resultat === "PARTIEL");
  const tauxGlobal = winRate(pronostics);

  // Série actuelle de gagnants consécutifs
  let serieActuelle = 0;
  for (const p of pronostics) {
    if (p.resultat === "GAGNANT") serieActuelle++;
    else if (p.resultat !== "EN_ATTENTE") break;
  }

  // ── Stats du mois en cours ───────────────────────────────────────
  const now       = new Date();
  const moisDebut = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const pronoMois = pronostics.filter(p => p.date_publication && p.date_publication >= moisDebut);
  const tauxMois  = winRate(pronoMois);

  // ── Graphique mensuel (12 derniers mois) ─────────────────────────
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d     = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const debut = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const fin   = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString();
    const items = pronostics.filter(p =>
      p.date_publication &&
      p.date_publication >= debut &&
      p.date_publication <= fin
    );
    const g = items.filter(p => p.resultat === "GAGNANT").length;
    const t = items.filter(p => p.resultat !== "EN_ATTENTE").length;
    return {
      mois:      MOIS_LABELS[d.getMonth()],
      taux:      t > 0 ? Math.round(g / t * 100) : 0,
      gagnants:  g,
      total:     t,
    };
  });

  // ── Stats 30 derniers jours ─────────────────────────────────────
  const date30ago  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const prono30j   = pronostics.filter(p => p.date_publication && p.date_publication >= date30ago);
  const quintes30j = prono30j.filter(p => p.type_pari === "QUINTE_PLUS" && p.resultat === "GAGNANT").length;
  const quartes30j = prono30j.filter(p => (p.type_pari === "QUARTE" || p.type_pari === "QUARTE_PLUS") && p.resultat === "GAGNANT").length;
  const tierces30j = prono30j.filter(p => p.type_pari === "TIERCE" && p.resultat === "GAGNANT").length;
  const gains30j   = prono30j.reduce((acc: number, p: any) => acc + (p.rapport_gagnant || 0), 0);

  // ── Stats par type de pari ───────────────────────────────────────
  const types = Array.from(new Set(pronostics.map((p: any) => p.type_pari))) as BetType[];
  const statsByType = types.map(type => {
    const items = pronostics.filter((p: any) => p.type_pari === type);
    const done  = items.filter((p: any) => p.resultat !== "EN_ATTENTE");
    const wins  = items.filter((p: any) => p.resultat === "GAGNANT");
    return {
      type,
      label:  BET_TYPE_LABELS[type] || type,
      total:  done.length,
      wins:   wins.length,
      taux:   done.length > 0 ? Math.round(wins.length / done.length * 100) : 0,
    };
  }).sort((a, b) => b.taux - a.taux);

  // ── Stats par hippodrome ─────────────────────────────────────────
  const hippoMap: Record<string, { total: number; wins: number }> = {};
  for (const p of pronostics) {
    const hippo = (p.course as any)?.hippodrome?.nom || "Autre";
    if (!hippoMap[hippo]) hippoMap[hippo] = { total: 0, wins: 0 };
    if (p.resultat !== "EN_ATTENTE") hippoMap[hippo].total++;
    if (p.resultat === "GAGNANT")    hippoMap[hippo].wins++;
  }
  const statsByHippo = Object.entries(hippoMap)
    .map(([nom, s]) => ({ nom, ...s, taux: s.total > 0 ? Math.round(s.wins / s.total * 100) : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // ── Historique récent (30 derniers) ──────────────────────────────
  const recent = pronostics.slice(0, 30);

  return (
    <div className="min-h-screen bg-bg-primary">

      <PageHero
        image="/images/heroes/hero-performances.jpg"
        titre="Nos Performances"
        sousTitre="Transparence totale — historique complet et vérifiable de nos pronostics gagnants"
      />

      {/* ── BANDEAU 30 JOURS ─────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-bg-elevated via-gold-faint/40 to-bg-elevated border-y border-gold-primary/20 py-3 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-6 flex-wrap text-center">
          <span className="text-text-muted text-xs font-semibold uppercase tracking-wider">📊 30 derniers jours</span>
          {quintes30j > 0 && <span className="text-status-win font-bold text-sm">✓ {quintes30j} Quinté+ gagné{quintes30j > 1 ? "s" : ""}</span>}
          {quartes30j > 0 && <span className="text-gold-light font-bold text-sm">✓ {quartes30j} Quarté+ gagné{quartes30j > 1 ? "s" : ""}</span>}
          {tierces30j > 0 && <span className="text-text-secondary font-bold text-sm">✓ {tierces30j} Tiercé{tierces30j > 1 ? "s" : ""} gagné{tierces30j > 1 ? "s" : ""}</span>}
          {gains30j > 0 && <span className="text-gold-primary font-bold text-sm">💰 +{gains30j.toFixed(0)}€ de rapports cumulés</span>}
          <a href="https://www.geny.com/resultats-pmu" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-gold-primary text-xs underline-offset-2 hover:underline">
            <ExternalLink className="w-3 h-3" />Vérifier sur Geny Courses
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

        {/* ── KPI CARDS ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              icon: Award,
              value: tauxGlobal,
              suffix: "%",
              label: "Taux de réussite",
              sub: `${termines.length} pronostics`,
              color: "text-status-win",
              bg: "bg-status-win/8 border-status-win/20",
            },
            {
              icon: TrendingUp,
              value: tauxMois,
              suffix: "%",
              label: "Ce mois",
              sub: `${pronoMois.length} publiés`,
              color: "text-gold-primary",
              bg: "bg-gold-faint border-gold-primary/20",
            },
            {
              icon: Flame,
              value: serieActuelle,
              suffix: "",
              label: "Série en cours",
              sub: "gagnants consécutifs",
              color: "text-gold-primary",
              bg: "bg-gold-faint border-gold-primary/20",
            },
            {
              icon: Trophy,
              value: gagnants.length,
              suffix: "",
              label: "Total gagnants",
              sub: `sur ${termines.length} terminés`,
              color: "text-status-win",
              bg: "bg-status-win/8 border-status-win/20",
            },
          ].map((stat, i) => (
            <div key={i} className={`card-base p-5 border ${stat.bg}`}>
              <div className={`w-10 h-10 rounded-xl ${stat.bg} border flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <Suspense fallback={<span className="text-3xl font-bold font-serif text-text-primary">{stat.value}{stat.suffix}</span>}>
                <AnimatedCounter
                  value={stat.value}
                  suffix={stat.suffix}
                  className={`text-3xl font-bold font-serif ${stat.color} block`}
                />
              </Suspense>
              <p className="text-text-primary text-sm font-medium mt-1">{stat.label}</p>
              <p className="text-text-muted text-xs mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* ── GRAPHIQUE MENSUEL ──────────────────────────────────── */}
        <div className="card-base p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-serif font-bold text-text-primary text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-gold-primary" />
                Performance Mensuelle
              </h2>
              <p className="text-text-muted text-xs mt-1">Taux de réussite sur les 6 derniers mois</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-gold-primary text-2xl font-bold font-serif">{tauxGlobal}%</p>
              <p className="text-text-muted text-xs">moyenne globale</p>
            </div>
          </div>
          <Suspense fallback={<div className="h-48 bg-bg-elevated rounded-xl animate-pulse" />}>
            <MonthlyChart data={monthlyData} />
          </Suspense>
        </div>

        {/* ── STATS PAR TYPE + PAR HIPPODROME ────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Par type */}
          <div className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-base mb-5 flex items-center gap-2">
              <Star className="w-4 h-4 text-gold-primary" fill="currentColor" />
              Par type de pari
            </h2>
            {statsByType.length > 0 ? (
              <div className="space-y-4">
                {statsByType.map((s) => (
                  <div key={s.type}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-text-secondary text-sm font-medium">{s.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-text-muted text-xs">{s.wins}/{s.total}</span>
                        <span className={`font-bold text-sm ${s.taux >= 50 ? "text-status-win" : s.taux >= 35 ? "text-gold-primary" : "text-text-muted"}`}>
                          {s.taux}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${s.taux}%`,
                          background: s.taux >= 50
                            ? "linear-gradient(90deg, #16A34A, #22C55E)"
                            : s.taux >= 35
                            ? "linear-gradient(90deg, #A07830, #C9A84C)"
                            : "#3A3A50",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-sm text-center py-6">
                Données disponibles après publication des premiers pronostics
              </p>
            )}
          </div>

          {/* Par hippodrome */}
          <div className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-base mb-5 flex items-center gap-2">
              <Award className="w-4 h-4 text-gold-primary" />
              Par hippodrome
            </h2>
            {statsByHippo.length > 0 ? (
              <div className="space-y-3">
                {statsByHippo.map((h) => (
                  <div key={h.nom} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-text-secondary text-sm font-medium truncate">{h.nom}</span>
                        <span className={`font-bold text-sm flex-shrink-0 ml-2 ${h.taux >= 50 ? "text-status-win" : h.taux >= 35 ? "text-gold-primary" : "text-text-muted"}`}>
                          {h.taux}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: `${h.taux}%`,
                            background: h.taux >= 50
                              ? "linear-gradient(90deg, #16A34A, #22C55E)"
                              : "linear-gradient(90deg, #A07830, #C9A84C)",
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-text-muted text-xs flex-shrink-0 w-14 text-right">
                      {h.wins}/{h.total}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-sm text-center py-6">
                Statistiques disponibles après les premières courses
              </p>
            )}
          </div>
        </div>

        {/* ── RÉPARTITION RÉSULTATS ───────────────────────────────── */}
        {termines.length > 0 && (
          <div className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-base mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-gold-primary" />
              Répartition des résultats
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Gagnants",  count: gagnants.length,  total: termines.length, color: "text-status-win",     bg: "bg-status-win",     bgLight: "bg-status-win/10" },
                { label: "Partiels",  count: partiels.length,  total: termines.length, color: "text-status-partial", bg: "bg-status-partial", bgLight: "bg-status-partial/10" },
                { label: "Perdants",  count: perdants.length,  total: termines.length, color: "text-status-loss",    bg: "bg-status-loss",    bgLight: "bg-status-loss/10" },
              ].map((r) => {
                const pct = termines.length > 0 ? Math.round(r.count / termines.length * 100) : 0;
                return (
                  <div key={r.label} className={`p-4 rounded-xl border ${r.bgLight} border-transparent text-center`}>
                    <div className={`text-3xl font-bold font-serif ${r.color} mb-1`}>{r.count}</div>
                    <div className="text-text-secondary text-sm font-medium mb-2">{r.label}</div>
                    {/* Mini pie-like bar */}
                    <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden mx-auto max-w-16">
                      <div className={`h-full rounded-full ${r.bg}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={`text-xs font-bold mt-1.5 ${r.color}`}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── HISTORIQUE TABLE ────────────────────────────────────── */}
        <div className="card-base overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="font-serif font-bold text-text-primary text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gold-primary" />
              Historique des 30 derniers pronostics
            </h2>
            <span className="text-text-muted text-xs">{recent.length} entrées</span>
          </div>

          {recent.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-bg-elevated">
                    {["Date", "Course / Hippodrome", "Sélection Elite", "Arrivée Réelle", "Résultat", "Rapport", "Vérifier"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-text-muted text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {recent.map((p: any) => {
                    const res    = RESULTAT_CONFIG[p.resultat as PronosticResult] || RESULTAT_CONFIG.EN_ATTENTE;
                    const ResIcon = res.icon;
                    const course  = p.course as any;
                    const dateStr = p.date_publication
                      ? new Date(p.date_publication).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" })
                      : "—";
                    const selStr     = Array.isArray(p.selection)     ? p.selection.join(" - ")      : "—";
                    const arriveeStr = Array.isArray(p.arrivee_reelle) ? p.arrivee_reelle.join(" - ") : "—";
                    return (
                      <tr key={p.id} className="hover:bg-bg-hover transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-text-muted text-xs">{dateStr}</td>
                        <td className="px-4 py-3 min-w-[160px]">
                          <Link href={`/pronostics/${p.id}`}
                            className="text-text-primary text-sm font-medium hover:text-gold-light transition-colors truncate block max-w-[180px]">
                            {course?.libelle || "—"}
                          </Link>
                          <span className="text-text-muted text-xs">{course?.hippodrome?.nom || ""} · {BET_TYPE_LABELS[p.type_pari as BetType] || p.type_pari}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-gold-light font-mono text-xs font-bold tracking-wide">{selStr}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`font-mono text-xs ${p.arrivee_reelle ? "text-text-secondary" : "text-text-muted"}`}>
                            {arriveeStr}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold border ${res.classes}`}>
                            <ResIcon className="w-3 h-3" />
                            {res.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {p.rapport_gagnant
                            ? <span className="text-status-win font-bold text-sm">{Number(p.rapport_gagnant).toFixed(2)} €</span>
                            : <span className="text-text-muted text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const c = p.course as any;
                            const genyUrl = c?.date_course && c?.numero_reunion && c?.numero_course
                              ? buildGenyUrlAuto(c.date_course, c.numero_reunion, c.numero_course)
                              : p.lien_geny || null;
                            return genyUrl ? (
                              <a href={genyUrl} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-gold-primary hover:text-gold-light transition-colors underline-offset-2 hover:underline whitespace-nowrap">
                                <ExternalLink className="w-3 h-3" />Geny
                              </a>
                            ) : (
                              <span className="text-text-muted text-xs">—</span>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <TrendingUp className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary text-sm">
                L&apos;historique s&apos;affichera ici après la publication des premiers pronostics
              </p>
              <p className="text-text-muted text-xs mt-2">
                Rendez-vous demain matin à 8h00 pour nos premières analyses
              </p>
            </div>
          )}
        </div>

        {/* ── CTA FINAL ───────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden border border-gold-primary/30">
          <img
            src="https://images.unsplash.com/photo-1526094633853-031707a44819?w=1200&q=80"
            alt="Rejoignez Elite Turf"
            className="absolute inset-0 w-full h-full object-cover opacity-15"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-bg-card/95 via-bg-card/85 to-bg-card/95" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary to-transparent" />

          <div className="relative p-8 sm:p-10 text-center">
            <Trophy className="w-10 h-10 text-gold-primary mx-auto mb-4" />
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-text-primary mb-3">
              Ces résultats pourraient être les vôtres
            </h3>
            <p className="text-text-secondary text-sm max-w-md mx-auto mb-6">
              Rejoignez les <span className="text-gold-light font-semibold">847+ turfistes</span> qui
              utilisent Elite Turf chaque jour. Accès immédiat, paiement par Orange Money, MTN ou Wave.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/abonnements"
                className="flex items-center gap-2 px-7 py-3.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold w-full sm:w-auto justify-center"
              >
                <Zap className="w-4 h-4" fill="currentColor" />
                Voir les abonnements
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pronostics"
                className="flex items-center gap-2 px-7 py-3.5 bg-bg-elevated hover:bg-bg-hover border border-border hover:border-gold-primary/30 text-text-secondary hover:text-text-primary font-semibold text-sm rounded-xl transition-all w-full sm:w-auto justify-center"
              >
                <Star className="w-4 h-4" />
                Voir les pronostics gratuits
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
