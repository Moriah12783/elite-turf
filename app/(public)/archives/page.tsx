import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, Trophy, TrendingUp, ExternalLink, CheckCircle2, XCircle, Minus, Clock3, Calendar, ArrowRight } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildGenyUrlAuto } from "@/lib/geny";
import PageHero from "@/components/layout/PageHero";
import type { BetType, PronosticResult } from "@/types";
import { BET_TYPE_LABELS } from "@/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

export const metadata: Metadata = {
  title: "Archives — Historique Complet des Résultats | Elite Turf",
  description:
    "Consultez l'historique complet des pronostics Elite Turf : arrivées officielles, rapports PMU et taux de réussite par période. Réservé aux abonnés.",
  alternates: { canonical: `${APP_URL}/archives` },
};

export const dynamic = "force-dynamic";

const MOIS_LABELS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const RESULTAT_CONFIG: Record<PronosticResult, { label: string; icon: typeof CheckCircle2; classes: string }> = {
  GAGNANT:    { label: "Gagnant",  icon: CheckCircle2, classes: "text-status-win bg-status-win/10 border-status-win/20" },
  PERDANT:    { label: "Perdant",  icon: XCircle,      classes: "text-status-loss bg-status-loss/10 border-status-loss/20" },
  PARTIEL:    { label: "Partiel",  icon: Minus,        classes: "text-status-partial bg-status-partial/10 border-status-partial/20" },
  EN_ATTENTE: { label: "En cours", icon: Clock3,       classes: "text-text-muted bg-bg-elevated border-border" },
};

interface PageProps {
  searchParams: {
    mois?: string;   // "2026-03"
    type?: string;   // BetType
  };
}

