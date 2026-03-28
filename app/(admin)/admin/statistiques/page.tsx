import { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import {
  TrendingUp, Users, CreditCard, BarChart3,
  Target, Star, Crown, Zap
} from "lucide-react";

export const metadata: Metadata = { title: "Statistiques — Admin Elite Turf" };
export const dynamic = "force-dynamic";

const MOIS_LABELS = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];

export default async function StatistiquesPage() {
  const supabase = createServiceClient();
  const now = new Date();

  // ── Données en parallèle ──────────────────────────────────────────
  const [
    { data: profiles },
    { data: transactions },
    { data: pronostics },
    { count: totalCourses },
  ] = await Promise.all([
    supabase.from("profiles").select("created_at, statut_abonnement, actif"),
    supabase.from("transactions").select("montant_fcfa, statut, date_transaction"),
    supabase.from("pronostics").select("resultat, date_publication, publie").eq("publie", true),
    supabase.from("courses").select("*", { count: "exact", head: true }),
  ]);

  const allProfiles     = profiles || [];
  const allTransactions = transactions || [];
  const allPronostics   = pronostics || [];

  // ── Stats globales ────────────────────────────────────────────────
  const totalUsers    = allProfiles.filter(p => p.actif).length;
  const premiumUsers  = allProfiles.filter(p => ["PREMIUM", "VIP"].includes(p.statut_abonnement)).length;
  const vipUsers      = allProfiles.filter(p => p.statut_abonnement === "VIP").length;
  const freeUsers     = allProfiles.filter(p => p.statut_abonnement === "GRATUIT").length;
  const conversionRate = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0;

  const totalRevenues = allTransactions
    .filter(t => t.statut === "SUCCES")
    .reduce((s, t: any) => s + (t.montant_fcfa || 0), 0);

  const pronoTermines = allPronostics.filter(p => p.resultat !== "EN_ATTENTE");
  const pronoGagnants = allPronostics.filter(p => p.resultat === "GAGNANT");
  const tauxReussite  = pronoTermines.length > 0 ? Math.round((pronoGagnants.length / pronoTermines.length) * 100) : 0;

  // ── Inscriptions par semaine (8 dernières semaines) ───────────────
  const weeklySignups = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(now.getTime() - (7 - i) * 7 * 24 * 60 * 60 * 1000);
    const end   = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      label: `S${i + 1}`,
      count: allProfiles.filter(p => {
        const d = new Date(p.created_at);
        return d >= start && d < end;
      }).length,
    };
  });
  const maxWeekly = Math.max(...weeklySignups.map(w => w.count), 1);

  // ── Revenus par mois (6 derniers mois) ───────────────────────────
  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const d     = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const debut = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const fin   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59).toISOString();
    const total = allTransactions
      .filter(t => t.statut === "SUCCES" && t.date_transaction >= debut && t.date_transaction <= fin)
      .reduce((s, t: any) => s + (t.montant_fcfa || 0), 0);
    return { mois: MOIS_LABELS[d.getMonth()], eur: Math.round(total / 655.957) };
  });
  const maxMonthly = Math.max(...monthlyRevenue.map(m => m.eur), 1);

  // ── Répartition abonnements ────────────────────────────────────────
  const repartition = [
    { label: "PACK DÉCOUVERTE", icon: Zap,   color: "text-status-win",  bg: "bg-status-win",  count: allProfiles.filter(p => p.statut_abonnement === "PREMIUM" && !p.actif).length, pct: 0 },
    { label: "PACK PERFORMANCE", icon: Star, color: "text-gold-primary", bg: "bg-gold-primary", count: premiumUsers - vipUsers, pct: 0 },
    { label: "PACK ELITE",       icon: Crown, color: "text-purple-400", bg: "bg-purple-400",   count: vipUsers,                pct: 0 },
    { label: "Gratuit",          icon: Users, color: "text-text-muted", bg: "bg-text-muted",   count: freeUsers,               pct: 0 },
  ].map(r => ({
    ...r,
    pct: totalUsers > 0 ? Math.round((r.count / totalUsers) * 100) : 0,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl font-bold text-text-primary">Statistiques</h1>
        <p className="text-text-secondary text-sm mt-1">Vue d&apos;ensemble de la plateforme Elite Turf</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users,    label: "Membres actifs",     value: totalUsers.toString(),                             sub: `${freeUsers} gratuits`,              color: "text-blue-400",       border: "border-blue-400/20" },
          { icon: Star,     label: "Abonnés payants",    value: premiumUsers.toString(),                           sub: `Taux conversion : ${conversionRate}%`, color: "text-gold-primary",  border: "border-gold-primary/20" },
          { icon: CreditCard, label: "Revenus cumulés",  value: `${(totalRevenues / 655.957).toFixed(0)} €`,       sub: `${totalRevenues.toLocaleString("fr-CI")} FCFA`, color: "text-status-win", border: "border-status-win/20" },
          { icon: Target,   label: "Taux de réussite",   value: `${tauxReussite}%`,                                sub: `${pronoGagnants.length}/${pronoTermines.length} pronostics`, color: "text-purple-400", border: "border-purple-400/20" },
        ].map((k, i) => (
          <div key={i} className={`card-base p-5 border ${k.border}`}>
            <k.icon className={`w-5 h-5 ${k.color} mb-2`} />
            <div className={`text-2xl font-bold font-serif ${k.color}`}>{k.value}</div>
            <div className="text-text-primary text-sm font-medium mt-0.5">{k.label}</div>
            <div className="text-text-muted text-xs mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Inscriptions par semaine */}
        <div className="card-base p-6">
          <h2 className="font-semibold text-text-primary text-base mb-5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gold-primary" />
            Inscriptions (8 dernières semaines)
          </h2>
          <div className="flex items-end gap-2 h-32">
            {weeklySignups.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-text-muted text-xs">{w.count}</span>
                <div
                  className="w-full bg-gold-primary/70 rounded-t-sm transition-all"
                  style={{ height: `${Math.max((w.count / maxWeekly) * 100, 4)}%` }}
                />
                <span className="text-text-muted text-[10px]">{w.label}</span>
              </div>
            ))}
          </div>
          <p className="text-text-muted text-xs mt-3 text-center">
            Total : {allProfiles.length} inscrits
          </p>
        </div>

        {/* Revenus par mois */}
        <div className="card-base p-6">
          <h2 className="font-semibold text-text-primary text-base mb-5 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gold-primary" />
            Revenus mensuels (€)
          </h2>
          <div className="flex items-end gap-2 h-32">
            {monthlyRevenue.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-text-muted text-xs">{m.eur > 0 ? m.eur : ""}</span>
                <div
                  className="w-full bg-status-win/70 rounded-t-sm transition-all"
                  style={{ height: `${Math.max((m.eur / maxMonthly) * 100, 4)}%` }}
                />
                <span className="text-text-muted text-[10px]">{m.mois}</span>
              </div>
            ))}
          </div>
          <p className="text-text-muted text-xs mt-3 text-center">
            Revenus confirmés (transactions SUCCES uniquement)
          </p>
        </div>
      </div>

      {/* Répartition abonnements */}
      <div className="card-base p-6">
        <h2 className="font-semibold text-text-primary text-base mb-5 flex items-center gap-2">
          <Users className="w-4 h-4 text-gold-primary" />
          Répartition des abonnements
        </h2>
        <div className="space-y-4">
          {repartition.map((r, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="flex items-center gap-2 w-40 flex-shrink-0">
                <r.icon className={`w-4 h-4 ${r.color} flex-shrink-0`} />
                <span className="text-text-secondary text-sm font-medium truncate">{r.label}</span>
              </div>
              <div className="flex-1 h-3 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${r.bg} opacity-80`}
                  style={{ width: `${r.pct}%` }}
                />
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 w-20 text-right">
                <span className={`font-bold text-sm ${r.color}`}>{r.count}</span>
                <span className="text-text-muted text-xs">({r.pct}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Indicateurs pronostics */}
      <div className="card-base p-6">
        <h2 className="font-semibold text-text-primary text-base mb-5 flex items-center gap-2">
          <Target className="w-4 h-4 text-gold-primary" />
          Indicateurs pronostics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total publiés",  value: allPronostics.length,      color: "text-text-primary" },
            { label: "Gagnants",       value: pronoGagnants.length,      color: "text-status-win" },
            { label: "En attente",     value: allPronostics.filter(p => p.resultat === "EN_ATTENTE").length, color: "text-status-partial" },
            { label: "Courses totales", value: totalCourses || 0,        color: "text-blue-400" },
          ].map((s, i) => (
            <div key={i} className="text-center p-4 bg-bg-elevated rounded-xl">
              <div className={`text-3xl font-bold font-serif ${s.color}`}>{s.value}</div>
              <div className="text-text-muted text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
