"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2, Globe2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

const PARIS_OPTIONS = [
  { value: "QUINTE_PLUS",    label: "Quinté+" },
  { value: "QUARTE_PLUS",    label: "Quarté+" },
  { value: "TIERCE",         label: "Tiercé" },
  { value: "COUPLE_GAGNANT", label: "Couplé Gagnant" },
  { value: "COUPLE_PLACE",   label: "Couplé Placé" },
  { value: "SIMPLE_GAGNANT", label: "Simple Gagnant" },
  { value: "SIMPLE_PLACE",   label: "Simple Placé" },
  { value: "MULTI",          label: "Multi" },
  { value: "TRIO",           label: "Trio" },
  { value: "COUPLE",         label: "Couplé" },
];

interface Props {
  course: any;
  hippodromes: { id: string; nom: string; pays: string }[];
}

export default function ModifierCourseClient({ course, hippodromes }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [parisDisponibles, setParisDisponibles] = useState<string[]>(
    Array.isArray(course.paris_disponibles) ? course.paris_disponibles : []
  );

  const [form, setForm] = useState({
    hippodrome_id: course.hippodrome_id || "",
    date_course: course.date_course || "",
    heure_depart: (course.heure_depart || "").substring(0, 5),
    numero_reunion: course.numero_reunion || 1,
    numero_course: course.numero_course || 1,
    libelle: course.libelle || "",
    distance_metres: course.distance_metres || 1600,
    categorie: course.categorie || "PLAT",
    terrain: course.terrain || "BON",
    nb_partants: course.nb_partants || 10,
    statut: course.statut || "PROGRAMME",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  }

  function togglePari(pari: string) {
    setParisDisponibles((prev) =>
      prev.includes(pari) ? prev.filter((p) => p !== pari) : [...prev, pari]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.hippodrome_id) return toast.error("Sélectionnez un hippodrome");
    if (!form.libelle.trim()) return toast.error("Le libellé est requis");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("courses")
        .update({
          ...form,
          heure_depart: form.heure_depart.length === 5 ? form.heure_depart + ":00" : form.heure_depart,
          paris_disponibles: parisDisponibles,
        })
        .eq("id", course.id);
      if (error) throw error;
      toast.success("Course mise à jour !");
      router.push("/admin/courses");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer cette course ? Les pronostics associés seront aussi supprimés.")) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("courses").delete().eq("id", course.id);
      if (error) throw error;
      toast.success("Course supprimée");
      router.push("/admin/courses");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5 text-text-primary text-sm focus:outline-none focus:border-gold-primary transition-colors";
  const labelClass =
    "block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-1.5";

  return (
    <div className="max-w-2xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/courses"
            className="p-2 rounded-lg bg-bg-elevated border border-border hover:border-gold-primary/40 text-text-secondary hover:text-text-primary transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-serif text-xl font-bold text-text-primary">Modifier la course</h1>
            <p className="text-text-muted text-xs mt-0.5 font-mono truncate max-w-[220px]">{course.libelle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 border border-status-loss/30 hover:border-status-loss/60 text-status-loss text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Supprimer
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-5">

        {/* Hippodrome & Date */}
        <div className="card-base p-5 space-y-4">
          <h2 className="font-serif font-semibold text-text-primary text-sm border-b border-border pb-3">
            Hippodrome &amp; Date
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Hippodrome *</label>
              <select
                name="hippodrome_id"
                value={form.hippodrome_id}
                onChange={handleChange}
                className={inputClass}
                required
              >
                <option value="">Sélectionner un hippodrome…</option>
                {hippodromes.map((h) => (
                  <option key={h.id} value={h.id}>{h.nom} — {h.pays}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Date *</label>
              <input type="date" name="date_course" value={form.date_course} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Heure de départ *</label>
              <input type="time" name="heure_depart" value={form.heure_depart} onChange={handleChange} className={inputClass} required />
            </div>
          </div>
        </div>

        {/* Informations course */}
        <div className="card-base p-5 space-y-4">
          <h2 className="font-serif font-semibold text-text-primary text-sm border-b border-border pb-3">
            Informations de la course
          </h2>
          <div>
            <label className={labelClass}>Libellé *</label>
            <input type="text" name="libelle" value={form.libelle} onChange={handleChange} className={inputClass} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Réunion N°</label>
              <input type="number" name="numero_reunion" value={form.numero_reunion} onChange={handleChange} min={1} max={10} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Course N°</label>
              <input type="number" name="numero_course" value={form.numero_course} onChange={handleChange} min={1} max={20} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Catégorie *</label>
              <select name="categorie" value={form.categorie} onChange={handleChange} className={inputClass}>
                <option value="PLAT">Plat</option>
                <option value="TROT">Trot</option>
                <option value="OBSTACLE">Obstacle</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Distance (m)</label>
              <input type="number" name="distance_metres" value={form.distance_metres} onChange={handleChange} min={800} max={6000} step={100} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Nb partants</label>
              <input type="number" name="nb_partants" value={form.nb_partants} onChange={handleChange} min={1} max={30} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Terrain</label>
              <select name="terrain" value={form.terrain} onChange={handleChange} className={inputClass}>
                <option value="BON">Bon</option>
                <option value="BON_SOUPLE">Bon souple</option>
                <option value="SOUPLE">Souple</option>
                <option value="LOURD">Lourd</option>
                <option value="TRES_LOURD">Très lourd</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Statut</label>
              <select name="statut" value={form.statut} onChange={handleChange} className={inputClass}>
                <option value="PROGRAMME">Programmé</option>
                <option value="EN_COURS">En cours</option>
                <option value="TERMINE">Terminé</option>
                <option value="ANNULE">Annulé</option>
              </select>
            </div>
          </div>
        </div>

        {/* Paris disponibles */}
        <div className="card-base p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Globe2 className="w-4 h-4 text-emerald-400" />
            <h2 className="font-serif font-semibold text-text-primary text-sm">Paris disponibles</h2>
            <span className="text-text-muted text-xs ml-auto">{parisDisponibles.length} sélectionné(s)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PARIS_OPTIONS.map((opt) => {
              const checked = parisDisponibles.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => togglePari(opt.value)}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all text-left ${
                    checked
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                      : "bg-bg-elevated border-border text-text-muted hover:border-border/80 hover:text-text-secondary"
                  }`}
                >
                  {checked ? "✓ " : ""}{opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-text-muted text-xs">
            Active les types de paris jouables. Cocher Quinté+ classe cette course en Nationale 1.
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-gold-primary hover:bg-gold-dark disabled:opacity-50 text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-bg-primary/40 border-t-bg-primary rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {loading ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
          <Link href="/admin/courses" className="px-5 py-3 text-text-secondary hover:text-text-primary text-sm font-medium transition-colors">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
