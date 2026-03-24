import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import {
  Plus, MapPin, Clock, Users, CheckCircle2,
  Clock3, XCircle, Edit2, Calendar
} from "lucide-react";

export const metadata = { title: "Courses — Admin Elite Turf" };

const STATUT_CONFIG: Record<string, { label: string; classes: string }> = {
  PROGRAMME: { label: "Programmé", classes: "bg-bg-elevated text-text-muted border-border" },
  EN_COURS:  { label: "En cours",  classes: "bg-status-win/10 text-status-win border-status-win/30" },
  TERMINE:   { label: "Terminé",   classes: "bg-bg-elevated text-text-muted border-border" },
  ANNULE:    { label: "Annulé",    classes: "bg-status-loss/10 text-status-loss border-status-loss/30" },
};

const CATEGORIE_COLORS: Record<string, string> = {
  PLAT:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  TROT:     "bg-purple-500/10 text-purple-400 border-purple-500/20",
  OBSTACLE: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export default async function AdminCoursesPage() {
  const supabase = createServiceClient();

  // Aujourd'hui par défaut
  const today = new Date().toISOString().split("T")[0];

  const { data: courses } = await supabase
    .from("courses")
    .select(`
      id, numero_reunion, numero_course, libelle,
      date_course, heure_depart, distance_metres,
      categorie, terrain, nb_partants, statut,
      hippodrome:hippodromes(nom, pays),
      pronostics(id, publie)
    `)
    .gte("date_course", new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0])
    .order("date_course", { ascending: false })
    .order("heure_depart", { ascending: true })
    .limit(100);

  const { data: hippodromes } = await supabase
    .from("hippodromes").select("id, nom").eq("actif", true).order("nom");

  // Stats
  const total = courses?.length || 0;
  const avecPronostic = courses?.filter((c: any) => c.pronostics?.some((p: any) => p.publie)).length || 0;
  const terminees = courses?.filter((c: any) => c.statut === "TERMINE").length || 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-text-primary">Courses</h1>
          <p className="text-text-secondary text-sm mt-1">7 derniers jours · {total} course(s)</p>
        </div>
        <Link
          href="/admin/courses/nouvelle"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-semibold text-sm rounded-xl transition-colors shadow-gold-sm w-fit"
        >
          <Plus className="w-4 h-4" />
          Nouvelle course
        </Link>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total",           value: total,         color: "text-text-primary" },
          { label: "Avec pronostic",  value: avecPronostic, color: "text-gold-primary" },
          { label: "Terminées",       value: terminees,     color: "text-status-win" },
        ].map((s) => (
          <div key={s.label} className="card-base p-4 text-center">
            <div className={`text-2xl font-bold font-serif ${s.color}`}>{s.value}</div>
            <div className="text-text-muted text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Date", "Course", "Hippodrome", "Catégorie", "Heure", "Partants", "Statut", "Pronostic", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {courses?.map((c: any) => {
                const statut = STATUT_CONFIG[c.statut] || STATUT_CONFIG.PROGRAMME;
                const aPronostic = c.pronostics?.some((p: any) => p.publie);
                const ref = `R${c.numero_reunion}C${c.numero_course}`;
                return (
                  <tr key={c.id} className="hover:bg-bg-hover transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-text-muted" />
                        <span className="text-text-secondary text-xs">
                          {new Date(c.date_course + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[180px]">
                      <p className="text-text-primary font-medium truncate max-w-[200px]">{c.libelle}</p>
                      <p className="text-text-muted text-xs font-mono">{ref}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-text-muted" />
                        <span className="text-text-secondary text-sm">{c.hippodrome?.nom || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CATEGORIE_COLORS[c.categorie] || ""}`}>
                        {c.categorie}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-gold-light font-semibold text-sm">
                        <Clock className="w-3.5 h-3.5" />
                        {c.heure_depart?.slice(0, 5)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-text-muted text-sm">
                        <Users className="w-3.5 h-3.5" />
                        {c.nb_partants}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statut.classes}`}>
                        {statut.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {aPronostic ? (
                        <span className="flex items-center gap-1 text-status-win text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Oui
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/courses/${c.id}/modifier`}
                        className="flex items-center gap-1 text-gold-primary hover:text-gold-light text-xs font-medium transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Modifier
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {(!courses || courses.length === 0) && (
            <div className="py-12 text-center">
              <Calendar className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary text-sm">Aucune course enregistrée</p>
              <Link href="/admin/courses/nouvelle" className="mt-3 inline-flex items-center gap-1.5 text-gold-primary hover:text-gold-light text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Ajouter la première course
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
