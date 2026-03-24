"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, ArrowLeft, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
      });

      if (error) {
        toast.error("Erreur lors de l'envoi. Vérifiez votre email.");
        return;
      }

      setSent(true);
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="card-base p-6 sm:p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-status-win/10 border border-status-win/30 flex items-center justify-center mx-auto mb-5">
          <Check className="w-7 h-7 text-status-win" />
        </div>
        <h2 className="font-serif text-xl font-bold text-text-primary mb-3">Email envoyé !</h2>
        <p className="text-text-secondary text-sm mb-6">
          Un lien de réinitialisation a été envoyé à <strong>{email}</strong>.
          Vérifiez votre boîte de réception (et vos spams).
        </p>
        <Link href="/connexion" className="inline-flex items-center gap-2 text-gold-primary hover:text-gold-light text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="card-base p-6 sm:p-8">
      <Link href="/connexion" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-secondary text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Retour
      </Link>
      <h1 className="font-serif text-2xl font-bold text-text-primary mb-2">Mot de passe oublié</h1>
      <p className="text-text-secondary text-sm mb-6">
        Entrez votre email et nous vous enverrons un lien de réinitialisation.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-text-secondary text-sm font-medium mb-2">Adresse email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com"
            required
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gold-primary hover:bg-gold-dark disabled:opacity-60 text-bg-primary font-bold text-sm rounded-xl transition-all"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
          {loading ? "Envoi…" : "Envoyer le lien"}
        </button>
      </form>
    </div>
  );
}
