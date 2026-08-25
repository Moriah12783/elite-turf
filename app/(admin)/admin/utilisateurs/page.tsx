import { createServiceClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import RenvoyerConfirmationButton from "@/components/admin/RenvoyerConfirmationButton";
import { Users, Search, Crown, Star } from "lucide-react";

export const metadata = { title: "Utilisateurs — Admin" };

// Nb de lignes affichées dans le tableau. Les COMPTEURS, eux, portent sur toute
// la base (count exact) — ne jamais les recalculer sur cette liste tronquée.
const LISTE_LIMIT = 500;

export default async function AdminUtilisateursPage() {
  const supabase = createServiceClient();

  // Compteurs = count exact côté base (comme le Dashboard). Les déduire de la
  // liste plafonnée donnait un total faux et une répartition fausse dès
  // qu'on dépassait la limite (bug : 104 membres affichés « 100 », 2 Elite « 1 »).
  const countProfiles = (build: (q: any) => any) =>
    build(supabase.from("profiles").select("*", { count: "exact", head: true }));

  const [
    { count: total },
    { count: starterPro },
    { count: elite },
    { count: gratuit },
    { count: expire },
    { data: users },
  ] = await Promise.all([
    countProfiles((q) => q),
    countProfiles((q) => q.in("statut_abonnement", ["STARTER", "PRO"])),
    countProfiles((q) => q.eq("statut_abonnement", "ELITE")),
    countProfiles((q) => q.eq("statut_abonnement", "GRATUIT")),
    countProfiles((q) => q.eq("statut_abonnement", "EXPIRE")),
    supabase
      .from("profiles")
      .select("*")
      .order("date_inscription", { ascending: false })
      .limit(LISTE_LIMIT),
  ]);

  const totalMembres = total ?? 0;
  const nbAffiches = users?.length ?? 0;
  const listeTronquee = totalMembres > nbAffiches;

  const STATUT_BADGE: Record<string, string> = {
    GRATUIT:  "bg-bg-elevated text-text-muted border-border",
    STARTER:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
    PRO:      "bg-gold-faint text-gold-light border-gold-primary/30",
    ELITE:    "bg-purple-500/10 text-purple-400 border-purple-500/20",
    EXPIRE:   "bg-status-loss/10 text-status-loss border-status-loss/20",
  };

  const STATUT_LABEL: Record<string, string> = {
    GRATUIT: "GRATUIT",
    STARTER: "STARTER",
    PRO:     "PRO",
    ELITE:   "ELITE",
    EXPIRE:  "EXPIRÉ",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-text-primary">Utilisateurs</h1>
          <p className="text-text-secondary text-sm mt-1">{totalMembres} membres</p>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: totalMembres, icon: Users, color: "text-blue-400" },
          { label: "Starter + Pro", value: starterPro ?? 0, icon: Star, color: "text-gold-primary" },
          { label: "Elite", value: elite ?? 0, icon: Crown, color: "text-purple-400" },
          { label: "Gratuit", value: gratuit ?? 0, icon: Users, color: "text-text-secondary" },
          { label: "Expirés", value: expire ?? 0, icon: Users, color: "text-status-loss" },
        ].map((s, i) => (
          <div key={i} className="card-base p-4">
            <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
            <div className={`text-xl font-bold font-serif ${s.color}`}>{s.value}</div>
            <div className="text-text-muted text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Le tableau n'affiche que les plus récents : le dire explicitement pour
          qu'on ne le reprenne jamais pour un total (cause du bug initial). */}
      {listeTronquee && (
        <p className="text-text-muted text-xs">
          Tableau : les {nbAffiches} membres les plus récents (sur {totalMembres}).
        </p>
      )}

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
                <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase">Actions</th>
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
                      {STATUT_LABEL[user.statut_abonnement] || user.statut_abonnement}
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
                  <td className="px-5 py-4">
                    {/* Bouton affiché UNIQUEMENT sur les profils réellement
                        activés — même règle que la route, qui refuse (409) les
                        autres. Inutile de proposer une action vouée à échouer. */}
                    {["STARTER", "PRO", "ELITE"].indexOf(user.statut_abonnement) !== -1 && (
                      <RenvoyerConfirmationButton
                        email={user.email}
                        nom={user.nom_complet || user.email}
                      />
                    )}
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
