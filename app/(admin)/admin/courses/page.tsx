import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import {
  Plus, MapPin, Clock, Users, CheckCircle2,
  XCircle, Edit2, Calendar, ChevronLeft, ChevronRight, ListOrdered,
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

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDateFr(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const supabase = createServiceClient();

  const today = new Date().toISOString().split("T")[0];
  const rawDate = searchParams?.date || today;
  // Valider le format YYYY-MM-DD
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;

  const prevDate = offsetDate(selectedDate, -1);
  const nextDate = offsetDate(selectedDate, +1);
  const isToday  = selectedDate === today;

  const { data: courses } = await supabase
    .from("courses")
    .select(`
      id, numero_reunion, numero_course, libelle,
      date_course, heure_depart, distance_metres,
      categorie, terrain, nb_partants, statut,
      paris_disponibles,
      hippodrome:hippodromes(nom, pays),
      pronostics(id, publie)
    `)
    .eq("date_course", selectedDate)
    .order("numero_reunion", { ascending: true })
    .order("numero_course",  { ascending: true });

  // Stats
  const total         = courses?.length || 0;
  const avecPronostic = courses?.filter((c: any) => c.pronostics?.some((p: any) => p.publie)).length || 0;
  const terminees     = courses?.filter((c: any) => c.statut === "TERMINE").length || 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-text-primary">Courses</h1>
          <p className="text-text-secondary text-sm mt-1 capitalize">{formatDateFr(selectedDate)} · {total} course(s)</p>
        </div>
        <Link
          href="/admin/courses/nouvelle"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-semibold text-sm rounded-xl transition-colors shadow-gold-sm w-fit"
        >
          <Plus className="w-4 h-4" />
          Nouvelle course
        </Link>
      </div>

      {/* Navigation par date */}
      <div className="flex items-center justify-between card-base p-3">
        <Link
          href={`/admin/courses?date=${prevDate}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          {new Date(prevDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </Link>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gold-primary" />
          <span className="text-text-primary font-semibold text-sm capitalize">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </span>
          {isToday && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gold-primary/10 text-gold-primary border border-gold-primary/20 font-medium">
              Aujourd&apos;hui
            </span>
          )}
        </div>

        <Link
          href={`/admin/courses?date=${nextDate}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
        >
          {new Date(nextDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Raccourcis rapides */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "Hier",     date: offsetDate(today, -1) },
          { label: "Aujourd'hui", date: today },
          { label: "Demain",   date: offsetDate(today, +1) },
        ].map(({ label, date }) => (
          <Link
            key={date}
            href={`/admin/courses?date=${date}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              selectedDate === date
                ? "bg-gold-primary text-bg-primary border-gold-primary"
                : "bg-bg-elevated text-text-secondary border-border hover:border-gold-primary/50 hover:text-text-primary"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total",          value: total,         color: "text-text-primary" },
          { label: "Avec pronostic", value: avecPronostic, color: "text-gold-primary" },
          { label: "Terminées",      value: terminees,     color: "text-status-win" },
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
                {["Course", "Hippodrome", "Catégorie", "Heure", "Partants", "Paris", "Statut", "Pronostic", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {courses?.map((c: any) => {
                const statut     = STATUT_CONFIG[c.statut] || STATUT_CONFIG.PROGRAMME;
                const aPronostic = c.pronostics?.some((p: any) => p.publie);
                const ref        = `R${c.numero_reunion}C${c.numero_course}`;
                return (
                  <tr key={c.id} className="hover:bg-bg-hover transition-colors">
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
                        {c.nb_partants || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {Array.isArray(c.paris_disponibles) && c.paris_disponibles.length > 0 ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium whitespace-nowrap">
                          🌍 {c.paris_disponibles.length} paris
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
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
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/courses/${c.id}/partants`}
                          className="flex items-center gap-1 text-text-secondary hover:text-gold-primary text-xs font-medium transition-colors"
                        >
                          <ListOrdered className="w-3.5 h-3.5" /> Partants
                        </Link>
                        <Link
                          href={`/admin/courses/${c.id}/modifier`}
                          className="flex items-center gap-1 text-gold-primary hover:text-gold-light text-xs font-medium transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Modifier
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {(!courses || courses.length === 0) && (
            <div className="py-12 text-center">
              <Calendar className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary text-sm">Aucune course pour le {new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <Link href={`/admin/courses?date=${prevDate}`} className="flex items-center gap-1.5 text-gold-primary hover:text-gold-light text-sm font-medium transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Jour précédent
                </Link>
                <Link href="/admin/courses/nouvelle" className="flex items-center gap-1.5 text-gold-primary hover:text-gold-light text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" /> Ajouter une course
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
