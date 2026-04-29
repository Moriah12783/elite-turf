"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function TestPaystackPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/connexion?redirect=/paiement/test-paystack");
        return;
      }
      setUser({ id: data.user.id, email: data.user.email ?? "" });
      setChecking(false);
    });
  }, [router]);

  async function handlePay() {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/paystack/initier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: "test-paystack",
          userId: user.id,
          userEmail: user.email,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.paymentUrl) {
        setError(data.error || "Erreur lors de l'initialisation.");
        setLoading(false);
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg-primary">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="card-base border border-green-500/40 max-w-md w-full p-8 text-center space-y-6">
        <div className="space-y-2">
          <span className="inline-block px-3 py-1 bg-green-500/10 text-green-400 text-xs font-bold rounded-full border border-green-500/30 uppercase tracking-wider">
            Test interne
          </span>
          <h1 className="text-2xl font-serif font-bold text-text-primary">
            Valider le tunnel Paystack
          </h1>
          <p className="text-text-muted text-sm">
            Page réservée aux tests techniques.<br />
            Non visible par les abonnés.
          </p>
        </div>

        <div className="bg-bg-elevated border border-border rounded-xl p-5 text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Plan</span>
            <span className="font-semibold text-text-primary">Test technique</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Montant</span>
            <span className="font-bold text-green-400 text-lg">1 XOF</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Durée</span>
            <span className="font-semibold text-text-primary">1 jour</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Connecté en tant que</span>
            <span className="font-semibold text-text-primary truncate max-w-[180px]">{user?.email}</span>
          </div>
        </div>

        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirection vers Paystack…
            </>
          ) : (
            "Payer 1 XOF avec Paystack"
          )}
        </button>

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}

        <div className="text-left space-y-2 text-xs text-text-muted border-t border-border pt-4">
          <p className="font-semibold text-text-secondary">Ce test vérifie :</p>
          <ul className="space-y-1 list-none">
            {[
              "Redirection vers Paystack Checkout",
              "Paiement par Mobile Money (Wave / Orange / MTN) ou Carte",
              "Réception du webhook charge.success",
              "Activation de l'abonnement en base (profiles)",
              "Enregistrement de la transaction",
              "Redirection vers /paiement/succes",
              "Envoi de l'email de confirmation",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="text-green-400 mt-0.5">→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
