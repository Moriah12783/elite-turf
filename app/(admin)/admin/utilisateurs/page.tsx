import { createServiceClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Users, Search, Crown, Star } from "lucide-react";

export const metadata = { title: "Utilisateurs — Admin" };

export default async function AdminUtilisateursPage() {
  const supabase = createServiceClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("date_inscription", { ascending: false })
    .limit(100);

  const STATUT_BADGE: Record<string, string> = {
    GRATUIT: "bg-bg-elevated text-text-muted border-border",
    PREMIUM: "bg-gold-faint text-gold-light border-gold-primary/30",
    VIP: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    EXPIRE: "bg-status-loss/10 text-status-loss border-status-loss/20",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-text-primary">Utilisateurs</h1>
          <p className="text-text-secondary text-sm mt-1">{users?.length || 0} membres</p>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: users?.length || 0, icon: Users, color: "text-blue-400" },
          { label: "Premium", value: users?.filter(u => u.statut_abonnement === "PREMIUM").length || 0, icon: Star, color: "text-gold-primary" },
          { label: "VIP", value: users?.filter(u => u.statut_abonnement === "VIP").length || 0, icon: Crown, color: "text-purple-400" },
          { label: "Expirés", value: users?.filter(u => u.statut_abonnement === "EXPIRE").length || 0, icon: Users, color: "text-status-loss" },
        ].map((s, i) => (
          <div key={i} className="card-base p-4">
            <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
            <div className={`text-xl font-bold font-serif ${s.color}`}>{s.value}</div>
            <div className="text-text-muted text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase">Membre</th>
                <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase">Pays</th>
                <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase">Abonnement</th>
                <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase">Inscrit le</th>
                <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {users?.map((user: any) => (
                <tr key={user.id} className="hover:bg-bg-hover transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gold-faint border border-gold-primary/20 flex items-center justify-center text-gold-primary font-serif font-bold text-sm flex-shrink-0">
                        {(user.nom_complet || user.email)?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-text-primary text-sm font-medium">{user.nom_complet || "—"}</p>
                        <p className="text-text-muted text-xs">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-text-secondary text-sm">{user.pays || "—"}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUT_BADGE[user.statut_abonnement] || ""}`}>
                      {user.statut_abonnement}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-text-secondary text-sm">
                    {user.date_inscription ? formatDate(user.date_inscription) : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium ${user.actif ? "text-status-win" : "text-status-loss"}`}>
                      {user.actif ? "● Actif" : "● Inactif"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
