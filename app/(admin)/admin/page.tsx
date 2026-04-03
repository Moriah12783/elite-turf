import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Users, Star, CreditCard, CalendarDays, RefreshCw } from "lucide-react";
import SyncResultatsButton from "@/components/admin/SyncResultatsButton";
import CronMonitorPanel from "@/components/admin/CronMonitorPanel";

// 1 EUR ≈ 655.957 XOF (taux fixe CFA)
const XOF_TO_EUR = (xof: number) =>
  (xof / 655.957).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 });

export const metadata = { title: "Dashboard Admin" };

async function getAdminStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [
    { count: totalUsers },
    { count: premiumUsers },
    { count: coursesAujourdhui },
    { count: pronosticsPublies },
    { data: transactions },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("actif", true),
    supabase.from("profiles").select("*", { count: "exact", head: true }).in("statut_abonnement", ["PREMIUM", "VIP"]),
    supabase.from("courses").select("*", { count: "exact", head: true }).eq("date_course", today),
    supabase.from("pronostics").select("*", { count: "exact", head: true }).eq("publie", true).gte("created_at", today),
    supabase.from("transactions").select("montant_fcfa").eq("statut", "SUCCES").gte("date_transaction", firstOfMonth),
  ]);

  const revenusMois = transactions?.reduce((sum: number, t: { montant_fcfa?: number }) => sum + (t.montant_fcfa || 0), 0) || 0;

  return {
    totalUsers: totalUsers || 0,
    premiumUsers: premiumUsers || 0,
    coursesAujourdhui: coursesAujourdhui || 0,
    pronosticsPublies: pronosticsPublies || 0,
    revenusMois,
  };
}

export default async function AdminDashboard() {
  const supabase = createServiceClient();
  const stats = await getAdminStats(supabase);

  const kpis = [
    {
      icon: Users,
      label: "Membres actifs",
      value: stats.totalUsers.toLocaleString("fr-CI"),
      sublabel: "Total inscrits",
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      border: "border-blue-400/20",
    },
    {
      icon: Star,
      label: "Abonnés Premium",
      value: stats.premiumUsers.toLocaleString("fr-CI"),
      sublabel: "Premium + Elite",
      color: "text-gold-primary",
      bg: "bg-gold-faint",
      border: "border-gold-primary/20",
    },
    {
      icon: CreditCard,
      label: "Revenus du mois",
      value: XOF_TO_EUR(stats.revenusMois),
      sublabel: "Transactions validées",
      color: "text-status-win",
      bg: "bg-status-win/10",
      border: "border-status-win/20",
    },
    {
      icon: CalendarDays,
      label: "Courses aujourd'hui",
      value: stats.coursesAujourdhui.toString(),
      sublabel: `${stats.pronosticsPublies} pronostic(s) publié(s)`,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
      border: "border-purple-400/20",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary">
          Tableau de Bord
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          {new Date().toLocaleDateString("fr-CI", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className={`card-base p-5 border ${kpi.border}`}>
            <div className={`w-10 h-10 rounded-xl ${kpi.bg} border ${kpi.border} flex items-center justify-center mb-3`}>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
            <div className={`text-2xl font-bold font-serif ${kpi.color}`}>{kpi.value}</div>
            <div className="text-text-primary text-sm font-medium mt-0.5">{kpi.label}</div>
            <div className="text-text-muted text-xs mt-0.5">{kpi.sublabel}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-serif text-lg font-semibold text-text-primary mb-4">Actions Rapides</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              href: "/admin/courses/nouveau",
              icon: CalendarDays,
              title: "Ajouter une course",
              desc: "Saisir manuellement le programme du jour",
              color: "border-blue-400/30 hover:border-blue-400/60",
              iconColor: "text-blue-400",
            },
            {
              href: "/admin/pronostics/nouveau",
              icon: Star,
              title: "Publier un pronostic",
              desc: "Rédiger et publier un pronostic expert",
              color: "border-gold-primary/30 hover:border-gold-primary/60",
              iconColor: "text-gold-primary",
            },
            {
              href: "/admin/utilisateurs",
              icon: Users,
              title: "Gérer les membres",
              desc: "Voir, modifier, prolonger les abonnements",
              color: "border-purple-400/30 hover:border-purple-400/60",
              iconColor: "text-purple-400",
            },
          ].map((action, i) => (
            <a
              key={i}
              href={action.href}
              className={`card-base p-5 border ${action.color} flex items-start gap-4 cursor-pointer transition-all group`}
            >
              <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <action.icon className={`w-5 h-5 ${action.iconColor}`} />
              </div>
              <div>
                <h3 className="text-text-primary font-semibold text-sm">{action.title}</h3>
                <p className="text-text-secondary text-xs mt-1">{action.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* ── Synchronisation Résultats ────────────────────────────────── */}
      <div>
        <h2 className="font-serif text-lg font-semibold text-text-primary mb-2 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-gold-primary" />
          Synchronisation des Résultats
        </h2>
        <p className="text-text-secondary text-sm mb-4">
          Met à jour automatiquement le résultat (GAGNANT / PARTIEL / PERDANT) de tous les pronostics
          EN_ATTENTE dont la course est passée. Le cron s&apos;exécute chaque soir à 21h, mais vous pouvez
          le lancer manuellement ici.
        </p>
        <SyncResultatsButton />
      </div>

      {/* ── Monitoring Crons (dynamique, temps réel) ──────────────────── */}
      <CronMonitorPanel />

      {/* Status automatisations (kept as fallback visual reference) */}
      <div className="hidden">
        <div className="card-base divide-y divide-border">
          {[].map((item, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <span className="text-text-secondary text-sm"></span>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-xs"></span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-medium`}></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
