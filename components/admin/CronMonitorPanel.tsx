"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, Clock, RefreshCw, Play, MinusCircle } from "lucide-react";

interface CronJobStatus {
  cronName:     string;
  label:        string;
  schedule:     string;
  lastStatus:   "success" | "failure" | "skip" | "never";
  lastRun:      string | null;
  lastDuration: number | null;
  lastDetails:  Record<string, unknown> | null;
}

// Mapping cron → target force-sync
const FORCE_TARGETS: Record<string, string> = {
  "pmu-sync":      "pmu-today",
  "pmu-demain":    "pmu-demain",
  "lonaci-sync":   "lonaci",
  "geny-arrivees": "arrivees",
  "sync-resultats":"resultats",
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
          ? `✅ Terminé en ${data.duration_ms}ms — ${data.result?.inserted ?? data.result?.traites ?? "OK"}`
          : `❌ Erreur : ${data.error ?? "inconnue"}`,
      });
      // Rafraîchir le statut après force-sync
      await fetchStatus();
    } catch (err) {
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

            return (
              <div key={cron.cronName} className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-elevated/40 transition-colors">

                {/* Status badge */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold flex-shrink-0 w-24 justify-center ${cfg.bg}`}>
                  <StatusIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  <span className={cfg.color}>{cfg.label}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm font-medium">{cron.label}</p>
                  <p className="text-text-muted text-xs">
                    {cron.schedule}
                    {cron.lastRun && (
                      <span className="ml-2 text-text-muted/60">· {relativeTime(cron.lastRun)}</span>
                    )}
                    {cron.lastDuration && (
                      <span className="ml-2 text-text-muted/60">· {formatDuration(cron.lastDuration)}</span>
                    )}
                  </p>
                  {/* Feedback inline */}
                  {fb && (
                    <p className={`text-xs mt-1 ${fb.ok ? "text-status-win" : "text-status-loss"}`}>
                      {fb.msg}
                    </p>
                  )}
                </div>

                {/* Force button */}
                {target && (
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
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
