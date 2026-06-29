"use client";

import { useEffect, useState } from "react";
import { Gauge, Loader2, TrendingUp, TrendingDown, Trophy, Bot, User, Cog, ListChecks } from "lucide-react";

interface Method {
  source: string;
  n: number;
  nAvecRapport: number;
  pctVainqueur: number;
  couvertureMoy: number;
  pctGagnant: number;
  pctPartiel: number;
  pctPerdant: number;
  roiGlobal: number | null;
  tailleSelMoy: number;
}

const PERIODES = [
  { days: 30, label: "30 j" },
  { days: 90, label: "90 j" },
  { days: 120, label: "120 j" },
  { days: 365, label: "1 an" },
];

function libelleSource(s: string): { label: string; icon: typeof Bot } {
  if (s === "AI-MULTI-AGENT") return { label: "Pipeline IA (multi-agents)", icon: Bot };
  if (s === "ia-cron") return { label: "Ancienne pipeline (legacy)", icon: Cog };
  if (s === "ADMIN") return { label: "Humain — admin", icon: User };
  if (s === "(humain/legacy)") return { label: "Humain / legacy", icon: User };
  return { label: s, icon: ListChecks };
}

function Roi({ roi }: { roi: number | null }) {
  if (roi == null) return <span className="text-text-muted">—</span>;
  const pct = Math.round(roi * 100);
  const pos = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 font-bold ${pos ? "text-status-win" : "text-status-loss"}`}>
      {pos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {pos ? "+" : ""}{pct}%
    </span>
  );
}

export default function BancMesurePage() {
  const [days, setDays] = useState(120);
  const [methods, setMethods] = useState<Method[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/banc-mesure?days=${days}`)
      .then((r) => r.json())
      .then((d) => { setMethods(d.methods || []); setTotal(d.total || 0); })
      .catch(() => { setMethods([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-text-primary flex items-center gap-3">
            <Gauge className="w-6 h-6 text-gold-primary" />
            Banc de mesure
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Performance réelle par méthode (source), sur la période. KPI clé = <span className="text-gold-primary font-semibold">ROI champ réduit</span> (couvrir ≠ gagner).
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-bg-elevated border border-border rounded-xl p-1">
          {PERIODES.map((p) => (
            <button key={p.days} onClick={() => setDays(p.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                days === p.days ? "bg-gold-primary text-bg-primary" : "text-text-secondary hover:text-text-primary"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card-base p-10 flex items-center justify-center text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcul des métriques…
        </div>
      ) : methods.length === 0 ? (
        <div className="card-base p-10 text-center text-text-muted text-sm">Aucun pronostic résulté sur cette période.</div>
      ) : (
        <>
          <p className="text-text-muted text-xs">{total} pronostic(s) résulté(s) analysé(s) sur {days} jours.</p>

          <div className="card-base p-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border">
                  <th className="text-left py-2 px-2">Méthode</th>
                  <th className="text-right py-2 px-2">n</th>
                  <th className="text-right py-2 px-2">Vainqueur ✓</th>
                  <th className="text-right py-2 px-2">Couverture</th>
                  <th className="text-right py-2 px-2">Gagnant</th>
                  <th className="text-right py-2 px-2">Partiel</th>
                  <th className="text-right py-2 px-2">Perdant</th>
                  <th className="text-right py-2 px-2">ROI désordre</th>
                  <th className="text-right py-2 px-2">Taille sél.</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((m) => {
                  const { label, icon: Icon } = libelleSource(m.source);
                  const isPipeline = m.source === "AI-MULTI-AGENT";
                  return (
                    <tr key={m.source} className={`border-b border-border/50 ${isPipeline ? "bg-purple-400/5" : ""}`}>
                      <td className="py-2 px-2">
                        <span className="flex items-center gap-2 font-semibold text-text-primary">
                          <Icon className={`w-4 h-4 ${isPipeline ? "text-purple-400" : "text-text-muted"}`} />
                          {label}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-text-secondary">{m.n}</td>
                      <td className="py-2 px-2 text-right text-text-secondary">{m.pctVainqueur}%</td>
                      <td className="py-2 px-2 text-right text-text-muted">{m.couvertureMoy.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-status-win font-semibold">{m.pctGagnant}%</td>
                      <td className="py-2 px-2 text-right text-gold-light">{m.pctPartiel}%</td>
                      <td className="py-2 px-2 text-right text-status-loss">{m.pctPerdant}%</td>
                      <td className="py-2 px-2 text-right">
                        <Roi roi={m.roiGlobal} />
                        <span className={`block text-[10px] ${m.nAvecRapport < 10 ? "text-status-loss" : "text-text-muted"}`}>n={m.nAvecRapport}</span>
                      </td>
                      <td className="py-2 px-2 text-right text-text-muted">{m.tailleSelMoy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Légende */}
          <div className="card-base p-5 space-y-2 text-xs text-text-secondary">
            <p className="flex items-start gap-2"><Trophy className="w-3.5 h-3.5 text-gold-primary flex-shrink-0 mt-0.5" />
              <span><span className="font-semibold">Vainqueur ✓</span> = le 1er de l'arrivée est dans la sélection. <span className="font-semibold">Couverture</span> = combien des N premiers (5/4/3) sont couverts, en moyenne.</span></p>
            <p className="flex items-start gap-2"><TrendingUp className="w-3.5 h-3.5 text-gold-primary flex-shrink-0 mt-0.5" />
              <span><span className="font-semibold">ROI désordre</span> = rendement d'un champ réduit (coût = C(taille, N) combinaisons ; gain = rapport si couverture complète). <span className="text-text-muted">Hors Bonus 4/3 → conservateur. C'est le vrai juge : couvrir des favoris peut être une perte nette.</span></span></p>
            <p className="flex items-start gap-2"><TrendingUp className="w-3.5 h-3.5 text-gold-primary flex-shrink-0 mt-0.5" />
              <span><span className="font-semibold">ROI basé sur le rapport DÉSORDRE</span> (le bon outcome d'un champ réduit), lu depuis les rapports PMU — l'« ordre » des colonnes publiques n'est PAS utilisé ici. Calculé là où le désordre est connu (voir <span className="font-mono">n=</span>, en rouge si &lt; 10).</span></p>
            <p className="flex items-start gap-2 text-status-loss"><TrendingDown className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span><span className="font-semibold">⚠️ Réserve forte</span> : les désordre collectés sont <span className="font-semibold">bruités</span> (médiane anormalement basse → parsing Geny à durcir), et le rapport est pris par mise de base PMU → <span className="font-semibold">ROI directionnel, pas une vérité</span>. Décide surtout sur <span className="font-semibold">% Vainqueur / Couverture / Gagnant</span>.</span></p>
            <p className="text-text-muted">Échantillons par méthode parfois petits → lire les tendances, pas une course isolée. La ligne <span className="text-purple-400 font-semibold">Pipeline IA</span> est à comparer aux méthodes humaines.</p>
          </div>
        </>
      )}
    </div>
  );
}
