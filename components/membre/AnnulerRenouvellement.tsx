"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

interface Props {
  /** Date de fin (ISO) jusqu'à laquelle l'accès reste actif après annulation. */
  dateFin: string | null;
}

export default function AnnulerRenouvellement({ dateFin }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const router                      = useRouter();

  const dateFinFmt = dateFin
    ? new Date(dateFin).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/abonnement/annuler-renouvellement", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }
      setDone(true);
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Erreur réseau. Réessayez.");
    }
    setLoading(false);
  }

  if (done) {
    return (
      <p className="text-status-win text-xs">
        ✓ Renouvellement annulé. Votre accès reste actif jusqu&apos;au {dateFinFmt || "terme de la période"}.
      </p>
    );
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-text-muted hover:text-status-loss text-xs underline underline-offset-2 transition-colors"
      >
        Annuler le renouvellement automatique
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-text-secondary text-xs">
        Confirmer l&apos;annulation ? Vous gardez l&apos;accès jusqu&apos;au{" "}
        {dateFinFmt || "terme de la période"}, sans nouveau prélèvement.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          disabled={loading}
          className="px-3 py-1.5 bg-status-loss/10 hover:bg-status-loss/20 border border-status-loss/30 text-status-loss text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          Oui, annuler
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="px-3 py-1.5 bg-bg-elevated hover:bg-bg-hover border border-border text-text-secondary text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
        >
          Garder
        </button>
      </div>
      {error && <p className="text-status-loss text-xs">{error}</p>}
    </div>
  );
}
