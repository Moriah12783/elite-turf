"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Plus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function NouvelleCoursePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [hippodromes, setHippodromes] = useState<{ id: string; nom: string; pays: string }[]>([]);

  const [form, setForm] = useState({
    hippodrome_id: "",
    date_course: new Date().toISOString().split("T")[0],
    heure_depart: "14:00",
    numero_reunion: 1,
    numero_course: 1,
    libelle: "",
    distance_metres: 1600,
    categorie: "PLAT",
    terrain: "BON",
    nb_partants: 10,
    statut: "PROGRAMME",
  });

  useEffect(() => {
    supabase.from("hippodromes").select("id, nom, pays").eq("actif", true).order("nom")
      .then(({ data }) => setHippodromes(data || []));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.hippodrome_id) return toast.error("Sélectionnez un hippodrome");
    if (!form.libelle.trim()) return toast.error("Le libellé est requis");

    setLoading(true);
    try {
      const { error } = await supabase.from("courses").insert([{
        ...form,
        heure_depart: form.heure_depart + ":00",
      }]);

      if (error) throw error;
      toast.success("Course créée avec succès !");
      router.push("/admin/courses");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5 text-text-primary text-sm focus:outline-none focus:border-gold-primary transition-colors";
  const labelClass = "block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-1.5";

  return (
    <div className="max-w-2xl space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/courses" className="p-2 rounded-lg bg-bg-elevated border border-border hover:border-gold-primary/40 text-text-secondary hover:text-text-primary transition-all">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-serif text-xl font-bold text-text-primary">Nouvelle course</h1>
          <p className="text-text-muted text-xs mt-0.5">Ajouter une course au programme</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Hippodrome */}
        <div className="card-base p-5 space-y-4">
          <h2 className="font-serif font-semibold text-text-primary text-sm border-b border-border pb-3">
            Hippodrome & Date
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Hippodrome *</label>
              <select name="hippodrome_id" value={form.hippodrome_id} onChange={handleChange} className={inputClass} required>
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

        {/* Infos course */}
        <div className="card-base p-5 space-y-4">
          <h2 className="font-serif font-semibold text-text-primary text-sm border-b border-border pb-3">
            Informations de la course
          </h2>

          <div>
            <label className={labelClass}>Libellé *</label>
            <input
              type="text"
              name="libelle"
              value={form.libelle}
              onChange={handleChange}
              placeholder="ex: Prix de la Forêt"
              className={inputClass}
              required
            />
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
              <label className={labelClass}>Distance (m) *</label>
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
            {loading ? "Enregistrement…" : "Créer la course"}
          </button>
          <Link href="/admin/courses" className="px-5 py-3 text-text-secondary hover:text-text-primary text-sm font-medium transition-colors">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
