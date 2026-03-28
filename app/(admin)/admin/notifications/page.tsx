"use client";

import { useState } from "react";
import { Bell, Send, Users, Tag, Info, Megaphone, AlertTriangle, CheckCircle2 } from "lucide-react";

const TYPE_CONFIG = {
  info:   { label: "Information",  icon: Info,         color: "text-blue-400",         bg: "bg-blue-400/10 border-blue-400/30" },
  promo:  { label: "Promotion",    icon: Megaphone,    color: "text-gold-primary",     bg: "bg-gold-faint border-gold-primary/30" },
  alerte: { label: "Alerte",       icon: AlertTriangle, color: "text-status-partial",  bg: "bg-status-partial/10 border-status-partial/30" },
};

const SEGMENT_CONFIG = [
  { value: "tous",     label: "Tous les membres",   count: "—", icon: Users },
  { value: "premium",  label: "Abonnés Premium",    count: "—", icon: Tag },
  { value: "gratuit",  label: "Membres Gratuit",    count: "—", icon: Bell },
  { value: "expires",  label: "Abonnements expirés", count: "—", icon: AlertTriangle },
];

const HISTORIQUE_MOCK = [
  { titre: "🏇 Quinté+ gagnant aujourd'hui !", type: "alerte", segment: "Tous", date: "2026-03-28 07:30", ouvertures: 412 },
  { titre: "Nouveau pronostic VIP disponible", type: "promo", segment: "Premium", date: "2026-03-27 08:00", ouvertures: 189 },
  { titre: "Votre abonnement expire dans 3 jours", type: "info", segment: "Expirés", date: "2026-03-26 09:00", ouvertures: 67 },
  { titre: "Guide gratuit : 5 secrets du Quinté+", type: "promo", segment: "Gratuit", date: "2026-03-25 10:00", ouvertures: 823 },
];

export default function NotificationsPage() {
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "promo" | "alerte">("info");
  const [segment, setSegment] = useState("tous");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!titre.trim() || !message.trim()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setSent(true);
    setLoading(false);
    setTitre("");
    setMessage("");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
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

          {sent && (
            <div className="mb-4 p-3 bg-status-win/10 border border-status-win/20 rounded-xl flex items-center gap-2 text-status-win text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Notification envoyée avec succès !
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
              disabled={loading || !titre.trim() || !message.trim()}
              className="w-full py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {loading ? "Envoi en cours..." : "Envoyer la notification"}
            </button>
          </form>
        </div>

        {/* Historique */}
        <div className="card-base p-6">
          <h2 className="font-semibold text-text-primary text-base mb-5 flex items-center gap-2">
            <Bell className="w-4 h-4 text-gold-primary" />
            Historique récent
          </h2>

          <div className="space-y-3">
            {HISTORIQUE_MOCK.map((n, i) => {
              const cfg = TYPE_CONFIG[n.type as keyof typeof TYPE_CONFIG];
              return (
                <div key={i} className="p-3 bg-bg-elevated rounded-xl border border-border">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-text-primary text-sm font-semibold leading-snug">{n.titre}</span>
                    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span>👥 {n.segment}</span>
                    <span>📅 {n.date}</span>
                    <span className="text-status-win font-medium">👁 {n.ouvertures} ouvertures</span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-text-muted text-xs mt-4 text-center">
            Les données réelles s&apos;afficheront une fois OneSignal configuré.
          </p>
        </div>
      </div>
    </div>
  );
}
