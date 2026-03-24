"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import {
  CreditCard, Smartphone, CheckCircle, XCircle,
  AlertTriangle, ArrowLeft, Loader2, Lock
} from "lucide-react";

const METHODS = [
  { id: "orange", label: "Orange Money", emoji: "🟠", color: "border-orange-500/50 hover:border-orange-500" },
  { id: "mtn",    label: "MTN MoMo",     emoji: "🟡", color: "border-yellow-500/50 hover:border-yellow-500" },
  { id: "wave",   label: "Wave",          emoji: "🔵", color: "border-blue-500/50 hover:border-blue-500"   },
  { id: "card",   label: "Visa / Mastercard", emoji: "💳", color: "border-border hover:border-gold-primary/60" },
];

function SandboxContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tx      = searchParams.get("tx")      || "ET-SANDBOX";
  const planId  = searchParams.get("plan")    || "pro";
  const montant = searchParams.get("montant") || "15000";
  const nom     = searchParams.get("nom")     || "Pro";

  const [method, setMethod]   = useState("");
  const [phone, setPhone]     = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState<"choose" | "confirm" | "processing">("choose");

  function handlePay() {
    if (!method) return;
    setStep("confirm");
  }

  function handleConfirm() {
    setLoading(true);
    setStep("processing");
    // Simuler un délai de validation (2 secondes)
    setTimeout(() => {
      router.push(`/paiement/succes?tx=${tx}&plan=${planId}&sandbox=1`);
    }, 2500);
  }

  function handleCancel() {
    router.push(`/paiement/echec?tx=${tx}`);
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full">

        {/* Bandeau sandbox */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-status-partial/10 border border-status-partial/30 rounded-xl mb-6 text-center justify-center">
          <AlertTriangle className="w-4 h-4 text-status-partial flex-shrink-0" />
          <span className="text-status-partial text-xs font-semibold">
            MODE TEST — Aucun débit réel
          </span>
        </div>

        {/* Header */}
        <div className="card-base p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-text-muted text-xs uppercase tracking-wider font-semibold">
              Récapitulatif
            </p>
            <Lock className="w-4 h-4 text-status-win" />
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-text-primary font-bold text-lg">Plan {nom}</p>
              <p className="text-text-muted text-xs">Abonnement 30 jours · Elite Turf</p>
            </div>
            <div className="text-right">
              <p className="text-gold-primary font-bold font-serif text-xl">
                {parseInt(montant).toLocaleString("fr-CI")}
              </p>
              <p className="text-text-muted text-xs">XOF</p>
            </div>
          </div>
          <p className="text-text-muted text-xs mt-3 font-mono bg-bg-elevated px-2 py-1 rounded">
            Réf : {tx}
          </p>
        </div>

        {/* Étape 1 : choix du moyen de paiement */}
        {step === "choose" && (
          <>
            <p className="text-text-secondary text-sm font-semibold mb-3">
              Choisissez votre moyen de paiement
            </p>
            <div className="space-y-2 mb-5">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    method === m.id
                      ? "border-gold-primary bg-gold-faint"
                      : `border-border bg-bg-card ${m.color}`
                  }`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className={`font-semibold text-sm ${method === m.id ? "text-gold-light" : "text-text-primary"}`}>
                    {m.label}
                  </span>
                  {method === m.id && (
                    <CheckCircle className="w-4 h-4 text-gold-primary ml-auto" />
                  )}
                </button>
              ))}
            </div>

            {/* Numéro de téléphone pour Mobile Money */}
            {["orange", "mtn", "wave"].includes(method) && (
              <div className="mb-5">
                <label className="block text-text-secondary text-sm font-medium mb-2">
                  <Smartphone className="w-4 h-4 inline mr-1.5" />
                  Numéro Mobile Money
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+225 07 00 00 00 00"
                  className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                />
                <p className="text-text-muted text-xs mt-1.5">
                  Vous recevrez une notification sur ce numéro.
                </p>
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={!method}
              className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CreditCard className="w-4 h-4" />
              Payer {parseInt(montant).toLocaleString("fr-CI")} XOF
            </button>

            <button
              onClick={handleCancel}
              className="w-full mt-3 flex items-center justify-center gap-2 text-text-muted text-sm hover:text-text-secondary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Annuler et retourner
            </button>
          </>
        )}

        {/* Étape 2 : confirmation */}
        {step === "confirm" && (
          <div className="card-base p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-gold-faint border border-gold-primary/30 flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-8 h-8 text-gold-primary" />
            </div>
            <h3 className="font-serif font-bold text-text-primary text-lg mb-2">
              Confirmez le paiement
            </h3>
            <p className="text-text-secondary text-sm mb-1">
              {["orange", "mtn", "wave"].includes(method)
                ? `Une notification va être envoyée sur ${phone || "votre téléphone"}.`
                : "Votre carte sera débitée."}
            </p>
            <p className="text-gold-primary font-bold font-serif text-2xl my-4">
              {parseInt(montant).toLocaleString("fr-CI")} XOF
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setStep("choose")}
                className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour
              </button>
              <button
                onClick={handleConfirm}
                className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Valider
              </button>
            </div>
            <button
              onClick={handleCancel}
              className="mt-3 flex items-center justify-center gap-2 text-status-loss text-sm hover:underline w-full"
            >
              <XCircle className="w-4 h-4" />
              Simuler un échec
            </button>
          </div>
        )}

        {/* Étape 3 : traitement */}
        {step === "processing" && (
          <div className="card-base p-8 text-center">
            <Loader2 className="w-12 h-12 text-gold-primary animate-spin mx-auto mb-4" />
            <h3 className="font-serif font-bold text-text-primary text-lg mb-2">
              Traitement en cours…
            </h3>
            <p className="text-text-secondary text-sm">
              Vérification du paiement auprès de l&apos;opérateur.
            </p>
            <div className="mt-4 space-y-1.5">
              {["Connexion sécurisée", "Validation opérateur", "Activation accès"].map((s, i) => (
                <div key={s} className={`flex items-center gap-2 text-xs justify-center ${i === 0 ? "text-status-win" : i === 1 ? "text-gold-primary" : "text-text-muted"}`}>
                  {i === 0 ? <CheckCircle className="w-3.5 h-3.5" /> : i === 1 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <div className="w-3.5 h-3.5 rounded-full border border-current opacity-40" />}
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function SandboxPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-primary animate-spin" />
      </div>
    }>
      <SandboxContent />
    </Suspense>
  );
}
