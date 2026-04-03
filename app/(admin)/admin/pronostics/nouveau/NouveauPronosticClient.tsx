"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Save, Send, Plus, X } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

type CourseOption = {
  id: string;
  libelle: string;
  date_course: string;
  heure_depart: string;
  hippodrome: { nom: string } | null;
};

interface Props {
  courses: CourseOption[];
}

export default function NouveauPronosticClient({ courses }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    course_id: "",
    niveau_acces: "GRATUIT",
    type_pari: "TIERCE",
    confiance: "ELEVE",
    analyse_courte: "",
    analyse_texte: "",
  });
  const [selection, setSelection] = useState<number[]>([]);
  const [newNumero, setNewNumero] = useState("");

  const addNumero = () => {
    const n = parseInt(newNumero);
    if (n > 0 && !selection.includes(n)) {
      setSelection([...selection, n]);
      setNewNumero("");
    }
  };

  const removeNumero = (n: number) => {
    setSelection(selection.filter((x) => x !== n));
  };

  const handleSave = async (publie: boolean) => {
    if (!form.course_id || selection.length === 0 || !form.analyse_courte) {
      toast.error("Remplissez tous les champs obligatoires");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { data: inserted, error } = await supabase
        .from("pronostics")
        .insert({
          ...form,
          selection,
          publie,
          auteur_id: user?.id,
          date_publication: publie ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Envoyer les emails aux abonnés si publication immédiate
      if (publie && inserted?.id) {
        fetch("/api/admin/pronostics/notifier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pronosticId: inserted.id }),
        }).then(async (res) => {
          const d = await res.json();
          if (d.sent > 0) toast.success(`📧 ${d.sent} abonné(s) notifié(s) par email`);
        }).catch(() => {/* non bloquant */});
      }

      toast.success(publie ? "Pronostic publié !" : "Brouillon enregistré");
      router.push("/admin/pronostics");
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/pronostics" className="p-2 hover:bg-bg-card rounded-lg transition-colors text-text-muted">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-serif text-2xl font-bold text-text-primary">Nouveau Pronostic</h1>
          <p className="text-text-secondary text-sm">Rédiger et publier un pronostic</p>
        </div>
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
            <option value="">Sélectionner une course (7 derniers jours)…</option>
            {courses.map((c) => {
              const hip = (c.hippodrome as any)?.nom || "?";
              const heure = (c.heure_depart || "").substring(0, 5);
              const date = new Date(c.date_course + "T12:00:00").toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              });
              return (
                <option key={c.id} value={c.id}>
                  {date} — {c.libelle} ({hip} {heure})
                </option>
              );
            })}
          </select>
          {courses.length === 0 && (
            <p className="mt-1 text-text-muted text-xs">
              Aucune course trouvée.{" "}
              <Link href="/admin/courses/nouvelle" className="text-gold-primary">
                Créer une course d&apos;abord
              </Link>
            </p>
          )}
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
            <label className="block text-text-secondary text-sm font-medium mb-2">Niveau de confiance</label>
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

        {/* Sélection */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Sélection (numéros des partants) <span className="text-status-loss">*</span>
          </label>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {selection.map((n) => (
              <span
                key={n}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-faint border border-gold-primary/40 rounded-full text-gold-light text-sm font-semibold"
              >
                {n}
                <button type="button" onClick={() => removeNumero(n)} className="text-gold-primary/60 hover:text-gold-primary">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={newNumero}
                onChange={(e) => setNewNumero(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNumero())}
                placeholder="N°"
                min={1}
                max={20}
                className="w-16 px-3 py-1.5 bg-bg-elevated border border-border rounded-lg text-text-primary text-sm"
              />
              <button
                type="button"
                onClick={addNumero}
                className="p-1.5 bg-gold-faint border border-gold-primary/30 rounded-lg text-gold-primary hover:bg-gold-primary hover:text-bg-primary transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-text-muted text-xs">Ajoutez les numéros des chevaux sélectionnés dans l&apos;ordre conseillé</p>
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
            placeholder="Ex: Le 3 en grande forme, tiercé en ordre conseillé…"
            maxLength={160}
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm"
          />
          <p className="mt-1 text-text-muted text-xs">{form.analyse_courte.length}/160 caractères</p>
        </div>

        {/* Analyse complète */}
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Analyse complète (réservée aux abonnés)
          </label>
          <textarea
            value={form.analyse_texte}
            onChange={(e) => setForm({ ...form, analyse_texte: e.target.value })}
            placeholder="Rédigez ici l'analyse détaillée : forme des chevaux, conditions de course, historique jockey/entraîneur, facteurs météo, recommandations de mise…"
            rows={8}
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm resize-none leading-relaxed"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 border border-border hover:border-gold-primary/40 text-text-primary font-semibold text-sm rounded-xl transition-all"
          >
            <Save className="w-4 h-4" />
            Enregistrer en brouillon
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold-sm"
          >
            <Send className="w-4 h-4" />
            Publier le pronostic
          </button>
          {loading && (
            <span className="w-5 h-5 border-2 border-gold-primary/30 border-t-gold-primary rounded-full animate-spin" />
          )}
        </div>
      </div>
    </div>
  );
}
