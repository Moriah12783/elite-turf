"use client";

import { useState, useEffect } from "react";
import {
  Bell, Send, Users, Tag, Info, Megaphone, AlertTriangle,
  CheckCircle2, XCircle, Loader2, MessageSquare, Smartphone, Crown,
} from "lucide-react";

// ─── Config Push ────────────────────────────────────────────────────────────

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

// ─── Onglet Push ─────────────────────────────────────────────────────────────

function PushTab() {
  const [titre,   setTitre]   = useState("");
  const [message, setMessage] = useState("");
  const [type,    setType]    = useState<"info" | "promo" | "alerte">("info");
  const [segment, setSegment] = useState("tous");
  const [status,  setStatus]  = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [history,  setHistory]  = useState<Notif[]>([]);
  const [histLoading, setHistLoading] = useState(true);

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
      if (!res.ok) { setStatus("error"); setStatusMsg(data.error || "Erreur"); return; }
      setStatus("success");
      setStatusMsg(`Notification envoyée à ${data.recipients} abonné(s) !`);
      setTitre(""); setMessage("");
      fetch("/api/notifications/send").then(r => r.json()).then(d => setHistory(d.notifications || [])).catch(() => {});
    } catch {
      setStatus("error"); setStatusMsg("Erreur réseau — réessayez");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Formulaire */}
      <div className="card-base p-6">
        <h2 className="font-semibold text-text-primary text-base mb-5 flex items-center gap-2">
          <Send className="w-4 h-4 text-gold-primary" />
          Nouvelle notification push
        </h2>

        {status === "success" && (
          <div className="mb-4 p-3 bg-status-win/10 border border-status-win/20 rounded-xl flex items-center gap-2 text-status-win text-sm">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{statusMsg}
          </div>
        )}
        {status === "error" && (
          <div className="mb-4 p-3 bg-status-loss/10 border border-status-loss/20 rounded-xl flex items-center gap-2 text-status-loss text-sm">
            <XCircle className="w-4 h-4 flex-shrink-0" />{statusMsg}
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block mb-2">Type</label>
            <div className="flex gap-2">
              {(Object.entries(TYPE_CONFIG) as [keyof typeof TYPE_CONFIG, typeof TYPE_CONFIG[keyof typeof TYPE_CONFIG]][]).map(([key, cfg]) => (
                <button key={key} type="button" onClick={() => setType(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${type === key ? cfg.bg + " " + cfg.color : "bg-bg-elevated border-border text-text-secondary"}`}>
                  <cfg.icon className="w-3 h-3" />{cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block mb-2">Destinataires</label>
            <select value={segment} onChange={e => setSegment(e.target.value)}
              className="w-full px-3 py-2.5 bg-bg-elevated border border-border text-text-secondary text-sm rounded-xl focus:border-gold-primary/50 focus:outline-none">
              {SEGMENT_CONFIG.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block mb-2">
              Titre <span className="text-text-muted normal-case font-normal">(max 60 caractères)</span>
            </label>
            <input value={titre} onChange={e => setTitre(e.target.value.slice(0, 60))}
              placeholder="Ex : 🏇 Quinté+ gagnant aujourd'hui !"
              className="w-full px-3 py-2.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-xl focus:border-gold-primary/50 focus:outline-none placeholder:text-text-muted" />
            <p className="text-text-muted text-xs mt-1 text-right">{titre.length}/60</p>
          </div>

          <div>
            <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block mb-2">
              Message <span className="text-text-muted normal-case font-normal">(max 200 caractères)</span>
            </label>
            <textarea value={message} onChange={e => setMessage(e.target.value.slice(0, 200))} rows={3}
              placeholder="Rédigez votre message ici..."
              className="w-full px-3 py-2.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-xl focus:border-gold-primary/50 focus:outline-none placeholder:text-text-muted resize-none" />
            <p className="text-text-muted text-xs mt-1 text-right">{message.length}/200</p>
          </div>

          <button type="submit" disabled={status === "loading" || !titre.trim() || !message.trim()}
            className="w-full py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {status === "loading" ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi...</> : <><Send className="w-4 h-4" /> Envoyer</>}
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
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gold-primary" /></div>
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-text-muted text-sm">Aucune notification envoyée</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(n => {
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
                    {(n.successful ?? 0) > 0 && <span className="text-status-win font-medium">✓ {n.successful} reçues</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Onglet SMS ───────────────────────────────────────────────────────────────

const SMS_PREFIX   = "EliteTurf : ";
const SMS_SUFFIX   = " elite-turf.fr";
const SMS_MAX_BODY = 160 - SMS_PREFIX.length - SMS_SUFFIX.length; // 134 chars

type SmsSegment = "tous" | "premium" | "vip";

const SMS_SEGMENTS: { value: SmsSegment; label: string; sublabel: string; color: string }[] = [
  { value: "tous",    label: "Tous les abonnés",   sublabel: "Premium + VIP",           color: "text-gold-primary" },
  { value: "premium", label: "Pack Découverte/Pro", sublabel: "Abonnés Premium",         color: "text-blue-400" },
  { value: "vip",     label: "Pack Elite",          sublabel: "Abonnés VIP uniquement",  color: "text-purple-400" },
];

type CountsState = { tous: number | null; premium: number | null; vip: number | null };

function SMSTab() {
  const [message,   setMessage]   = useState("");
  const [segment,   setSegment]   = useState<SmsSegment>("tous");
  const [status,    setStatus]    = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [counts,    setCounts]    = useState<CountsState>({ tous: null, premium: null, vip: null });

  useEffect(() => {
    fetch("/api/sms/send")
      .then(r => r.json())
      .then(d => setCounts({ tous: d.tous ?? 0, premium: d.premium ?? 0, vip: d.vip ?? 0 }))
      .catch(() => {});
  }, []);

  const currentCount = counts[segment];
  const preview = message.trim()
    ? `${SMS_PREFIX}${message.trim().slice(0, SMS_MAX_BODY)}${SMS_SUFFIX}`
    : "";

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("loading");
    setStatusMsg("");
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), segment }),
      });
      const data = await res.json();
      if (!res.ok) { setStatus("error"); setStatusMsg(data.error || "Erreur"); return; }
      setStatus("success");
      setStatusMsg(`✓ SMS envoyé à ${data.envoyes} abonné(s)${data.echecs > 0 ? ` (${data.echecs} échec${data.echecs > 1 ? "s" : ""})` : ""}.`);
      setMessage("");
    } catch {
      setStatus("error"); setStatusMsg("Erreur réseau — réessayez");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Formulaire */}
      <div className="card-base p-6">
        <h2 className="font-semibold text-text-primary text-base mb-2 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gold-primary" />
          Alerte SMS
        </h2>
        <p className="text-text-muted text-xs mb-5">
          Envoyé aux abonnés ayant renseigné leur numéro de téléphone.
        </p>

        {/* Sélecteur de segment */}
        <div className="mb-5">
          <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block mb-2">
            Destinataires
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SMS_SEGMENTS.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSegment(s.value)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  segment === s.value
                    ? "bg-bg-card border-gold-primary/50"
                    : "bg-bg-elevated border-border hover:border-border/80"
                }`}
              >
                <p className={`text-xs font-bold mb-0.5 ${segment === s.value ? "text-gold-primary" : "text-text-primary"}`}>
                  {s.label}
                </p>
                <p className="text-text-muted text-xs">{s.sublabel}</p>
                <p className={`text-sm font-bold mt-1 ${s.color}`}>
                  {counts[s.value] === null ? "—" : counts[s.value]}
                </p>
              </button>
            ))}
          </div>
        </div>

        {status === "success" && (
          <div className="mb-4 p-3 bg-status-win/10 border border-status-win/20 rounded-xl flex items-center gap-2 text-status-win text-sm">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{statusMsg}
          </div>
        )}
        {status === "error" && (
          <div className="mb-4 p-3 bg-status-loss/10 border border-status-loss/20 rounded-xl flex items-center gap-2 text-status-loss text-sm">
            <XCircle className="w-4 h-4 flex-shrink-0" />{statusMsg}
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block mb-2">
              Corps du message <span className="text-text-muted normal-case font-normal">(max {SMS_MAX_BODY} caractères)</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, SMS_MAX_BODY))}
              rows={3}
              placeholder={`Ex: Quinté+ R1C4. Base: 12-7. Outsider: 15. Bonne chance !`}
              className="w-full px-3 py-2.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-xl focus:border-gold-primary/50 focus:outline-none placeholder:text-text-muted resize-none"
            />
            <p className="text-text-muted text-xs mt-1 text-right">{message.length}/{SMS_MAX_BODY}</p>
          </div>

          <button
            type="submit"
            disabled={status === "loading" || !message.trim() || (currentCount ?? 0) === 0}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {status === "loading"
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours...</>
              : <><Smartphone className="w-4 h-4" /> Envoyer à {currentCount ?? "—"} abonné{(currentCount ?? 0) > 1 ? "s" : ""}</>}
          </button>
        </form>
      </div>

      {/* Aperçu + info */}
      <div className="space-y-6">
        {/* Aperçu du SMS */}
        <div className="card-base p-6">
          <h3 className="font-semibold text-text-primary text-sm mb-4 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-text-muted" />
            Aperçu du SMS
          </h3>
          {/* Maquette téléphone */}
          <div className="bg-bg-elevated rounded-2xl p-4 border border-border max-w-xs mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-gold-primary/20 border border-gold-primary/40 flex items-center justify-center">
                <span className="text-gold-primary text-xs font-bold">E</span>
              </div>
              <span className="text-text-secondary text-xs font-semibold">EliteTurf</span>
              <span className="text-text-muted text-xs ml-auto">maintenant</span>
            </div>
            <div className="bg-bg-card rounded-xl p-3 border border-border">
              <p className="text-text-primary text-xs leading-relaxed break-words">
                {preview || <span className="text-text-muted italic">Rédigez votre message pour voir l&apos;aperçu…</span>}
              </p>
            </div>
            {preview && (
              <p className="text-text-muted text-xs mt-2 text-right">{preview.length} / 160 caractères</p>
            )}
          </div>
        </div>

        {/* Informations techniques */}
        <div className="card-base p-5 space-y-3">
          <h3 className="font-semibold text-text-primary text-sm">ℹ️ Informations</h3>
          {[
            { icon: "💰", text: "Coût estimé : ~0,05 € par SMS (variable selon le pays)" },
            { icon: "🌍", text: "Couverture : France, Belgique, Côte d'Ivoire, Sénégal, Maroc et +50 pays" },
            { icon: "⚡", text: "Livraison : moins de 2 minutes en général" },
            { icon: "📱", text: "Fonctionne sans internet — livraison directe sur le téléphone" },
            { icon: "🏇", text: "Disponible pour tous les abonnés payants (Découverte 5/mois · Pro · Elite illimité)" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="flex-shrink-0 text-sm">{item.icon}</span>
              <p className="text-text-secondary text-xs leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page principale avec onglets ────────────────────────────────────────────

export default function NotificationsPage() {
  const [onglet, setOnglet] = useState<"push" | "sms">("push");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold text-text-primary">Notifications & Alertes</h1>
        <p className="text-text-secondary text-sm mt-1">Push navigateur gratuit · Alertes SMS VIP premium</p>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 p-1 bg-bg-elevated border border-border rounded-xl w-fit">
        <button
          onClick={() => setOnglet("push")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            onglet === "push"
              ? "bg-gold-primary text-bg-primary"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <Bell className="w-4 h-4" />
          Push Notifications
        </button>
        <button
          onClick={() => setOnglet("sms")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            onglet === "sms"
              ? "bg-purple-600 text-white"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Alertes SMS
          <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full border border-purple-500/30">VIP</span>
        </button>
      </div>

      {onglet === "push" ? <PushTab /> : <SMSTab />}
    </div>
  );
}
