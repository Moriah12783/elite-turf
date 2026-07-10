"use client";

import { useEffect, useState } from "react";
import { Gauge, Loader2, TrendingUp, TrendingDown, Trophy, Bot, User, Cog, ListChecks, Radar } from "lucide-react";

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

interface ConsensusAgg {
  n: number; pctVainqueur: number; couvertureMoy: number; pctQuinte: number;
  nFavPresse: number; pctFavPresseWin: number; pctFavPressePlace: number;
  nFavMarche: number; pctFavMarcheWin: number; pctFavMarchePlace: number;
  nConvergence: number; pctConvergenceWin: number;
}
interface ConsRow {
  date: string; course: string | null; hippodrome: string | null;
  selection: number[]; favoriPresse: number | null; favoriMarche: number | null;
  arrivee: number[]; vainqueurHit: boolean; couverture: number; quinte: boolean;
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
  const [cons, setCons] = useState<ConsensusAgg | null>(null);
  const [consRows, setConsRows] = useState<ConsRow[]>([]);
  const [consLoading, setConsLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/banc-mesure?days=${days}`)
      .then((r) => r.json())
      .then((d) => { setMethods(d.methods || []); setTotal(d.total || 0); })
      .catch(() => { setMethods([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [days]);

  // Section consensus presse — fetch séparé (n'impacte pas le tableau existant).
  useEffect(() => {
    setConsLoading(true);
    fetch(`/api/admin/banc-mesure/consensus?days=${days}`)
      .then((r) => r.json())
      .then((d) => { setCons(d.consensus || null); setConsRows(d.rows || []); })
      .catch(() => { setCons(null); setConsRows([]); })
      .finally(() => setConsLoading(false));
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
              <span><span className="font-semibold">ROI basé sur le rapport DÉSORDRE</span> (le bon outcome d'un champ réduit), normalisé « pour 1€ » (Quinté+ ÷2), lu depuis les rapports PMU — l'« ordre » des colonnes publiques n'est PAS utilisé ici. Calculé là où le désordre est connu (voir <span className="font-mono">n=</span>, en rouge si &lt; 10).</span></p>
            <p className="flex items-start gap-2 text-status-loss"><TrendingDown className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span><span className="font-semibold">⚠️ Réserve</span> : tant que le parser désordre n'est pas durci + backfillé, les valeurs collectées restent <span className="font-semibold">bruitées</span> → <span className="font-semibold">ROI directionnel</span>. Une fois le backfill passé, fiable. Croise avec <span className="font-semibold">% Vainqueur / Couverture / Gagnant</span>.</span></p>
            <p className="text-text-muted">Échantillons par méthode parfois petits → lire les tendances, pas une course isolée. La ligne <span className="text-purple-400 font-semibold">Pipeline IA</span> est à comparer aux méthodes humaines.</p>
          </div>
        </>
      )}

      {/* ── CONSENSUS PRESSE — sélection du Radar vs arrivée (section ajoutée) ── */}
      <ConsensusSection cons={cons} rows={consRows} loading={consLoading} days={days} />
    </div>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated p-4">
      <p className="text-text-muted text-[11px] uppercase tracking-wider leading-tight">{label}</p>
      <p className={`font-serif text-2xl font-bold mt-1 ${accent ?? "text-text-primary"}`}>{value}</p>
      {sub && <p className="text-text-muted text-[11px] mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}

function ConsensusSection({ cons, rows, loading, days }: { cons: ConsensusAgg | null; rows: ConsRow[]; loading: boolean; days: number }) {
  return (
    <div className="space-y-4 pt-4 border-t border-border/50">
      <div>
        <h2 className="font-serif text-xl font-bold text-text-primary flex items-center gap-2.5">
          <Radar className="w-5 h-5 text-gold-primary" />
          Consensus presse — sélection vs arrivée
        </h2>
        <p className="text-text-secondary text-sm mt-1">
          Performance de la sélection du <span className="text-gold-primary font-semibold">Radar</span> (base+value+coup)
          + favori presse / favori marché, sur les vedettes résultées. La donnée s&apos;accumule chaque jour →
          matière pour caler le choix des chevaux.
        </p>
      </div>

      {loading ? (
        <div className="card-base p-8 flex items-center justify-center text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcul du consensus…
        </div>
      ) : !cons || cons.n === 0 ? (
        <div className="card-base p-8 text-center text-text-muted text-sm">
          Pas encore de vedette résultée avec consensus sur {days} jours — la donnée s&apos;accumule chaque jour,
          reviens dans quelques semaines pour caler la sélection.
        </div>
      ) : (
        <>
          <p className="text-text-muted text-xs">{cons.n} vedette(s) résultée(s) analysée(s) sur {days} jours.</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatTile label="Vainqueur couvert" value={`${cons.pctVainqueur}%`} sub={`dans la sélection`} accent="text-status-win" />
            <StatTile label="Quinté trouvé" value={`${cons.pctQuinte}%`} sub="les 5 couverts" accent="text-gold-light" />
            <StatTile label="Couverture moy." value={`${Math.round(cons.couvertureMoy * 100)}%`} sub="des N premiers" />
            <StatTile label="Favori presse" value={`${cons.pctFavPresseWin}%`} sub={`gagnant · ${cons.pctFavPressePlace}% placé (n=${cons.nFavPresse})`} accent="text-gold-light" />
            <StatTile label="Favori marché" value={`${cons.pctFavMarcheWin}%`} sub={`gagnant · ${cons.pctFavMarchePlace}% placé (n=${cons.nFavMarche})`} accent="text-blue-400" />
            <StatTile label="Convergence P=M" value={`${cons.pctConvergenceWin}%`} sub={`gagnant · ${cons.nConvergence} fois`} accent="text-status-win" />
          </div>

          <div className="card-base p-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Course</th>
                  <th className="text-left py-2 px-2">Sélection</th>
                  <th className="text-center py-2 px-2">F. presse</th>
                  <th className="text-center py-2 px-2">F. marché</th>
                  <th className="text-left py-2 px-2">Arrivée</th>
                  <th className="text-right py-2 px-2">Couv.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 px-2 text-text-secondary whitespace-nowrap">{r.date}</td>
                    <td className="py-2 px-2 text-text-muted whitespace-nowrap">{[r.hippodrome, r.course].filter(Boolean).join(" ")}</td>
                    <td className="py-2 px-2 text-text-secondary tabular-nums">{r.selection.join("-")}</td>
                    <td className="py-2 px-2 text-center text-gold-light font-semibold tabular-nums">{r.favoriPresse ?? "—"}</td>
                    <td className="py-2 px-2 text-center text-blue-400 font-semibold tabular-nums">{r.favoriMarche ?? "—"}</td>
                    <td className="py-2 px-2 text-text-primary font-medium whitespace-nowrap tabular-nums">{r.arrivee.join("-")}</td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <span className={r.quinte ? "text-status-win font-bold" : r.vainqueurHit ? "text-gold-light" : "text-text-muted"}>
                        {r.couverture}/5{r.quinte ? " ✓" : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-text-muted text-xs leading-relaxed">
            <span className="text-gold-light">F. presse</span> = le plus cité · <span className="text-blue-400">F. marché</span> = plus basse cote PMU.
            « Couv. » = combien des 5 premiers sont dans la sélection (✓ = les 5). Échantillon petit au début → lire les tendances, pas une course isolée.
          </p>
        </>
      )}
    </div>
  );
}
