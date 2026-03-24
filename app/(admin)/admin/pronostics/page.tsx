import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/utils";
import { Plus, Star, Eye, Edit2, ToggleLeft, ToggleRight } from "lucide-react";

export const metadata = { title: "Pronostics — Admin" };

const NIVEAU_BADGE: Record<string, string> = {
  GRATUIT: "bg-status-win/10 text-status-win border-status-win/20",
  PREMIUM: "bg-gold-faint text-gold-light border-gold-primary/30",
  VIP: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const RESULTAT_BADGE: Record<string, string> = {
  GAGNANT: "bg-status-win/15 text-status-win",
  PERDANT: "bg-status-loss/15 text-status-loss",
  PARTIEL: "bg-status-partial/15 text-status-partial",
  EN_ATTENTE: "bg-bg-elevated text-text-muted",
};

export default async function AdminPronosticsPage() {
  const supabase = createServiceClient();

  const { data: pronostics } = await supabase
    .from("pronostics")
    .select(`
      *,
      course:courses(libelle, date_course, heure_depart, hippodrome:hippodromes(nom))
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-text-primary">Pronostics</h1>
          <p className="text-text-secondary text-sm mt-1">{pronostics?.length || 0} pronostic(s) au total</p>
        </div>
        <Link
          href="/admin/pronostics/nouveau"
          className="flex items-center gap-2 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-semibold text-sm rounded-xl transition-colors shadow-gold-sm"
        >
          <Plus className="w-4 h-4" />
          Nouveau pronostic
        </Link>
      </div>

      {/* Table */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Course</th>
                <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Type</th>
                <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Niveau</th>
                <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Confiance</th>
                <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Résultat</th>
                <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Vues</th>
                <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Statut</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {pronostics?.map((p: any) => (
                <tr key={p.id} className="hover:bg-bg-hover transition-colors">
                  <td className="px-5 py-4">
                    <div className="text-text-primary text-sm font-medium">
                      {p.course?.libelle || "—"}
                    </div>
                    <div className="text-text-muted text-xs mt-0.5">
                      {p.course?.hippodrome?.nom} · {p.course?.date_course ? formatDate(p.course.date_course) : "—"} {p.course?.heure_depart ? formatTime(p.course.heure_depart) : ""}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-text-secondary text-sm">{p.type_pari}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${NIVEAU_BADGE[p.niveau_acces] || ""}`}>
                      {p.niveau_acces}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-0.5">
                      {[...Array(4)].map((_, i) => (
                        <Star
                          key={i}
                          className="w-3 h-3"
                          fill={
                            i < ({ FAIBLE: 1, MOYEN: 2, ELEVE: 3, TRES_ELEVE: 4 } as Record<string, number>)[p.confiance as string]
                              ? "#C9A84C"
                              : "transparent"
                          }
                          color={
                            i < ({ FAIBLE: 1, MOYEN: 2, ELEVE: 3, TRES_ELEVE: 4 } as Record<string, number>)[p.confiance as string]
                              ? "#C9A84C"
                              : "#3A3A50"
                          }
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RESULTAT_BADGE[p.resultat] || ""}`}>
                      {p.resultat}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 text-text-muted text-sm">
                      <Eye className="w-3.5 h-3.5" />
                      {p.nb_vues?.toLocaleString("fr-CI") || 0}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {p.publie ? (
                      <span className="flex items-center gap-1 text-status-win text-xs font-medium">
                        <ToggleRight className="w-4 h-4" /> Publié
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-text-muted text-xs">
                        <ToggleLeft className="w-4 h-4" /> Brouillon
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/pronostics/${p.id}/modifier`}
                      className="flex items-center gap-1 text-gold-primary hover:text-gold-light text-xs font-medium transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Modifier
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!pronostics || pronostics.length === 0) && (
            <div className="py-12 text-center">
              <Star className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary text-sm">Aucun pronostic pour l&apos;instant</p>
              <Link href="/admin/pronostics/nouveau" className="mt-3 inline-flex items-center gap-1.5 text-gold-primary hover:text-gold-light text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Créer le premier pronostic
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
