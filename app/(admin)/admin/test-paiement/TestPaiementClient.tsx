"use client";

import { useState } from "react";
import { Loader2, CreditCard, Smartphone, AlertTriangle } from "lucide-react";

interface Props {
  userId: string;
  userEmail: string;
}

type Rail = "stripe" | "paystack";

export default function TestPaiementClient({ userId, userEmail }: Props) {
  const [loading, setLoading] = useState<Rail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(rail: Rail) {
    setError(null);
    setLoading(rail);

    const endpoint =
      rail === "stripe" ? "/api/paiement/stripe/checkout" : "/api/paystack/initier";
    const planId = rail === "stripe" ? "test" : "test-paystack";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, userId, userEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.paymentUrl) {
        setError(data.error || "Échec de l'initialisation du paiement.");
        setLoading(null);
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      setError("Erreur réseau lors de l'initialisation.");
      setLoading(null);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-2xl font-bold text-text-primary mb-2">
        🧪 Test paiement (interne)
      </h1>
      <p className="text-text-secondary text-sm mb-5">
        Lance un vrai paiement à petit montant pour prouver la chaîne{" "}
        <strong className="text-text-primary">succès → abonnement</strong>. Connecté en
        tant que <span className="font-mono text-text-primary">{userEmail || "—"}</span>.
      </p>

      <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 mb-6 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
        <p className="text-text-secondary text-xs leading-relaxed">
          Page interne non listée, à supprimer après le test. Le plan « test » dure 1 jour ;
          pense à nettoyer l&apos;abonnement / la transaction de test ensuite. Après un
          paiement réussi, vérifie qu&apos;une ligne apparaît dans <code>abonnements</code>
          {" "}et que <code>profiles.statut_abonnement</code> a changé.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => run("stripe")}
          disabled={loading !== null || !userId}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-left"
        >
          {loading === "stripe" ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-400 flex-shrink-0" />
          ) : (
            <CreditCard className="w-5 h-5 text-blue-400 flex-shrink-0" />
          )}
          <div>
            <p className="text-text-primary font-semibold text-sm">
              Tester Stripe — Carte (1,00 €)
            </p>
            <p className="text-text-muted text-xs">
              Vérifie 3DS « automatic » + activation via le webhook Stripe.
            </p>
          </div>
        </button>

        <button
          onClick={() => run("paystack")}
          disabled={loading !== null || !userId}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-left"
        >
          {loading === "paystack" ? (
            <Loader2 className="w-5 h-5 animate-spin text-green-400 flex-shrink-0" />
          ) : (
            <Smartphone className="w-5 h-5 text-green-400 flex-shrink-0" />
          )}
          <div>
            <p className="text-text-primary font-semibold text-sm">
              Tester Paystack — Mobile Money / Carte (1 XOF)
            </p>
            <p className="text-text-muted text-xs">
              Active le rail Paystack même si le Mobile Money est en « bientôt » côté public.
              Si Paystack refuse 1 XOF (montant minimum), dis-le moi : je monte le test.
            </p>
          </div>
        </button>
      </div>

      {error && <p className="text-status-loss text-sm mt-4">{error}</p>}
    </div>
  );
}
