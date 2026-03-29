"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Save, Send, Plus, X, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

type CourseOption = {
  id: string;
  libelle: string;
  date_course: string;
  heure_depart: string;
  hippodrome: { nom: string } | null;
};

export default function ModifierPronosticPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selection, setSelection] = useState<number[]>([]);
  const [newNumero, setNewNumero] = useState("");
  const [form, setForm] = useState({
    course_id: "",
    niveau_acces: "GRATUIT",
    type_pari: "TIERCE",
    confiance: "ELEVE",
    analyse_courte: "",
    analyse_texte: "",
    publie: false,
    resultat: "EN_ATTENTE",
  });

  // Charger les courses disponibles
  useEffect(() => {
    const supabase = createClient();
    const from7 = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    supabase
      .from("courses")
      .select("id, libelle, date_course, heure_depart, hippodrome:hippodromes(nom)")
      .gte("date_course", from7)
      .order("date_course", { ascending: false })
      .order("heure_depart", { ascending: true })
      .limit(60)
      .then(({ data }) => setCourses((data as any) || []));
  }, []);

  // Charger le pronostic existant
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pronostics")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        toast.error("Pronostic introuvable");
        router.push("/admin/pronostics");
        return;
      }

      setForm({
        course_id: data.course_id || "",
        niveau_acces: data.niveau_acces || "GRATUIT",
        type_pari: data.type_pari || "TIERCE",
        confiance: data.confiance || "ELEVE",
        analyse_courte: data.analyse_courte || "",
        analyse_texte: data.analyse_texte || "",
        publie: data.publie || false,
        resultat: data.resultat || "EN_ATTENTE",
      });
      setSelection(data.selection || []);
      setLoadingData(false);
    };
    load();
  }, [id, router]);

  const addNumero = () => {
    const n = parseInt(newNumero);
    if (n > 0 && !selection.includes(n)) {
      setSelection([...selection, n]);
      setNewNumero("");
    }
  };

  const removeNumero = (n: number) => setSelection(selection.filter((x) => x !== n));

  const handleSave = async (publie: boolean) => {
    if (!form.course_id || selection.length === 0 || !form.analyse_courte) {
      toast.error("Remplissez tous les champs obligatoires");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("pronostics")
        .update({
          course_id: form.course_id,
          niveau_acces: form.niveau_acces,
          type_pari: form.type_pari,
          confiance: form.confiance,
          analyse_courte: form.analyse_courte,
          analyse_texte: form.analyse_texte,
          selection,
          publie,
          resultat: form.resultat,
          date_publication: publie ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;

      toast.success(publie ? "Pronostic publié !" : "Modifications enregistrées");
      router.push("/admin/pronostics");
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer ce pronostic définitivement ?")) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("pronostics").delete().eq("id", id);
      if (error) throw error;
      toast.success("Pronostic supprimé");
      router.push("/admin/pronostics");
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="max-w-3xl space-y-4 animate-pulse">
        <div className="h-8 bg-bg-elevated rounded-xl w-1/3" />
        <div className="h-64 bg-bg-elevated rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/pronostics" className="p-2 hover:bg-bg-card rounded-lg transition-colors text-text-muted">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-bold text-text-primary">Modifier Pronostic</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {form.publie ? (
                <span className="inline-flex items-center gap-1 text-status-win text-xs font-medium">
                  <Eye className="w-3 h-3" /> Publié
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-text-muted text-xs">
                  <EyeOff className="w-3 h-3" /> Brouillon
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-3 py-2 border border-status-loss/30 hover:border-status-loss/60 text-status-loss text-xs font-medium rounded-xl transition-colors"
        >
          Supprimer
        </button>
      </div>

      <div className="card-base p-6 space-y-6">
        {/* Course selector */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Course concernée <span className="text-status-loss">*</span>
          </label>
          <select
            value={form.course_id}
            onChange={(e) => setForm({ ...form, course_id: e.target.value })}
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-gold-primary transition-colors"
            required
          >
            <option value="">Sélectionner une course…</option>
            {courses.map((c) => {
              const hip = (c.hippodrome as any)?.nom || "?";
              const heure = (c.heure_depart || "").substring(0, 5);
              const date = new Date(c.date_course + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
              return (
                <option key={c.id} value={c.id}>
                  {date} — {c.libelle} ({hip} {heure})
                </option>
              );
            })}
          </select>
        </div>

        {/* Niveau + Type + Confiance */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">Niveau d&apos;accès</label>
            <select
              value={form.niveau_acces}
              onChange={(e) => setForm({ ...form, niveau_acces: e.target.value })}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary text-sm"
            >
              <option value="GRATUIT">🟢 Gratuit</option>
              <option value="PREMIUM">⭐ Premium</option>
              <option value="VIP">👑 VIP</option>
            </select>
          </div>
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">Type de pari</label>
            <select
              value={form.type_pari}
              onChange={(e) => setForm({ ...form, type_pari: e.target.value })}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary text-sm"
            >
              <option value="SIMPLE">Simple Gagnant</option>
              <option value="COUPLE">Couplé</option>
              <option value="TRIO">Trio</option>
              <option value="TIERCE">Tiercé</option>
              <option value="QUARTE">Quarté+</option>
              <option value="QUINTE_PLUS">Quinté+</option>
            </select>
          </div>
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">Confiance</label>
            <select
              value={form.confiance}
              onChange={(e) => setForm({ ...form, confiance: e.target.value })}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary text-sm"
            >
              <option value="FAIBLE">⭐ Faible</option>
              <option value="MOYEN">⭐⭐ Moyen</option>
              <option value="ELEVE">⭐⭐⭐ Élevé</option>
              <option value="TRES_ELEVE">⭐⭐⭐⭐ Très élevé</option>
            </select>
          </div>
        </div>

        {/* Résultat */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">Résultat de la course</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { value: "EN_ATTENTE", label: "En attente", classes: "border-border text-text-muted" },
              { value: "GAGNANT", label: "✓ Gagnant", classes: "border-status-win/40 text-status-win" },
              { value: "PARTIEL", label: "~ Partiel", classes: "border-status-partial/40 text-status-partial" },
              { value: "PERDANT", label: "✗ Perdant", classes: "border-status-loss/40 text-status-loss" },
            ].map((r) => (
              <button
                key={r.value}
                onClick={() => setForm({ ...form, resultat: r.value })}
                className={`px-3 py-2 border rounded-xl text-sm font-medium transition-all ${
                  form.resultat === r.value
                    ? r.classes + " bg-bg-elevated"
                    : "border-border text-text-muted hover:border-border/80"
                }`}
              >
                {r.value === "GAGNANT" && form.resultat === "GAGNANT" && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                {r.value === "PERDANT" && form.resultat === "PERDANT" && <XCircle className="w-3 h-3 inline mr-1" />}
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sélection */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Sélection (numéros) <span className="text-status-loss">*</span>
          </label>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {selection.map((n) => (
              <span
                key={n}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-faint border border-gold-primary/40 rounded-full text-gold-light text-sm font-semibold"
              >
                {n}
                <button onClick={() => removeNumero(n)} className="text-gold-primary/60 hover:text-gold-primary">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={newNumero}
                onChange={(e) => setNewNumero(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNumero()}
                placeholder="N°"
                min={1}
                max={20}
                className="w-16 px-3 py-1.5 bg-bg-elevated border border-border rounded-lg text-text-primary text-sm"
              />
              <button
                onClick={addNumero}
                className="p-1.5 bg-gold-faint border border-gold-primary/30 rounded-lg text-gold-primary hover:bg-gold-primary hover:text-bg-primary transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Analyse courte */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Analyse courte (aperçu public) <span className="text-status-loss">*</span>
          </label>
          <input
            type="text"
            value={form.analyse_courte}
            onChange={(e) => setForm({ ...form, analyse_courte: e.target.value })}
            maxLength={160}
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm"
          />
          <p className="mt-1 text-text-muted text-xs">{form.analyse_courte.length}/160</p>
        </div>

        {/* Analyse complète */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Analyse complète (abonnés)
          </label>
          <textarea
            value={form.analyse_texte}
            onChange={(e) => setForm({ ...form, analyse_texte: e.target.value })}
            rows={8}
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm resize-none leading-relaxed"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-border">
          <button
            onClick={() => handleSave(false)}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 border border-border hover:border-gold-primary/40 text-text-primary font-semibold text-sm rounded-xl transition-all"
          >
            <Save className="w-4 h-4" />
            Enregistrer
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold-sm"
          >
            <Send className="w-4 h-4" />
            {form.publie ? "Mettre à jour (publié)" : "Publier"}
          </button>
        </div>
      </div>
    </div>
  );
}