export default async function ArchivesPage({ searchParams }: PageProps) {
  // ── 1. Vérification abonnement ────────────────────────────────────
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();

  let subscription = "GRATUIT";
  if (user) {
    // Utiliser createServiceClient pour contourner les éventuels problèmes RLS
    const { data: profile } = await createServiceClient()
      .from("profiles")
      .select("statut_abonnement")
      .eq("id", user.id)
      .single();
    if (profile) subscription = profile.statut_abonnement as string;
  }

  const isPremium = subscription === "PREMIUM" || subscription === "VIP";

  // ── 2. Filtres ────────────────────────────────────────────────────
  const now        = new Date();
  const moisActuel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const moisFiltre = searchParams.mois || moisActuel;
  const typeFiltre = searchParams.type || "";

  // 6 derniers mois pour le sélecteur
  const moisOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${MOIS_LABELS[d.getMonth()]} ${d.getFullYear()}`,
    };
  });

  // ── 3. Données (toujours fetch pour le preview paywall) ───────────
  const supabase   = createServiceClient();
  const [annee, mois] = moisFiltre.split("-");
  const debutMois  = `${moisFiltre}-01`;
  const finMois    = `${annee}-${String(Number(mois) + 1).padStart(2, "0")}-01`;

  let query = supabase
    .from("pronostics")
    .select(`
      id, type_pari, resultat, date_publication,
      selection, arrivee_reelle, rapport_gagnant,
      course:courses(libelle, date_course, numero_reunion, numero_course, hippodrome:hippodromes(nom))
    `)
    .eq("publie", true)
    .neq("resultat", "EN_ATTENTE")
    .gte("date_publication", debutMois)
    .lt("date_publication", finMois)
    .order("date_publication", { ascending: false });

  if (typeFiltre) {
    query = query.eq("type_pari", typeFiltre);
  }

  const { data: pronostics } = await query;
  const all = pronostics ?? [];

  // ── 4. Statistiques du mois ───────────────────────────────────────
  const gagnants = all.filter((p) => p.resultat === "GAGNANT").length;
  const perdants = all.filter((p) => p.resultat === "PERDANT").length;
  const partiels = all.filter((p) => p.resultat === "PARTIEL").length;
  const taux     = all.length > 0 ? Math.round((gagnants / all.length) * 100) : 0;
  const cumul    = all.reduce((acc, p) => acc + (Number(p.rapport_gagnant) || 0), 0);

  // Types de paris présents ce mois
  const typesPresents = Array.from(new Set(all.map((p) => p.type_pari as BetType)));

  // Pour le paywall : preview des 3 derniers
  const preview = all.slice(0, 3);

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHero
        image="/images/heroes/hero-performances.jpg"
        titre="Archives & Historique"
        sousTitre="Résultats complets, arrivées officielles et rapports vérifiables"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* ── Paywall pour non-abonnés ─────────────────────────────── */}
        {!isPremium && (
          <div className="space-y-6">
            {/* Preview floutée */}
            {preview.length > 0 && (
              <div className="relative">
                <div className="overflow-hidden rounded-2xl border border-border" style={{ maxHeight: 280 }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-bg-elevated border-b border-border">
                        {["Date","Course","Type","Résultat","Rapport"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-text-muted text-xs font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {preview.map((p: any) => {
                        const cfg = RESULTAT_CONFIG[p.resultat as PronosticResult] ?? RESULTAT_CONFIG.EN_ATTENTE;
                        const Icon = cfg.icon;
                        return (
                          <tr key={p.id} className="opacity-40">
                            <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                              {p.date_publication ? new Date(p.date_publication).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}) : "—"}
                            </td>
                            <td className="px-4 py-3 text-text-secondary text-sm">{(p.course as any)?.libelle ?? "—"}</td>
                            <td className="px-4 py-3 text-text-muted text-xs">{BET_TYPE_LABELS[p.type_pari as BetType] ?? p.type_pari}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.classes}`}>
                                <Icon className="w-3 h-3" />{cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-status-win text-sm font-bold">
                              {p.rapport_gagnant ? `${Number(p.rapport_gagnant).toFixed(2)}€` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Gradient flou */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-bg-primary to-transparent" />
              </div>
            )}

            {/* CTA */}
            <div className="card-base border-gold-primary/30 p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7 text-gold-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-text-primary mb-3">
                Historique réservé aux abonnés
              </h2>
              <p className="text-text-secondary text-sm max-w-md mx-auto mb-6">
                Accédez à l&apos;intégralité des archives : arrivées officielles, rapports PMU et statistiques
                par hippodrome pour les 6 derniers mois.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/abonnements" className="btn-primary flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  S&apos;abonner dès 65€
                  <ArrowRight className="w-4 h-4" />
                </Link>
                {!user && (
                  <Link href="/connexion" className="text-text-secondary hover:text-gold-light text-sm transition-colors">
                    Déjà abonné ? Se connecter →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Contenu premium ──────────────────────────────────────── */}
        {isPremium && (
          <>
            {/* Filtres */}
            <div className="flex flex-wrap gap-3 items-center">
              <Calendar className="w-4 h-4 text-gold-primary flex-shrink-0" />
              <div className="flex flex-wrap gap-2">
                {moisOptions.map((m) => (
                  <Link
                    key={m.value}
                    href={`/archives?mois=${m.value}${typeFiltre ? `&type=${typeFiltre}` : ""}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      moisFiltre === m.value
                        ? "bg-gold-primary text-bg-primary border-gold-primary"
                        : "bg-bg-elevated text-text-secondary border-border hover:border-gold-primary/40"
                    }`}
                  >
                    {m.label}
                  </Link>
                ))}
              </div>
              {typesPresents.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  <Link
                    href={`/archives?mois=${moisFiltre}`}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                      !typeFiltre ? "bg-gold-primary text-bg-primary border-gold-primary font-semibold" : "bg-bg-elevated text-text-muted border-border"
                    }`}
                  >
                    Tous
                  </Link>
                  {typesPresents.map((t) => (
                    <Link
                      key={t}
                      href={`/archives?mois=${moisFiltre}&type=${t}`}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        typeFiltre === t ? "bg-gold-primary text-bg-primary border-gold-primary font-semibold" : "bg-bg-elevated text-text-muted border-border"
                      }`}
                    >
                      {BET_TYPE_LABELS[t] ?? t}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* KPI du mois */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: TrendingUp, value: `${taux}%`,           label: "Taux de réussite", color: "text-status-win" },
                { icon: CheckCircle2, value: `${gagnants}`,      label: "Gagnants",          color: "text-status-win" },
                { icon: Trophy,     value: cumul > 0 ? `+${cumul.toFixed(0)}€` : "—", label: "Cumul rapports", color: "text-gold-primary" },
                { icon: Calendar,   value: `${all.length}`,      label: "Pronostics",        color: "text-text-primary" },
              ].map((kpi, i) => (
                <div key={i} className="card-base p-4 text-center">
                  <kpi.icon className={`w-5 h-5 ${kpi.color} mx-auto mb-2`} />
                  <div className={`text-2xl font-bold font-serif ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-text-muted text-xs mt-0.5">{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Table historique */}
            <div className="card-base overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-serif font-bold text-text-primary text-base">
                  Historique — {moisOptions.find((m) => m.value === moisFiltre)?.label}
                </h2>
                <span className="text-text-muted text-xs">{all.length} pronostics</span>
              </div>

              {all.length === 0 ? (
                <div className="p-10 text-center text-text-muted text-sm">
                  Aucun pronostic terminé pour cette période.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-bg-elevated">
                        {["Date","Course / Hippodrome","Type","Sélection","Arrivée","Résultat","Rapport","Vérifier"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-text-muted text-xs font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {all.map((p: any) => {
                        const cfg = RESULTAT_CONFIG[p.resultat as PronosticResult] ?? RESULTAT_CONFIG.EN_ATTENTE;
                        const Icon = cfg.icon;
                        const course = p.course as any;
                        const genyUrl = course?.date_course && course?.numero_reunion && course?.numero_course
                          ? buildGenyUrlAuto(course.date_course, course.numero_reunion, course.numero_course)
                          : null;

                        return (
                          <tr key={p.id} className="hover:bg-bg-hover transition-colors">
                            <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                              {p.date_publication ? new Date(p.date_publication).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"2-digit"}) : "—"}
                            </td>
                            <td className="px-4 py-3 min-w-[160px]">
                              <Link href={`/pronostics/${p.id}`} className="text-text-primary text-sm font-medium hover:text-gold-light transition-colors truncate block max-w-[180px]">
                                {course?.libelle ?? "—"}
                              </Link>
                              <span className="text-text-muted text-xs">{course?.hippodrome?.nom ?? ""}</span>
                            </td>
                            <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                              {BET_TYPE_LABELS[p.type_pari as BetType] ?? p.type_pari}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-gold-light font-mono text-xs font-bold tracking-wide">
                                {Array.isArray(p.selection) ? p.selection.join(" - ") : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-text-secondary font-mono text-xs">
                                {Array.isArray(p.arrivee_reelle) ? p.arrivee_reelle.join(" - ") : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-semibold ${cfg.classes}`}>
                                <Icon className="w-3 h-3" />{cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {p.rapport_gagnant
                                ? <span className="text-status-win font-bold text-sm">{Number(p.rapport_gagnant).toFixed(2)}€</span>
                                : <span className="text-text-muted text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {genyUrl ? (
                                <a href={genyUrl} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-gold-primary hover:text-gold-light transition-colors whitespace-nowrap">
                                  <ExternalLink className="w-3 h-3" />Geny
                                </a>
                              ) : <span className="text-text-muted text-xs">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
