"use client";

import { useState } from "react";
import {
  History, CheckCircle2, AlertCircle, Trophy, Minus, X,
  ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";

interface DateStat {
  arriveesTrouvees: number;
  pronosticsTraites: number;
  gagnants: number;
  partiels: number;
  perdants: number;
  skipped: number;
  erreurs: number;
}

interface BackfillResult {
  ok: boolean;
  dateDebut: string;
  dateFin: string;
  datesTraitees: number;
  parDate: Record<string, DateStat>;
  arriveesTrouvees: number;
  pronosticsTraites: number;
  gagnants: number;
  partiels: number;
  perdants: number;
  skipped: number;
  erreurs: number;
  tauxReussite: string;
  totalHistorique: number;
  timestamp?: string;
  error?: string;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function BackfillResultatsButton() {
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<BackfillResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [dateDebut, setDateDebut] = useState("2026-03-29");
  const [dateFin, setDateFin]     = useState(todayISO());

  async function handleBackfill() {
    setLoading(true);
    setResult(null);
    setError(null);
    setShowDetail(false);

    try {
      const res  = await fetch("/api/admin/backfill-resultats", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ dateDebut, dateFin }),
      });
      const data: BackfillResult = await res.json();

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

  const fmtDate = (d: string) =>
    new Date(d + "T00:00:00Z").toLocaleDateString("fr-FR", {
      day: "numeric", month: "short", year: "numeric",
    });

  return (
    <div className="space-y-4">
      {/* Sélection dates + bouton */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Du</label>
          <input
            type="date"
            value={dateDebut}
            onChange={e => setDateDebut(e.target.value)}
            className="px-3 py-2 rounded-lg bg-bg-elevated border border-border text-text-primary text-sm focus:outline-none focus:border-gold-primary/60"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Au</label>
          <input
            type="date"
            value={dateFin}
            onChange={e => setDateFin(e.target.value)}
            className="px-3 py-2 rounded-lg bg-bg-elevated border border-border text-text-primary text-sm focus:outline-none focus:border-gold-primary/60"
          />
        </div>
        <button
          onClick={handleBackfill}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-faint border border-gold-primary/40 text-gold-light font-semibold text-sm hover:bg-gold-primary hover:text-bg-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Rattrapage en cours… (peut prendre 1-2 min)" : "Rattraper les résultats"}
        </button>
      </div>

      {/* Résultats */}
      {result && (
        <div className="card-base border border-status-win/20 p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-status-win" />
              <span className="font-semibold text-text-primary text-sm">
                {result.pronosticsTraites} pronostic(s) mis à jour
                · {result.arriveesTrouvees} arrivée(s) récupérées
              </span>
            </div>
            <button onClick={() => setResult(null)} className="text-text-muted hover:text-text-secondary">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats globales */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-status-win/10 border border-status-win/20 rounded-xl">
              <Trophy className="w-4 h-4 text-status-win mx-auto mb-1" />
              <div className="text-status-win font-bold text-xl">{result.gagnants}</div>
              <div className="text-text-muted text-xs">Gagnants</div>
            </div>
            <div className="text-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <Minus className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
              <div className="text-yellow-400 font-bold text-xl">{result.partiels}</div>
              <div className="text-text-muted text-xs">Partiels</div>
            </div>
            <div className="text-center p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <X className="w-4 h-4 text-red-400 mx-auto mb-1" />
              <div className="text-red-400 font-bold text-xl">{result.perdants}</div>
              <div className="text-text-muted text-xs">Perdants</div>
            </div>
          </div>

          {/* Taux de réussite */}
          <div className="flex items-center justify-between py-3 px-4 bg-gold-faint border border-gold-primary/20 rounded-xl">
            <span className="text-text-secondary text-sm">Taux de réussite global (historique)</span>
            <span className="text-gold-primary font-bold text-lg">{result.tauxReussite}</span>
          </div>

          {/* Résumé */}
          <div className="text-xs text-text-muted space-y-1">
            <div className="flex justify-between">
              <span>Période traitée</span>
              <span className="text-text-secondary">{fmtDate(result.dateDebut)} → {fmtDate(result.dateFin)}</span>
            </div>
            <div className="flex justify-between">
              <span>Ignorés (pas encore de résultats)</span>
              <span className="text-text-secondary">{result.skipped}</span>
            </div>
            {result.erreurs > 0 && (
              <div className="flex justify-between text-red-400">
                <span>Erreurs</span>
                <span>{result.erreurs}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Pronostics terminés (total historique)</span>
              <span className="text-text-secondary">{result.totalHistorique}</span>
            </div>
          </div>

          {/* Détail par date */}
          {Object.keys(result.parDate).length > 0 && (
            <div>
              <button
                onClick={() => setShowDetail(!showDetail)}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                {showDetail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Détail par date
              </button>
              {showDetail && (
                <div className="mt-2 space-y-1.5 max-h-60 overflow-y-auto">
                  {Object.entries(result.parDate)
                    .filter(([, s]) => s.pronosticsTraites > 0 || s.skipped > 0 || s.arriveesTrouvees > 0)
                    .map(([date, s]) => (
                      <div
                        key={date}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-elevated border border-border/40 text-xs"
                      >
                        <span className="text-text-secondary font-mono">{date}</span>
                        <div className="flex items-center gap-3">
                          {s.arriveesTrouvees > 0 && (
                            <span className="text-blue-400">{s.arriveesTrouvees} arrivée(s)</span>
                          )}
                          {s.gagnants > 0 && (
                            <span className="text-status-win font-semibold">+{s.gagnants}G</span>
                          )}
                          {s.partiels > 0 && (
                            <span className="text-yellow-400">+{s.partiels}P</span>
                          )}
                          {s.perdants > 0 && (
                            <span className="text-red-400">-{s.perdants}</span>
                          )}
                          {s.pronosticsTraites === 0 && s.skipped === 0 && (
                            <span className="text-text-muted italic">aucun pronostic</span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 text-sm font-semibold">Erreur de rattrapage</p>
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
