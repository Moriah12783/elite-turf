"use client";

/**
 * UI de modération des témoignages réels — saisie + approve/reject/delete.
 * Pattern calqué sur admin/notifications (fetch POST vers /api/admin/*).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Quote, CheckCircle2, XCircle, Trash2, Loader2, Plus } from "lucide-react";

interface Temoignage {
  id: string;
  nom_affiche: string;
  ville: string | null;
  pays: string | null;
  pack: string | null;
  texte: string;
  note: number | null;
  preuve_url: string | null;
  source: string;
  statut: "pending" | "approved" | "rejected";
  created_at: string;
  approved_at: string | null;
}

const STATUT_STYLE: Record<string, string> = {
  pending:  "bg-status-partial/15 text-status-partial border-status-partial/30",
  approved: "bg-status-win/15 text-status-win border-status-win/30",
  rejected: "bg-status-loss/15 text-status-loss border-status-loss/30",
};

export default function TemoignagesClient({ initial }: { initial: Temoignage[] }) {
  const router = useRouter();
  const [busy, setBusy]     = useState<string | null>(null);
  const [error, setError]   = useState("");
  const [form, setForm]     = useState({ nom_affiche: "", ville: "", pays: "", pack: "", texte: "", note: "", preuve_url: "" });
  const [saving, setSaving] = useState(false);

  const call = async (url: string, init: RequestInit) => {
    setError("");
    const res  = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || `Erreur ${res.status}`); return false; }
    router.refresh();
    return true;
  };

  const setStatut = async (id: string, statut: string) => {
    setBusy(id);
    await call(`/api/admin/temoignages/${id}`, { method: "PATCH", body: JSON.stringify({ statut }) });
    setBusy(null);
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer définitivement ce témoignage ?")) return;
    setBusy(id);
    await call(`/api/admin/temoignages/${id}`, { method: "DELETE" });
    setBusy(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await call("/api/admin/temoignages", {
      method: "POST",
      body: JSON.stringify({ ...form, note: form.note ? Number(form.note) : null, pack: form.pack || null }),
    });
    if (ok) setForm({ nom_affiche: "", ville: "", pays: "", pack: "", texte: "", note: "", preuve_url: "" });
    setSaving(false);
  };

  const input = "w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary text-sm";

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-2">
        <Quote className="w-6 h-6 text-gold-primary" />
        <h1 className="font-serif text-2xl font-bold text-text-primary">Témoignages réels</h1>
      </div>
      <p className="text-text-secondary text-sm mb-8">
        Saisis les retours reçus sur WhatsApp, puis approuve-les pour les publier sur la home.
        Seuls les témoignages <strong>approuvés</strong> s&apos;affichent (avec disclaimer automatique).
      </p>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-status-loss/10 border border-status-loss/30 text-status-loss text-sm">
          {error}
        </div>
      )}

      {/* ── Saisie ── */}
      <form onSubmit={submit} className="card-base p-5 mb-10 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input className={input} placeholder="Nom affiché (ex: Kofi A.) *" required
            value={form.nom_affiche} onChange={(e) => setForm({ ...form, nom_affiche: e.target.value })} />
          <input className={input} placeholder="Ville"
            value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
          <input className={input} placeholder="Pays"
            value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select className={input} value={form.pack} onChange={(e) => setForm({ ...form, pack: e.target.value })}>
            <option value="">Pack (optionnel)</option>
            <option>Starter</option><option>Pro</option><option>Elite</option>
          </select>
          <select className={input} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}>
            <option value="">Note (optionnelle)</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
          </select>
          <input className={input} placeholder="Preuve (URL capture, interne)"
            value={form.preuve_url} onChange={(e) => setForm({ ...form, preuve_url: e.target.value })} />
        </div>
        <textarea className={`${input} min-h-[90px]`} placeholder="Texte du témoignage (authentique, tel que reçu) *" required
          value={form.texte} onChange={(e) => setForm({ ...form, texte: e.target.value })} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark disabled:opacity-60 text-bg-primary font-bold text-sm rounded-xl transition-all">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Ajouter (en attente de modération)
        </button>
      </form>

      {/* ── Liste ── */}
      <div className="space-y-4">
        {initial.length === 0 && (
          <p className="text-text-muted text-sm">Aucun témoignage pour l&apos;instant. La section home reste masquée.</p>
        )}
        {initial.map((t) => (
          <div key={t.id} className="card-base p-5">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-text-primary font-semibold text-sm">{t.nom_affiche}</span>
              {t.ville && <span className="text-text-muted text-xs">{t.ville}{t.pays ? `, ${t.pays}` : ""}</span>}
              {t.pack && <span className="text-xs px-2 py-0.5 rounded-full bg-gold-faint border border-gold-primary/30 text-gold-light">{t.pack}</span>}
              {t.note != null && <span className="text-xs text-gold-light">{t.note}/5</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUT_STYLE[t.statut]}`}>{t.statut}</span>
              <span className="text-text-muted text-xs ml-auto">{new Date(t.created_at).toLocaleDateString("fr-FR")}</span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed mb-3">{t.texte}</p>
            <div className="flex items-center gap-2">
              {t.statut !== "approved" && (
                <button onClick={() => setStatut(t.id, "approved")} disabled={busy === t.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-status-win/15 hover:bg-status-win/25 border border-status-win/30 text-status-win text-xs font-semibold rounded-lg transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approuver
                </button>
              )}
              {t.statut !== "rejected" && (
                <button onClick={() => setStatut(t.id, "rejected")} disabled={busy === t.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-status-loss/10 hover:bg-status-loss/20 border border-status-loss/30 text-status-loss text-xs font-semibold rounded-lg transition-colors">
                  <XCircle className="w-3.5 h-3.5" /> Rejeter
                </button>
              )}
              <button onClick={() => remove(t.id)} disabled={busy === t.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-text-muted hover:text-status-loss text-xs font-medium transition-colors ml-auto">
                <Trash2 className="w-3.5 h-3.5" /> Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
