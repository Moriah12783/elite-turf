"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";

/**
 * Bouton "🪄 Tout pré-remplir & publier" pour /admin/arrivees.
 *
 * Appelle POST /api/admin/arrivees/batch-prefill-from-geny qui :
 *   1. Liste les courses sans arrivée_officielle ayant un geny_url
 *   2. Filtre celles dont heure_depart + 30 min est passée
 *   3. Fetch Geny + parse + upsert dans arrivees (pool 4 workers)
 *   4. Le trigger SQL trg_sync_arrivee_to_course propage vers courses
 *
 * Le bouton affiche un résumé à la fin (succès / échecs / ignorées).
 * Refresh la page pour voir les nouvelles arrivées.
 */

interface Props {
  /** Date sélectionnée (format "YYYY-MM-DD") — passée par le server component parent. */
  date: string;
}

interface BatchResultDetail {
  course_id: string;
  reference: string;
  status:    "saved" | "skipped" | "failed";
  arrivee?:  number[];
  error?:    string;
}

interface BatchResult {
  ok:        true;
  date:      string;
  total:     number;
  succeeded: number;
  failed:    number;
  skipped:   number;
  details:   BatchResultDetail[];
  message:   string;
}

export default function BatchPrefillButton({ date }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/arrivees/batch-prefill-from-geny", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        setIsLoading(false);
        return;
      }

      setResult(data as BatchResult);
      // Rafraîchit la liste des courses (les nouvelles arrivées apparaîtront)
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setIsLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
  }

  return (
    <div className="card-base p-4 border-l-4 border-purple-500/60 bg-purple-500/5">
      <div className="flex items-start gap-3">
        <Wand2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-text-primary font-semibold text-sm mb-1">
            Pré-remplir &amp; publier toutes les arrivées disponibles
          </h3>
          <p className="text-text-secondary text-xs leading-relaxed mb-3">
            Récupère automatiquement les arrivées Geny pour toutes les courses
            terminées ce jour-là (heure de départ + 30 min écoulée) et les
            publie en BDD. Cap dynamique :{" "}
            <strong className="text-text-primary">7 chevaux</strong> pour les
            Quinté+,{" "}
            <strong className="text-text-primary">6 chevaux</strong> pour le
            reste.
          </p>

          {/* Bouton principal */}
          <button
            type="button"
            onClick={handleClick}
            disabled={isLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              isLoading
                ? "bg-bg-elevated text-text-muted cursor-not-allowed"
                : "bg-purple-500 hover:bg-purple-600 text-white shadow-sm"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Traitement en cours… (peut prendre 30-60s)
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                🪄 Tout pré-remplir &amp; publier
              </>
            )}
          </button>

          {/* Résultat succès */}
          {result && (
            <div className="mt-3 p-3 rounded-lg bg-bg-elevated border border-border space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  {result.succeeded > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-status-win flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                  )}
                  <div className="text-sm">
                    <p className="text-text-primary font-medium">
                      {result.message}
                    </p>
                    <p className="text-text-muted text-xs mt-1">
                      Total: {result.total} ·{" "}
                      <span className="text-status-win">✅ {result.succeeded} publiées</span>{" "}
                      ·{" "}
                      <span className="text-status-loss">❌ {result.failed} échecs</span>{" "}
                      ·{" "}
                      <span className="text-text-secondary">⏳ {result.skipped} en attente</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="text-text-muted hover:text-text-secondary"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Liste détaillée des résultats (collapsible) */}
              {result.details.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary">
                    Voir le détail ({result.details.length})
                  </summary>
                  <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
                    {result.details.map((d) => (
                      <div
                        key={d.course_id}
                        className={`flex items-center justify-between gap-2 px-2 py-1 rounded text-xs ${
                          d.status === "saved"
                            ? "bg-status-win/5"
                            : d.status === "failed"
                            ? "bg-status-loss/5"
                            : ""
                        }`}
                      >
                        <span className="text-text-secondary font-mono">{d.reference}</span>
                        {d.status === "saved" && d.arrivee && (
                          <span className="text-status-win font-mono">
                            ✓ {d.arrivee.join("-")}
                          </span>
                        )}
                        {d.status === "failed" && (
                          <span className="text-status-loss truncate" title={d.error}>
                            ✗ {d.error?.slice(0, 50)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Erreur globale */}
          {error && (
            <div className="mt-3 p-3 rounded-lg bg-status-loss/5 border border-status-loss/30 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-status-loss flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-status-loss">{error}</div>
              <button
                type="button"
                onClick={reset}
                className="text-status-loss hover:text-status-loss/80"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
