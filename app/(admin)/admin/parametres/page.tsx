"use client";

import { useState } from "react";
import {
  Settings, Save, Eye, EyeOff, AlertTriangle,
  MessageCircle, Mail, Globe, Bell, Key
} from "lucide-react";

const INITIAL = {
  appName:       "Elite Turf",
  emailContact:  "contact@eliteturf.fr",
  whatsapp:      "+33 6 44 68 67 20",
  tickerText:    "R1 Vincennes — Quinté+ : Sélection disponible | R2 Longchamp — Tiercé : En attente | Abonnez-vous pour les pronostics complets",
  maintenance:   false,
  cinetpayKey:   "",
  cinetpaySite:  "",
  resendKey:     "",
};

export default function ParametresPage() {
  const [form, setForm] = useState(INITIAL);
  const [showCinetpay, setShowCinetpay] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof INITIAL, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setSaved(true);
    setLoading(false);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-text-primary">Paramètres</h1>
          <p className="text-text-secondary text-sm mt-1">Configuration générale de la plateforme</p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? "✓ Sauvegardé" : "Sauvegarder"}
        </button>
      </div>

      {/* Infos générales */}
      <Section title="Informations générales" icon={Globe}>
        <Field label="Nom de la plateforme">
          <input
            value={form.appName}
            onChange={e => update("appName", e.target.value)}
            className="input-admin"
            placeholder="Elite Turf"
          />
        </Field>
        <Field label="Email de contact">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              value={form.emailContact}
              onChange={e => update("emailContact", e.target.value)}
              className="input-admin pl-9"
              placeholder="contact@eliteturf.fr"
            />
          </div>
        </Field>
        <Field label="Numéro WhatsApp">
          <div className="relative">
            <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              value={form.whatsapp}
              onChange={e => update("whatsapp", e.target.value)}
              className="input-admin pl-9"
              placeholder="+33 6 44 68 67 20"
            />
          </div>
        </Field>
      </Section>

      {/* Ticker */}
      <Section title="Bandeau défilant (Ticker)" icon={Bell}>
        <Field label="Texte du ticker" hint="Séparés par ' | ' pour afficher plusieurs messages">
          <textarea
            value={form.tickerText}
            onChange={e => update("tickerText", e.target.value)}
            rows={3}
            className="input-admin resize-none"
            placeholder="R1 Vincennes — Quinté+ disponible | ..."
          />
        </Field>
        <p className="text-text-muted text-xs mt-1">
          Ce texte sera utilisé comme fallback si la synchronisation Supabase échoue.
        </p>
      </Section>

      {/* Mode maintenance */}
      <Section title="Mode maintenance" icon={Settings}>
        <div className="flex items-center justify-between p-4 bg-bg-elevated rounded-xl border border-border">
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${form.maintenance ? "text-status-partial" : "text-text-muted"}`} />
            <div>
              <p className="text-text-primary text-sm font-semibold">Mode maintenance</p>
              <p className="text-text-muted text-xs mt-0.5">
                Affiche une page de maintenance aux visiteurs. L&apos;admin reste accessible.
              </p>
            </div>
          </div>
          <button
            onClick={() => update("maintenance", !form.maintenance)}
            className={`relative w-12 h-6 rounded-full transition-colors ${form.maintenance ? "bg-status-partial" : "bg-bg-card border border-border"}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.maintenance ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>
      </Section>

      {/* Clés API */}
      <Section title="Clés API" icon={Key}>
        <div className="p-3 bg-status-partial/10 border border-status-partial/20 rounded-xl text-status-partial text-xs mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Ces champs sont masqués. Modifiez-les uniquement si vous changez de compte.
          En production, configurez ces valeurs via les variables d&apos;environnement Vercel.
        </div>

        <Field label="CinetPay — Clé API">
          <div className="relative">
            <input
              type={showCinetpay ? "text" : "password"}
              value={form.cinetpayKey}
              onChange={e => update("cinetpayKey", e.target.value)}
              className="input-admin pr-10"
              placeholder="••••••••••••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowCinetpay(!showCinetpay)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              {showCinetpay ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>

        <Field label="CinetPay — Site ID">
          <input
            type="text"
            value={form.cinetpaySite}
            onChange={e => update("cinetpaySite", e.target.value)}
            className="input-admin"
            placeholder="Votre site ID CinetPay"
          />
        </Field>

        <Field label="Resend — Clé API (emails)">
          <div className="relative">
            <input
              type={showResend ? "text" : "password"}
              value={form.resendKey}
              onChange={e => update("resendKey", e.target.value)}
              className="input-admin pr-10"
              placeholder="re_••••••••••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowResend(!showResend)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              {showResend ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
      </Section>

      <style jsx>{`
        .input-admin {
          width: 100%;
          padding: 0.625rem 0.75rem;
          background: var(--bg-elevated, #1A1A2E);
          border: 1px solid var(--border, #2A2A3E);
          color: var(--text-primary, #E8E8E8);
          font-size: 0.875rem;
          border-radius: 0.75rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-admin:focus {
          border-color: rgba(201,168,76,0.5);
        }
        .input-admin::placeholder {
          color: var(--text-muted, #6B6B8A);
        }
      `}</style>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="card-base p-6">
      <h2 className="font-semibold text-text-primary text-base mb-5 flex items-center gap-2 border-b border-border pb-4">
        <Icon className="w-4 h-4 text-gold-primary" />
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block mb-1.5">
        {label}
        {hint && <span className="ml-1.5 text-text-muted normal-case font-normal">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}
