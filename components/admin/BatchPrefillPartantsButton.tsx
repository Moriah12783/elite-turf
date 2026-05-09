"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw, AlertCircle, CheckCircle2, X, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";

interface BatchDetail {
  course_id: string;
  reference: string;
  libelle:   string;
  status:    "success" | "failed";
  partants?: number;
  error?:    string;
}

interface BatchResult {
  ok:       true;
  date:     string;
  total:    number;
  success:  number;
  failed:   number;
  duration: number;
  details:  BatchDetail[];
  message?: string;
}

/**
 * Bouton "Pré-remplir tous les partants du jour" sur le dashboard admin.
 *
 * Utilité : préparation rapide du programme du jour OU récupération si le
 * cron auto enrichir-partants tombe en panne. 1 clic au lieu de 30 sur
 * /admin/courses/[id]/partants.
 *
 * Workflow :
 *   1. Clic bouton → modal de confirmation avec date sélecteur
 *   2. Confirme → POST /api/admin/partants/batch-prefill?date=...
 *   3. Le serveur traite en pool de 4 workers en parallèle (~30s pour 30 courses)
 *   4. Modal de récap final avec liste success/failed
 *   5. Possibilité de voir les détails et de retry les échecs
 */
export default function BatchPrefillPartantsButton() {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [showModal,   setShowModal]   = useState(false);
  const [date,        setDate]        = useState(today);
  const [running,     setRunning]     = useState(false);
  const [result,      setResult]      = useState<BatchResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  async function runBatch() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/admin/partants/batch-prefill?date=${date}`,
        { method: "POST" },
      );
      const data = (await res.json()) as BatchResult | { error: string };
      if (!res.ok || !("ok" in data)) {
        const msg = "error" in data ? data.error : `HTTP ${res.status}`;
        toast.error(`Batch échoué : ${msg}`);
        setRunning(false);
        return;
      }

      setResult(data);
      if (data.total === 0) {
        toast(data.message || "Aucune course à traiter", { icon: "ℹ️" });
      } else if (data.failed === 0) {
        toast.success(`✅ ${data.success}/${data.total} courses pré-remplies`);
      } else {
        toast(
          `⚠️ ${data.success} OK, ${data.failed} échecs sur ${data.total} courses`,
          { icon: "⚠️", duration: 8000 },
        );
      }
      router.refresh(); // rafraîchir les stats du dashboard
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur réseau";
      toast.error(`Batch échoué : ${message}`);
    } finally {
      setRunning(false);
    }
  }

  function close() {
    if (running) return; // Ne pas fermer pendant l'exécution
    setShowModal(false);
    setResult(null);
    setShowDetails(false);
  }

  return (
    <>
      {/* Bouton trigger */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 font-semibold text-sm transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        Pré-remplir tous les partants du jour
      </button>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <div
            className="card-base max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-lg font-bold text-text-primary mb-1">
                  Pré-remplir tous les partants
                </h3>
                <p className="text-text-secondary text-sm">
                  Récupère depuis Geny les partants de toutes les courses
                  d&apos;une date qui n&apos;ont pas encore de partants en
                  base. Les courses déjà remplies sont ignorées.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={running}
                className="p-1 text-text-muted hover:text-text-primary transition-colors flex-shrink-0 disabled:opacity-50"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Date sélecteur */}
            {!result && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Date à traiter
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={running}
                  className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary text-sm font-mono focus:border-gold-primary focus:outline-none disabled:opacity-50"
                />
                <p className="text-xs text-text-muted mt-1">
                  Pool de 4 workers en parallèle. Compter ~30 sec pour 30 courses.
                </p>
              </div>
            )}

            {/* Loading */}
            {running && (
              <div className="rounded-lg bg-bg-elevated border border-border p-4 mb-4 text-center">
                <RefreshCw className="w-6 h-6 text-purple-400 animate-spin mx-auto mb-2" />
                <p className="text-text-primary text-sm font-medium">
                  Traitement en cours…
                </p>
                <p className="text-text-muted text-xs mt-1">
                  Ne pas fermer cette fenêtre. Le batch est en cours de fetch
                  Geny + insert DB pour chaque course.
                </p>
              </div>
            )}

            {/* Résultat */}
            {result && (
              <div className="space-y-3 mb-4">
                {/* Stats résumé */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="card-base p-3 text-center">
                    <div className="text-2xl font-bold text-text-primary">
                      {result.total}
                    </div>
                    <div className="text-text-muted text-xs">Total</div>
                  </div>
                  <div className="card-base p-3 text-center border-status-win/30">
                    <div className="text-2xl font-bold text-status-win">
                      {result.success}
                    </div>
                    <div className="text-text-muted text-xs">Succès</div>
                  </div>
                  <div className="card-base p-3 text-center border-status-loss/30">
                    <div className="text-2xl font-bold text-status-loss">
                      {result.failed}
                    </div>
                    <div className="text-text-muted text-xs">Échecs</div>
                  </div>
                </div>

                {/* Durée */}
                <div className="text-xs text-text-muted text-center">
                  Terminé en {(result.duration / 1000).toFixed(1)}s
                </div>

                {/* Message si rien à faire */}
                {result.total === 0 && result.message && (
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-sm text-text-secondary">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 inline mr-2" />
                    {result.message}
                  </div>
                )}

                {/* Toggle détails */}
                {result.details.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowDetails((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-bg-elevated border border-border text-text-secondary text-sm hover:border-gold-primary/40 transition-colors"
                  >
                    <span>{showDetails ? "Masquer" : "Voir"} les détails ({result.details.length} courses)</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? "rotate-180" : ""}`} />
                  </button>
                )}

                {/* Liste des détails (collapsible) */}
                {showDetails && (
                  <div className="space-y-1 max-h-64 overflow-y-auto rounded-lg border border-border p-2 bg-bg-elevated/30">
                    {result.details.map((d) => (
                      <div
                        key={d.course_id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                          d.status === "success"
                            ? "bg-status-win/10 text-status-win"
                            : "bg-status-loss/10 text-status-loss"
                        }`}
                      >
                        {d.status === "success" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        )}
                        <span className="font-mono font-bold flex-shrink-0">
                          {d.reference}
                        </span>
                        <span className="text-text-secondary truncate flex-1">
                          {d.libelle}
                        </span>
                        {d.status === "success" ? (
                          <span className="text-text-muted flex-shrink-0">
                            {d.partants} partants
                          </span>
                        ) : (
                          <span className="text-text-muted truncate flex-shrink-0 max-w-[200px]" title={d.error}>
                            {d.error?.slice(0, 30)}…
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-2">
              {!result && (
                <>
                  <button
                    type="button"
                    onClick={close}
                    disabled={running}
                    className="px-4 py-2 rounded-lg bg-bg-elevated hover:bg-bg-hover border border-border text-text-secondary text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={runBatch}
                    disabled={running}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                  >
                    {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {running ? "En cours…" : "Lancer le batch"}
                  </button>
                </>
              )}
              {result && !running && (
                <button
                  type="button"
                  onClick={close}
                  className="px-4 py-2 rounded-lg bg-gold-primary hover:bg-gold-dark text-bg-primary text-sm font-semibold transition-colors"
                >
                  Fermer
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
