"use client";

/**
 * components/leads/LeadCaptureCompact.tsx
 *
 * Bloc de capture email compact pour les pages publiques à fort trafic SEO
 * (ex: /quinte-plus/[date] — Clarity 14j : 91,8% de bounce, on capte le
 * visiteur avant qu'il reparte).
 *
 * ♻️ Réutilise le pipeline leads EXISTANT à l'identique :
 *    POST /api/guide/telechargement → insert `leads` (anti-doublon 23505)
 *    + envoi du Guide de l'Initié (Resend) + séquence cron lead-sequence.
 *    Le champ `source` permet de mesurer quelle page capture le mieux.
 *
 * 📊 Analytics : trackEvent("generate_lead", { source }) au succès
 *    (cf lib/analytics/track.ts — pas de PII dans le dataLayer).
 */

import { useState } from "react";
import { BookOpen, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics/track";
import CreerCompteCTA from "@/components/leads/CreerCompteCTA";

export default function LeadCaptureCompact({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/guide/telechargement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      trackEvent("generate_lead", { source });
      setDone(true);
    } catch {
      setError("Une erreur est survenue. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="mt-8 p-5 rounded-2xl bg-gold-faint border border-gold-primary/40">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-gold-primary flex-shrink-0" />
          <div>
            <p className="text-text-primary text-sm font-semibold">
              Guide envoyé ! Vérifiez votre boîte mail.
            </p>
            <p className="text-text-muted text-xs">
              Pensez à regarder les spams si besoin — expéditeur EliteTurf.
            </p>
          </div>
        </div>
        {/* Cet encart ne proposait RIEN après l'envoi — le lecteur repartait
            avec son PDF et sortait du parcours. */}
        <div className="mt-4">
          <CreerCompteCTA email={email} compact />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 p-5 rounded-2xl bg-gradient-to-r from-bg-card via-[#1A1610] to-bg-card border border-gold-primary/30">
      <div className="flex items-start gap-3 mb-3">
        <BookOpen className="w-5 h-5 text-gold-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-text-primary font-semibold text-sm">
            Recevez gratuitement le Guide de l&apos;Initié
          </p>
          <p className="text-text-muted text-xs">
            5 secrets d&apos;experts pour détecter les outsiders gagnants — envoyé par email.
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Votre email"
          aria-label="Votre adresse email"
          className="flex-1 px-4 py-2.5 rounded-xl bg-bg-elevated border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-gold-primary/60"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark disabled:opacity-60 text-bg-primary font-bold text-sm rounded-xl transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Recevoir le guide
        </button>
      </form>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
