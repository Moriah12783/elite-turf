import { createClient, createServiceClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import {
  Users, Star, TrendingUp, CreditCard,
  CalendarDays, Trophy, AlertCircle, CheckCircle2
} from "lucide-react";

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
      value: formatMoney(stats.revenusMois),
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

      {/* Status automatisations */}
      <div>
        <h2 className="font-serif text-lg font-semibold text-text-primary mb-4">
          Statut des Automatisations
        </h2>
        <div className="card-base divide-y divide-border">
          {[
            { name: "Scraping programmes (07h00)", status: "OK", heure: "07:03", icon: CheckCircle2, color: "text-status-win" },
            { name: "Scraping arrivées (18h00)", status: "EN ATTENTE", heure: "—", icon: AlertCircle, color: "text-status-partial" },
            { name: "Alertes abonnés expirants", status: "OK", heure: "09:01", icon: CheckCircle2, color: "text-status-win" },
            { name: "Newsletter hebdomadaire", status: "OK", heure: "Lun 08:00", icon: CheckCircle2, color: "text-status-win" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <span className="text-text-secondary text-sm">{item.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-xs">{item.heure}</span>
                <div className="flex items-center gap-1.5">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                  <span className={`text-xs font-medium ${item.color}`}>{item.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
