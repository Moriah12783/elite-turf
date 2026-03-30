"use client";

import { useState } from "react";
import { User, Phone, MapPin, Save, X, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  userId: string;
  nomComplet: string;
  phone: string;
  pays: string;
}

const PAYS_OPTIONS = [
  "Côte d'Ivoire", "France (diaspora)", "Sénégal", "Cameroun", "Mali",
  "Burkina Faso", "Guinée", "Bénin", "Togo", "Niger", "Congo",
  "Gabon", "Madagascar", "Maroc", "Tunisie", "Autre",
];

export default function ProfileEditForm({ userId, nomComplet, phone, pays }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nomComplet, phone, pays });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({
          nom_complet: form.nomComplet.trim(),
          phone: form.phone.trim(),
          pays: form.pays,
        })
        .eq("id", userId);

      setSaved(true);
      setEditing(false);
      setTimeout(() => {
        setSaved(false);
        window.location.reload();
      }, 1200);
    } finally {
      setLoading(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-gold-primary transition-colors mt-1"
      >
        <Pencil className="w-3 h-3" />
        Modifier le profil
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 bg-bg-elevated rounded-xl border border-border space-y-3">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
        Modifier mon profil
      </p>

      {/* Nom complet */}
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-text-muted flex-shrink-0" />
        <input
          type="text"
          value={form.nomComplet}
          onChange={(e) => setForm({ ...form, nomComplet: e.target.value })}
          placeholder="Nom complet"
          className="flex-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold-primary/50"
        />
      </div>

      {/* Téléphone */}
      <div className="flex items-center gap-2">
        <Phone className="w-4 h-4 text-text-muted flex-shrink-0" />
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="Téléphone (+225...)"
          className="flex-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold-primary/50"
        />
      </div>

      {/* Pays */}
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-text-muted flex-shrink-0" />
        <select
          value={form.pays}
          onChange={(e) => setForm({ ...form, pays: e.target.value })}
          className="flex-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-gold-primary/50"
        >
          {PAYS_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-gold-primary hover:bg-gold-light text-bg-primary text-xs font-bold rounded-lg transition-colors disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5" />
          {saved ? "Sauvegardé !" : loading ? "..." : "Sauvegarder"}
        </button>
        <button
          onClick={() => { setEditing(false); setForm({ nomComplet, phone, pays }); }}
          className="flex items-center gap-1.5 px-3 py-2 border border-border text-text-muted hover:text-text-primary text-xs rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Annuler
        </button>
      </div>
    </div>
  );
}
