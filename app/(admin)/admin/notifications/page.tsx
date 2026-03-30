"use client";

import { useState, useEffect } from "react";
import { Bell, Send, Users, Tag, Info, Megaphone, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const TYPE_CONFIG = {
  info:   { label: "Information",  icon: Info,          color: "text-blue-400",       bg: "bg-blue-400/10 border-blue-400/30" },
  promo:  { label: "Promotion",    icon: Megaphone,     color: "text-gold-primary",   bg: "bg-gold-faint border-gold-primary/30" },
  alerte: { label: "Alerte",       icon: AlertTriangle, color: "text-status-partial", bg: "bg-status-partial/10 border-status-partial/30" },
};

const SEGMENT_CONFIG = [
  { value: "tous",    label: "Tous les membres",    icon: Users },
  { value: "premium", label: "Abonnés Premium",     icon: Tag },
  { value: "gratuit", label: "Membres Gratuit",     icon: Bell },
  { value: "expires", label: "Abonnements expirés", icon: AlertTriangle },
];

type Notif = {
  id: string;
  headings?: { fr?: string; en?: string };
  contents?: { fr?: string; en?: string };
  completed_at?: number;
  successful?: number;
};

export default function NotificationsPage() {
  const [titre,   setTitre]   = useState("");
  const [message, setMessage] = useState("");
  const [type,    setType]    = useState<"info" | "promo" | "alerte">("info");
  const [segment, setSegment] = useState("tous");
  const [status,  setStatus]  = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [recipients, setRecipients] = useState<number | null>(null);
  const [history,  setHistory]  = useState<Notif[]>([]);
  const [histLoading, setHistLoading] = useState(true);

  // Charger l'historique au montage
  useEffect(() => {
    fetch("/api/notifications/send")
      .then(r => r.json())
      .then(d => setHistory(d.notifications || []))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!titre.trim() || !message.trim()) return;
    setStatus("loading");
    setStatusMsg("");

    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titre, message, type, segment }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setStatusMsg(data.error || "Erreur lors de l'envoi");
        return;
      }

      setStatus("success");
      setRecipients(data.recipients);
      setStatusMsg(`Notification envoyée à ${data.recipients} abonné(s) !`);
      setTitre("");
      setMessage("");

      // Rafraîchir l'historique
      fetch("/api/notifications/send")
        .then(r => r.json())
        .then(d => setHistory(d.notifications || []))
        .catch(() => {});

    } catch {
      setStatus("error");
      setStatusMsg("Erreur réseau — réessayez");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold text-text-primary">Notifications</h1>
        <p className="text-text-secondary text-sm mt-1">Envoyer des push notifications à vos membres</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Formulaire d'envoi */}
        <div className="card-base p-6">
          <h2 className="font-semibold text-text-primary text-base mb-5 flex items-center gap-2">
            <Send className="w-4 h-4 text-gold-primary" />
            Nouvelle notification
          </h2>

          {status === "success" && (
            <div className="mb-4 p-3 bg-status-win/10 border border-status-win/20 rounded-xl flex items-center gap-2 text-status-win text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {statusMsg}
            </div>
          )}
          {status === "error" && (
            <div className="mb-4 p-3 bg-status-loss/10 border border-status-loss/20 rounded-xl flex items-center gap-2 text-status-loss text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {statusMsg}
            </div>
          )}

          <form onSubmit={handleSend} className="space-y-4">
            {/* Type */}
            <div>
              <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block mb-2">
                Type
              </label>
              <div className="flex gap-2">
                {(Object.entries(TYPE_CONFIG) as [keyof typeof TYPE_CONFIG, typeof TYPE_CONFIG[keyof typeof TYPE_CONFIG]][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      type === key ? cfg.bg + " " + cfg.color : "bg-bg-elevated border-border text-text-secondary"
                    }`}
                  >
                    <cfg.icon className="w-3 h-3" />
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Segment */}
            <div>
              <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block mb-2">
                Destinataires
              </label>
              <select
                value={segment}
                onChange={e => setSegment(e.target.value)}
                className="w-full px-3 py-2.5 bg-bg-elevated border border-border text-text-secondary text-sm rounded-xl focus:border-gold-primary/50 focus:outline-none"
              >
                {SEGMENT_CONFIG.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Titre */}
            <div>
              <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block mb-2">
                Titre <span className="text-text-muted normal-case font-normal">(max 60 caractères)</span>
              </label>
              <input
                value={titre}
                onChange={e => setTitre(e.target.value.slice(0, 60))}
                placeholder="Ex : 🏇 Quinté+ gagnant aujourd'hui !"
                className="w-full px-3 py-2.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-xl focus:border-gold-primary/50 focus:outline-none placeholder:text-text-muted"
              />
              <p className="text-text-muted text-xs mt-1 text-right">{titre.length}/60</p>
            </div>

            {/* Message */}
            <div>
              <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block mb-2">
                Message <span className="text-text-muted normal-case font-normal">(max 200 caractères)</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, 200))}
                rows={3}
                placeholder="Rédigez votre message ici..."
                className="w-full px-3 py-2.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-xl focus:border-gold-primary/50 focus:outline-none placeholder:text-text-muted resize-none"
              />
              <p className="text-text-muted text-xs mt-1 text-right">{message.length}/200</p>
            </div>

            <button
              type="submit"
              disabled={status === "loading" || !titre.trim() || !message.trim()}
              className="w-full py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {status === "loading" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours...</>
              ) : (
                <><Send className="w-4 h-4" /> Envoyer la notification</>
              )}
            </button>
          </form>
        </div>

        {/* Historique */}
        <div className="card-base p-6">
          <h2 className="font-semibold text-text-primary text-base mb-5 flex items-center gap-2">
            <Bell className="w-4 h-4 text-gold-primary" />
            Historique récent
          </h2>

          {histLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gold-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-text-muted text-sm">Aucune notification envoyée</p>
              <p className="text-text-muted text-xs mt-1">
                Les notifications apparaîtront ici après l&apos;envoi
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((n) => {
                const titreNotif = n.headings?.fr || n.headings?.en || "—";
                const contenu    = n.contents?.fr  || n.contents?.en  || "";
                const date       = n.completed_at
                  ? new Date(n.completed_at * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
                  : "—";
                return (
                  <div key={n.id} className="p-3 bg-bg-elevated rounded-xl border border-border">
                    <p className="text-text-primary text-sm font-semibold leading-snug mb-1">{titreNotif}</p>
                    {contenu && <p className="text-text-muted text-xs mb-2 line-clamp-2">{contenu}</p>}
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span>📅 {date}</span>
                      {(n.successful ?? 0) > 0 && (
                        <span className="text-status-win font-medium">✓ {n.successful} reçues</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
