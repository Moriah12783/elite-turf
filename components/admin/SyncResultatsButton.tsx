"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Trophy, Minus, X } from "lucide-react";

interface SyncStats {
  ok: boolean;
  total: number;
  traites: number;
  gagnants: number;
  partiels: number;
  perdants: number;
  erreurs: number;
  skipped: number;
  tauxReussite: string;
  totalHistorique: number;
  timestamp?: string;
  message?: string;
  error?: string;
}

export default function SyncResultatsButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/sync-resultats", { method: "POST" });
      const data: SyncStats = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || `Erreur HTTP ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Bouton principal */}
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gold-faint border border-gold-primary/40 text-gold-light font-semibold text-sm hover:bg-gold-primary hover:text-bg-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Synchronisation en cours…" : "Synchroniser les résultats"}
      </button>

      {/* Résultats */}
      {result && (
        <div className="card-base border border-status-win/20 p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-status-win" />
              <span className="font-semibold text-text-primary text-sm">
                {result.message ?? `${result.traites} pronostic(s) mis à jour`}
              </span>
            </div>
            <button onClick={() => setResult(null)} className="text-text-muted hover:text-text-secondary">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-status-win/10 border border-status-win/20 rounded-xl">
              <Trophy className="w-4 h-4 text-status-win mx-auto mb-1" />
              <div className="text-status-win font-bold text-xl">{result.gagnants}</div>
              <div className="text-text-muted text-xs">Gagnants</div>
            </div>
            <div className="text-center p-3 bg-status-partial/10 border border-status-partial/20 rounded-xl">
              <Minus className="w-4 h-4 text-status-partial mx-auto mb-1" />
              <div className="text-status-partial font-bold text-xl">{result.partiels}</div>
              <div className="text-text-muted text-xs">Partiels</div>
            </div>
            <div className="text-center p-3 bg-status-loss/10 border border-status-loss/20 rounded-xl">
              <X className="w-4 h-4 text-status-loss mx-auto mb-1" />
              <div className="text-status-loss font-bold text-xl">{result.perdants}</div>
              <div className="text-text-muted text-xs">Perdants</div>
            </div>
          </div>

          {/* Taux de réussite global */}
          <div className="flex items-center justify-between py-3 px-4 bg-gold-faint border border-gold-primary/20 rounded-xl">
            <span className="text-text-secondary text-sm">Taux de réussite global (historique)</span>
            <span className="text-gold-primary font-bold text-lg">{result.tauxReussite}</span>
          </div>

          {/* Détail */}
          <div className="text-xs text-text-muted space-y-1">
            <div className="flex justify-between">
              <span>EN_ATTENTE trouvés</span>
              <span className="text-text-secondary">{result.total}</span>
            </div>
            <div className="flex justify-between">
              <span>Ignorés (course future ou sans arrivée)</span>
              <span className="text-text-secondary">{result.skipped}</span>
            </div>
            {result.erreurs > 0 && (
              <div className="flex justify-between text-status-loss">
                <span>Erreurs API</span>
                <span>{result.erreurs}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Pronostics terminés (total)</span>
              <span className="text-text-secondary">{result.totalHistorique}</span>
            </div>
            {result.timestamp && (
              <div className="flex justify-between pt-1 border-t border-border/40">
                <span>Exécuté le</span>
                <span className="text-text-secondary">
                  {new Date(result.timestamp).toLocaleString("fr-FR", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-status-loss/10 border border-status-loss/20 rounded-xl">
          <AlertCircle className="w-4 h-4 text-status-loss flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-status-loss text-sm font-semibold">Erreur de synchronisation</p>
            <p className="text-text-secondary text-xs mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-text-muted hover:text-text-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
