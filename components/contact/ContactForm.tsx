"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Formulaire de contact Elite Turf → email via Web3Forms (aucun backend).
 * La clé d'accès Web3Forms est PUBLIQUE par conception (elle transite côté
 * client) → hardcodée ici sans risque. La destination (email de réception) est
 * configurée dans le tableau de bord Web3Forms, pas ici.
 */
const WEB3FORMS_ACCESS_KEY = "1d8742a1-9494-44f2-ab17-c1a1b4f3f236";

const CATEGORIES = ["Abonnement", "Inscription", "Informations", "Problème de connexion"] as const;

const inputCls =
  "w-full px-4 py-3 rounded-xl bg-bg-elevated border border-border text-text-primary text-sm " +
  "placeholder:text-text-muted focus:outline-none focus:border-gold-primary/60 focus:ring-1 focus:ring-gold-primary/30 transition-colors";

export default function ContactForm() {
  const [nom, setNom]             = useState("");
  const [email, setEmail]         = useState("");
  const [categorie, setCategorie] = useState<string>(CATEGORIES[0]);
  const [message, setMessage]     = useState("");
  const [status, setStatus]       = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [err, setErr]             = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setErr("");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: `Elite Turf — ${categorie}`,
          from_name: "Contact Elite Turf",
          name: nom,
          email,
          categorie,
          message,
          botcheck: "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setStatus("ok");
        setNom(""); setEmail(""); setCategorie(CATEGORIES[0]); setMessage("");
      } else {
        setStatus("error");
        setErr(data?.message || "Envoi impossible. Réessayez, ou écrivez-nous sur WhatsApp ci-dessous.");
      }
    } catch {
      setStatus("error");
      setErr("Connexion impossible. Vérifiez votre réseau et réessayez.");
    }
  }

  if (status === "ok") {
    return (
      <div className="card-base p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-status-win/10 border border-status-win/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-status-win" />
        </div>
        <h2 className="font-serif text-xl font-bold text-text-primary mb-2">Message envoyé !</h2>
        <p className="text-text-secondary text-sm max-w-md mx-auto">
          Merci — notre équipe vous répond par email sous 24h ouvrées. Pour une réponse immédiate,
          le WhatsApp ci-dessous reste disponible.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-5 text-gold-light hover:text-gold-primary text-sm font-medium transition-colors"
        >
          Envoyer un autre message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card-base p-6 sm:p-8 space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-11 h-11 rounded-2xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center flex-shrink-0">
          <Send className="w-5 h-5 text-gold-primary" />
        </div>
        <div>
          <h2 className="font-serif font-bold text-text-primary">Écrivez-nous</h2>
          <p className="text-text-muted text-xs">Réponse par email sous 24h ouvrées.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="c-nom" className="block text-text-secondary text-xs font-medium mb-1.5">Nom</label>
          <input id="c-nom" name="nom" type="text" required autoComplete="name"
            value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Votre nom" className={inputCls} />
        </div>
        <div>
          <label htmlFor="c-email" className="block text-text-secondary text-xs font-medium mb-1.5">Email</label>
          <input id="c-email" name="email" type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@email.com" className={inputCls} />
        </div>
      </div>

      <div>
        <label htmlFor="c-cat" className="block text-text-secondary text-xs font-medium mb-1.5">Objet de votre demande</label>
        <select id="c-cat" name="categorie" required
          value={categorie} onChange={(e) => setCategorie(e.target.value)} className={inputCls}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="c-msg" className="block text-text-secondary text-xs font-medium mb-1.5">Message</label>
        <textarea id="c-msg" name="message" required rows={5}
          value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Décrivez votre demande…" className={`${inputCls} resize-y min-h-[120px]`} />
      </div>

      {/* Honeypot anti-spam (invisible pour l'humain) */}
      <input type="checkbox" name="botcheck" tabIndex={-1} autoComplete="off"
        className="hidden" style={{ display: "none" }} aria-hidden="true" />

      {status === "error" && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-status-loss/10 border border-status-loss/30 text-status-loss text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      )}

      <button type="submit" disabled={status === "sending"}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gold-primary hover:bg-gold-dark disabled:opacity-60 text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold">
        {status === "sending"
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</>
          : <><Send className="w-4 h-4" /> Envoyer le message</>}
      </button>
    </form>
  );
}
