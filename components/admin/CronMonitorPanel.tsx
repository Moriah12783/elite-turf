"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, Clock, RefreshCw, Play, MinusCircle, GitBranch, ExternalLink } from "lucide-react";

interface CronJobStatus {
  cronName:       string;
  label:          string;
  schedule:       string;
  lastStatus:     "success" | "failure" | "skip" | "never";
  lastRun:        string | null;
  lastDuration:   number | null;
  lastDetails:    Record<string, unknown> | null;
  /** si présent : job sur GitHub Actions (IP propre) → pas de statut cron_logs */
  githubWorkflow?: string | null;
}

const GH_ACTIONS_BASE = "https://github.com/Moriah12783/elite-turf/actions/workflows/";

// Mapping cron → target force-sync
const FORCE_TARGETS: Record<string, string> = {
  "pmu-sync":      "pmu-today",
  "pmu-demain":    "pmu-demain",
  "lonaci-sync":   "lonaci",
  "geny-arrivees": "arrivees",
  "sync-resultats":"resultats",
  "source-evidence-collector": "evidence",
  "ia-pronostics-v2":          "ia-pronostics",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Résumé compact des compteurs GenyBet (jour / J+1 / arrivées) pour la ligne. */
function genybetSummary(details: Record<string, unknown> | null): string | null {
  if (!details) return null;
  const jour = details.jour_courses;
  if (typeof jour !== "number") return null;
  const j1 = details.j1_courses;
  const arr = details.jour_arrivees;
  return `jour ${jour}`
    + (typeof j1 === "number" ? ` · J+1 ${j1}` : "")
    + (typeof arr === "number" ? ` · ${arr} arrivées` : "");
}

const STATUS_CONFIG = {
  success: { icon: CheckCircle2, color: "text-status-win",     bg: "bg-status-win/10 border-status-win/20",     label: "OK" },
  failure: { icon: XCircle,      color: "text-status-loss",    bg: "bg-status-loss/10 border-status-loss/20",   label: "ÉCHEC" },
  skip:    { icon: MinusCircle,  color: "text-text-muted",     bg: "bg-bg-elevated border-border",              label: "IGNORÉ" },
  never:   { icon: Clock,        color: "text-text-muted",     bg: "bg-bg-elevated border-border",              label: "JAMAIS" },
};

export default function CronMonitorPanel() {
  const [crons,     setCrons]     = useState<CronJobStatus[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [forcing,   setForcing]   = useState<string | null>(null);
  const [feedback,  setFeedback]  = useState<{ cronName: string; ok: boolean; msg: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cron-status");
      const data: CronJobStatus[] = await res.json();
      setCrons(data);
    } catch { /* silently ignore */ }
    finally { setLoading(false); }
  }, []);

  // Initial fetch + auto-refresh toutes les 60 secondes
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  async function handleForce(cronName: string) {
    const target = FORCE_TARGETS[cronName];
    if (!target || forcing) return;

    setForcing(cronName);
    setFeedback(null);

    try {
      const res = await fetch("/api/admin/force-sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ target }),
      });
      const data = await res.json();
      setFeedback({
        cronName,
        ok:  res.ok,
        msg: res.ok
          ? `✅ Terminé en ${data.duration_ms}ms — ${data.result?.inserted ?? data.result?.evidence_inserted ?? data.result?.drafts_needs_review ?? data.result?.traites ?? data.result?.courses ?? "OK"}`
          : `❌ ${data.error ?? data.result?.error ?? `HTTP ${res.status}`}`,
      });

      // Update optimistique immédiat — évite la race condition Supabase
      // (le badge affichait l'ancien statut si fetchStatus tournait avant
      // que l'insert dans cron_logs soit propagé)
      setCrons((prev) =>
        prev.map((c) =>
          c.cronName === cronName
            ? {
                ...c,
                lastStatus:   res.ok ? "success" : "failure",
                lastRun:      new Date().toISOString(),
                lastDuration: typeof data.duration_ms === "number" ? data.duration_ms : c.lastDuration,
                lastDetails:  (data.result ?? null) as Record<string, unknown> | null,
              }
            : c
        )
      );

      // Re-fetch en backup après un petit délai pour laisser Supabase propager
      setTimeout(() => { fetchStatus(); }, 1500);
    } catch {
      setFeedback({ cronName, ok: false, msg: `❌ Erreur réseau` });
    } finally {
      setForcing(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold text-text-primary">
          Monitoring des Automatisations
        </h2>
        <button
          onClick={() => { setLoading(true); fetchStatus(); }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-gold-light border border-border hover:border-gold-primary/30 rounded-lg transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Rafraîchir
        </button>
      </div>

      {/* Grid */}
      <div className="card-base divide-y divide-border/30">
        {loading && crons.length === 0 ? (
          <div className="p-8 flex items-center justify-center gap-2 text-text-muted text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Chargement…
          </div>
        ) : (
          crons.map((cron) => {
            const cfg      = STATUS_CONFIG[cron.lastStatus];
            const StatusIcon = cfg.icon;
            const target   = FORCE_TARGETS[cron.cronName];
            const isForcingThis = forcing === cron.cronName;
            const fb = feedback?.cronName === cron.cronName ? feedback : null;
            // Job Geny sur GitHub Actions : cron_logs ne le voit pas (« JAMAIS »
            // trompeur) et « Forcer » taperait Geny depuis l'IP bloquée du Worker.
            const isGithub = !!cron.githubWorkflow;
            const hasStatus = cron.lastStatus !== "never";
            const gbSummary = cron.cronName === "genybet-health" ? genybetSummary(cron.lastDetails) : null;

            return (
              <div key={cron.cronName} className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-elevated/40 transition-colors">

                {/* Badge : statut réel si connu (cron_logs), sinon « Actions » pour
                    les jobs GitHub qui ne journalisent pas. */}
                {isGithub && !hasStatus ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold flex-shrink-0 w-24 justify-center bg-blue-500/10 border-blue-400/20">
                    <GitBranch className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-blue-400">Actions</span>
                  </div>
                ) : (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold flex-shrink-0 w-24 justify-center ${cfg.bg}`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    <span className={cfg.color}>{cfg.label}</span>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm font-medium">{cron.label}</p>
                  <p className="text-text-muted text-xs">
                    {cron.schedule}
                    {hasStatus && cron.lastRun && (
                      <span className="ml-2 text-text-muted/60">· {relativeTime(cron.lastRun)}</span>
                    )}
                    {hasStatus && cron.lastDuration && (
                      <span className="ml-2 text-text-muted/60">· {formatDuration(cron.lastDuration)}</span>
                    )}
                    {gbSummary && (
                      <span className="ml-2 text-status-win/70">· {gbSummary}</span>
                    )}
                    {isGithub && !hasStatus && (
                      <span className="ml-2 text-blue-400/70">· tourne sur GitHub Actions (IP propre)</span>
                    )}
                  </p>
                  {/* Feedback inline */}
                  {fb && (
                    <p className={`text-xs mt-1 ${fb.ok ? "text-status-win" : "text-status-loss"}`}>
                      {fb.msg}
                    </p>
                  )}
                </div>

                {/* Action : jobs Geny → lien GitHub Actions (le « Forcer » taperait
                    l'IP bloquée du Worker) ; autres → bouton Forcer classique. */}
                {isGithub ? (
                  <a
                    href={`${GH_ACTIONS_BASE}${cron.githubWorkflow}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Voir les runs réels sur GitHub Actions"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 rounded-lg transition-all flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Voir Actions
                  </a>
                ) : target ? (
                  <button
                    onClick={() => handleForce(cron.cronName)}
                    disabled={!!forcing}
                    title={`Forcer ${cron.label}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gold-light bg-gold-faint border border-gold-primary/30 hover:bg-gold-primary hover:text-bg-primary rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {isForcingThis
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Play className="w-3.5 h-3.5" fill="currentColor" />
                    }
                    {isForcingThis ? "En cours…" : "Forcer"}
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
