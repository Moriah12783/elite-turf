"use client";

import { useState } from "react";
import { Mail, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

interface Props {
  context?: string; // slug de l'article pour tracking
}

export default function NewsletterSignup({ context }: Props) {
  const [email, setEmail]       = useState("");
  const [status, setStatus]     = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: context ? `blog-${context}` : "blog" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Une erreur s'est produite.");
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setMessage("Erreur de connexion. Réessayez.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl bg-status-win/10 border border-status-win/30 p-6 text-center">
        <CheckCircle2 className="w-10 h-10 text-status-win mx-auto mb-3" />
        <h3 className="font-serif font-bold text-text-primary text-lg mb-1">
          Bienvenue dans l'élite ! 🏆
        </h3>
        <p className="text-text-secondary text-sm">
          Votre pronostic gratuit du lendemain vous sera envoyé avant 8h00 (heure de Paris).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-bg-elevated to-bg-primary border border-gold-primary/30 p-6 sm:p-8">
      {/* Entête */}
      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center flex-shrink-0">
          <Mail className="w-6 h-6 text-gold-primary" />
        </div>
        <div>
          <h3 className="font-serif font-bold text-text-primary text-xl leading-tight">
            Recevez le Quinté+ du lendemain
            <span className="text-gold-primary"> gratuitement</span>
          </h3>
          <p className="text-text-secondary text-sm mt-1">
            Chaque soir, nos experts vous envoient leur sélection avant que les cotes ne bougent.
          </p>
        </div>
      </div>

      {/* Promesses */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {[
          { emoji: "🎯", text: "Pronostic gratuit chaque jour" },
          { emoji: "📊", text: "Analyse des partants incluse" },
          { emoji: "🔒", text: "Sans spam, désinscription libre" },
        ].map((item) => (
          <div key={item.text} className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="text-base">{item.emoji}</span>
            {item.text}
          </div>
        ))}
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre@email.com"
          required
          disabled={status === "loading"}
          className="flex-1 px-4 py-3 bg-bg-primary border border-border rounded-xl text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-gold-primary/60 focus:ring-1 focus:ring-gold-primary/30 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === "loading" || !email.trim()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {status === "loading" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Je m&apos;inscris
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {status === "error" && (
        <p className="text-status-loss text-xs mt-2">{message}</p>
      )}

      <p className="text-text-muted text-xs mt-3 text-center">
        Déjà <strong className="text-gold-light">+2 400 parieurs</strong> reçoivent nos conseils chaque matin.
      </p>
    </div>
  );
}
