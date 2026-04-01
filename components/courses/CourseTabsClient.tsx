"use client";

import { useState, useCallback } from "react";
import {
  BarChart3, TrendingUp, Trophy, RefreshCw,
  ExternalLink, Users, Star, CheckCircle2,
  AlertCircle, ChevronUp, ChevronDown,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Partant {
  id: string;
  numero: number;
  nom_cheval: string;
  jockey?: string | null;
  entraineur?: string | null;
  cote?: number | null;
  musique?: string | null;
  poids_kg?: number | null;
}

interface CoteItem {
  numero: number;
  nom: string;
  cote: number | null;
  jockey?: string | null;
  poids?: number | null;
}

interface ArriveeItem {
  position: number;
  numero: number;
  nom: string | null;
}

interface Dividende {
  combinaison: string;
  rapport: number | null;
}

interface Rapport {
  typePari: string;
  label: string;
  dividendes: Dividende[];
}

type Tab = "partants" | "cotes" | "arrivees" | "stats";

interface Props {
  courseId: string;
  partants: Partant[];
  arriveeOfficielle?: number[] | null;
  pronosticSelection?: number[] | null;
  statut: string;
  genyUrl: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Couleur selon la cote (favori / outsider) */
function coteColor(cote: number | null) {
  if (!cote) return "text-text-muted";
  if (cote <= 2.5)  return "text-status-win font-bold";
  if (cote <= 5)    return "text-gold-light font-semibold";
  if (cote <= 10)   return "text-text-secondary";
  return "text-text-muted";
}

/** Largeur de la barre de probabilité (max cote prise en compte = 30) */
function coteProbBar(cote: number | null, maxCote: number) {
  if (!cote || maxCote === 0) return 0;
  const prob = 1 / cote;
  const maxProb = 1 / Math.max(1, Math.min(maxCote, 30));
  // normalisation relative
  return Math.min(100, Math.round((prob / (1 / 1)) * 100)); // simplification
}

/** Analyse la musique pour compter les top-3 récents */
function parseMusiqueStats(musique: string | null): { top3: number; courses: number } {
  if (!musique) return { top3: 0, courses: 0 };
  const results = musique.match(/\d+/g) ?? [];
  const nums = results.map(Number).filter((n) => n > 0);
  return {
    top3:    nums.filter((n) => n <= 3).length,
    courses: nums.length,
  };
}

// ── Composants internes ────────────────────────────────────────────────────

function TabButton({
  id, active, label, icon: Icon, badge, onClick,
}: {
  id: Tab; active: boolean; label: string; icon: any; badge?: string;
  onClick: (id: Tab) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
        active
          ? "border-gold-primary text-gold-light"
          : "border-transparent text-text-muted hover:text-text-secondary hover:border-border"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {badge && (
        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gold-faint text-gold-primary text-[9px] font-bold border border-gold-primary/30">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Tab : Partants ─────────────────────────────────────────────────────────

function TabPartants({
  partants, arriveeOfficielle, pronosticSelection, genyUrl,
}: {
  partants: Partant[];
  arriveeOfficielle?: number[] | null;
  pronosticSelection?: number[] | null;
  genyUrl: string;
}) {
  if (partants.length === 0) {
    return (
      <div className="p-8 text-center">
        <Users className="w-8 h-8 text-text-muted mx-auto mb-3" />
        <p className="text-text-secondary text-sm font-medium mb-1">
          Liste des partants non disponible
        </p>
        <p className="text-text-muted text-xs mb-4">
          Les partants seront disponibles la veille de la course
        </p>
        <a
          href={genyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold-faint hover:bg-gold-faint/80 text-gold-light border border-gold-primary/20 rounded-xl text-sm font-medium transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Voir sur Geny.com
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-bg-elevated/50">
              <th className="text-left px-4 py-2.5 text-text-muted text-xs font-semibold uppercase tracking-wider">N°</th>
              <th className="text-left px-4 py-2.5 text-text-muted text-xs font-semibold uppercase tracking-wider">Cheval</th>
              <th className="text-left px-4 py-2.5 text-text-muted text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Jockey / Entraîneur</th>
              <th className="text-left px-4 py-2.5 text-text-muted text-xs font-semibold uppercase tracking-wider hidden sm:table-cell">Musique</th>
              <th className="text-right px-4 py-2.5 text-text-muted text-xs font-semibold uppercase tracking-wider">Cote</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {partants.map((p) => {
              const inArrivee = arriveeOfficielle?.slice(0, 3).includes(p.numero);
              const selected  = pronosticSelection?.includes(p.numero);
              return (
                <tr
                  key={p.id}
                  className={`transition-colors ${
                    inArrivee ? "bg-status-win/5" :
                    selected  ? "bg-gold-faint/30" :
                    "hover:bg-bg-hover"
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      inArrivee ? "bg-status-win/20 border border-status-win/50 text-status-win" :
                      selected  ? "bg-gold-faint border border-gold-primary/50 text-gold-light" :
                      "bg-bg-elevated border border-border text-text-muted"
                    }`}>
                      {p.numero}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-semibold text-text-primary text-sm leading-tight">{p.nom_cheval}</p>
                        {p.poids_kg && <p className="text-text-muted text-xs">{p.poids_kg} kg</p>}
                      </div>
                      {selected && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold-faint text-gold-primary border border-gold-primary/30 font-bold uppercase">Sélec.</span>
                      )}
                      {inArrivee && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-status-win/20 text-status-win border border-status-win/30 font-bold uppercase">✓ Placé</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-text-secondary text-sm">{p.jockey || "—"}</p>
                    {p.entraineur && <p className="text-text-muted text-xs">Entr. {p.entraineur}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {p.musique ? (
                      <span className="font-mono text-xs text-text-secondary bg-bg-elevated px-2 py-1 rounded border border-border/50">{p.musique}</span>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.cote ? (
                      <span className={`font-bold text-sm ${
                        p.cote <= 3 ? "text-status-win" :
                        p.cote <= 7 ? "text-gold-light" : "text-text-secondary"
                      }`}>
                        {Number(p.cote).toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-border/30 flex items-center justify-between">
        <p className="text-text-muted text-xs">🟡 Sélection Elite Turf · ✓ Placé dans l'arrivée</p>
        <a
          href={genyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-gold-light hover:text-gold-primary transition-colors"
        >
          Geny.com <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </>
  );
}

// ── Tab : Côtes en direct ──────────────────────────────────────────────────

function TabCotes({ courseId, partants }: { courseId: string; partants: Partant[] }) {
  const [cotes, setCotes]     = useState<CoteItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/cotes`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur inconnue");
      setCotes(data.cotes ?? []);
      setLoadedOnce(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  // Charger automatiquement à la première affichage de cet onglet
  if (!loadedOnce && !loading && !error) {
    load();
  }

  const maxCote = cotes?.reduce((m, c) => (c.cote && c.cote > m ? c.cote : m), 1) ?? 1;

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center gap-3">
        <RefreshCw className="w-6 h-6 text-gold-primary animate-spin" />
        <p className="text-text-muted text-sm">Récupération des côtes PMU…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-6 h-6 text-status-loss mx-auto mb-2" />
        <p className="text-text-secondary text-sm mb-1">Côtes non disponibles</p>
        <p className="text-text-muted text-xs mb-4">{error}</p>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-bg-elevated hover:bg-bg-hover border border-border rounded-xl text-text-secondary text-sm transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Réessayer
        </button>
      </div>
    );
  }

  if (!cotes || cotes.length === 0) {
    // Fallback : utiliser les côtes Supabase si dispo
    const withCote = partants.filter((p) => p.cote);
    if (withCote.length > 0) {
      const sorted = [...partants].sort((a, b) => (a.cote ?? 99) - (b.cote ?? 99));
      return (
        <div>
          <div className="px-4 pt-3 pb-1">
            <p className="text-text-muted text-xs">Côtes issues de la base de données locale · <button onClick={load} className="text-gold-light hover:underline">Actualiser depuis PMU</button></p>
          </div>
          <CotesBars items={sorted.map((p) => ({ numero: p.numero, nom: p.nom_cheval, cote: p.cote ?? null, jockey: p.jockey ?? null, poids: p.poids_kg ?? null }))} maxCote={maxCote} />
        </div>
      );
    }
    return (
      <div className="p-8 text-center">
        <TrendingUp className="w-8 h-8 text-text-muted mx-auto mb-3" />
        <p className="text-text-secondary text-sm">Côtes non encore disponibles</p>
        <p className="text-text-muted text-xs mt-1">Les côtes sont publiées la veille de la course</p>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-text-muted text-xs">Côtes PMU temps réel · triées par probabilité</p>
        <button
          onClick={load}
          className="inline-flex items-center gap-1 text-xs text-gold-light hover:text-gold-primary transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Actualiser
        </button>
      </div>
      <CotesBars items={cotes} maxCote={maxCote} />
    </div>
  );
}

function CotesBars({ items, maxCote }: { items: CoteItem[]; maxCote: number }) {
  return (
    <div className="divide-y divide-border/20">
      {items.map((c, rank) => {
        const prob = c.cote ? Math.round((1 / c.cote) * 100) : 0;
        // Barre normalisée par rapport au favori (1er élément = 100%)
        const maxProb = items[0]?.cote ? (1 / items[0].cote) : 1;
        const barPct = c.cote ? Math.round(((1 / c.cote) / maxProb) * 92) : 0;

        return (
          <div key={c.numero} className="px-4 py-3">
            <div className="flex items-center gap-3 mb-1.5">
              {/* Rang */}
              <span className="w-5 text-center text-text-muted text-xs font-mono">{rank + 1}</span>
              {/* Numéro cheval */}
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                rank === 0 ? "bg-status-win/20 border border-status-win/40 text-status-win" :
                rank === 1 ? "bg-gold-faint border border-gold-primary/40 text-gold-light" :
                rank === 2 ? "bg-blue-500/10 border border-blue-500/30 text-blue-400" :
                "bg-bg-elevated border border-border text-text-muted"
              }`}>
                {c.numero}
              </span>
              {/* Nom */}
              <div className="flex-1 min-w-0">
                <p className="text-text-primary text-sm font-semibold truncate">{c.nom}</p>
                {c.jockey && <p className="text-text-muted text-xs truncate">{c.jockey}</p>}
              </div>
              {/* Cote */}
              <span className={`font-mono font-bold text-sm flex-shrink-0 ${
                !c.cote ? "text-text-muted" :
                c.cote <= 2.5 ? "text-status-win" :
                c.cote <= 5   ? "text-gold-light" :
                c.cote <= 10  ? "text-text-secondary" : "text-text-muted"
              }`}>
                {c.cote ? c.cote.toFixed(1) : "—"}
              </span>
              {/* Probabilité */}
              <span className="text-text-muted text-xs w-10 text-right">{prob ? `${prob}%` : "—"}</span>
            </div>
            {/* Barre de probabilité */}
            <div className="ml-8 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  rank === 0 ? "bg-status-win" :
                  rank === 1 ? "bg-gold-primary" :
                  rank === 2 ? "bg-blue-400" :
                  "bg-border"
                }`}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab : Arrivées & Rapports ──────────────────────────────────────────────

const POSITION_LABELS = ["1er", "2e", "3e", "4e", "5e"];
const POSITION_COLORS = [
  "bg-yellow-500/20 border-yellow-500/50 text-yellow-400",   // 1er
  "bg-gray-400/20 border-gray-400/40 text-gray-300",          // 2e
  "bg-orange-500/15 border-orange-500/40 text-orange-400",    // 3e
  "bg-bg-elevated border-border text-text-muted",             // 4e
  "bg-bg-elevated border-border text-text-muted",             // 5e
];

function TabArrivees({ courseId, statut, arriveeOfficielle, partants }: {
  courseId: string;
  statut: string;
  arriveeOfficielle?: number[] | null;
  partants: Partant[];
}) {
  const [data, setData]       = useState<{ arrivee: ArriveeItem[]; rapports: Rapport[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/courses/${courseId}/resultats`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur inconnue");
      setData({ arrivee: json.arrivee ?? [], rapports: json.rapports ?? [] });
      setLoadedOnce(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  if (!loadedOnce && !loading && !error) {
    load();
  }

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center gap-3">
        <RefreshCw className="w-6 h-6 text-gold-primary animate-spin" />
        <p className="text-text-muted text-sm">Récupération des résultats…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-6 h-6 text-status-loss mx-auto mb-2" />
        <p className="text-text-secondary text-sm mb-1">Résultats non disponibles</p>
        <p className="text-text-muted text-xs mb-4">{error}</p>
        <button onClick={load} className="inline-flex items-center gap-1.5 px-4 py-2 bg-bg-elevated hover:bg-bg-hover border border-border rounded-xl text-text-secondary text-sm transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Réessayer
        </button>
      </div>
    );
  }

  // Course pas encore terminée
  if (statut !== "TERMINE" && (!data || data.arrivee.length === 0)) {
    return (
      <div className="p-8 text-center">
        <Trophy className="w-8 h-8 text-text-muted mx-auto mb-3" />
        <p className="text-text-secondary text-sm font-medium mb-1">Course non terminée</p>
        <p className="text-text-muted text-xs mb-4">L'arrivée et les rapports seront disponibles après la course</p>
        {statut === "EN_COURS" && (
          <button onClick={load} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold-faint hover:bg-gold-faint/80 text-gold-light border border-gold-primary/20 rounded-xl text-sm font-medium transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Vérifier les résultats
          </button>
        )}
      </div>
    );
  }

  const arrivee = data?.arrivee ?? [];
  const rapports = data?.rapports ?? [];

  return (
    <div className="divide-y divide-border/30">
      {/* Arrivée officielle */}
      {arrivee.length > 0 && (
        <div className="p-4">
          <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-status-win" />
            Arrivée officielle
          </p>
          <div className="flex flex-wrap gap-3">
            {arrivee.map((item) => (
              <div key={item.position} className="flex flex-col items-center gap-1">
                <span className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-base ${POSITION_COLORS[item.position - 1] ?? POSITION_COLORS[4]}`}>
                  {item.numero}
                </span>
                <span className="text-text-muted text-[10px] font-medium">{POSITION_LABELS[item.position - 1]}</span>
                {item.nom && (
                  <span className="text-text-secondary text-[9px] max-w-[64px] text-center leading-tight">{item.nom}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rapports / Dividendes */}
      {rapports.length > 0 ? (
        <div className="p-4">
          <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3">
            Rapports PMU
          </p>
          <div className="space-y-2">
            {rapports.map((r, i) => (
              <div key={i} className="rounded-xl border border-border/50 overflow-hidden">
                <div className="px-3 py-2 bg-bg-elevated/60 flex items-center gap-2">
                  <Trophy className="w-3.5 h-3.5 text-gold-primary" />
                  <span className="text-text-secondary text-xs font-semibold">{r.label}</span>
                </div>
                <div className="divide-y divide-border/20">
                  {r.dividendes.map((d, j) => (
                    <div key={j} className="flex items-center justify-between px-3 py-2">
                      <span className="font-mono text-text-secondary text-sm">{d.combinaison}</span>
                      <span className="font-bold text-gold-light text-sm">
                        {d.rapport !== null ? `${d.rapport.toFixed(1)} €` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-text-muted text-[10px] mt-3">Rapports pour 1 € misé · Source PMU</p>
        </div>
      ) : statut === "TERMINE" ? (
        <div className="p-4 text-center">
          <p className="text-text-muted text-xs">Rapports non disponibles via API PMU</p>
          <p className="text-text-muted text-xs mt-1">Consultez PMU.fr ou Geny.com pour les dividendes</p>
        </div>
      ) : null}
    </div>
  );
}

// ── Tab : Statistiques ─────────────────────────────────────────────────────

function TabStats({ partants }: { partants: Partant[] }) {
  if (partants.length === 0) {
    return (
      <div className="p-8 text-center">
        <BarChart3 className="w-8 h-8 text-text-muted mx-auto mb-3" />
        <p className="text-text-muted text-sm">Statistiques disponibles après la publication des partants</p>
      </div>
    );
  }

  // Trier par cote (favoris)
  const sorted = [...partants].filter((p) => p.cote).sort((a, b) => (a.cote ?? 99) - (b.cote ?? 99));

  // Stats musique : top-3 récents
  const musicStats = partants
    .filter((p) => p.musique)
    .map((p) => {
      const { top3, courses } = parseMusiqueStats(p.musique!);
      return { ...p, top3, courses, ratio: courses > 0 ? top3 / courses : 0 };
    })
    .sort((a, b) => b.ratio - a.ratio);

  return (
    <div className="divide-y divide-border/30">
      {/* Favoris */}
      {sorted.length > 0 && (
        <div className="p-4">
          <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-gold-primary" />
            Top favoris (côtes)
          </p>
          <div className="space-y-2">
            {sorted.slice(0, 5).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 py-1">
                <span className="w-5 text-center text-text-muted text-xs font-mono">{i + 1}.</span>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? "bg-status-win/20 border border-status-win/40 text-status-win" :
                  i === 1 ? "bg-gold-faint border border-gold-primary/40 text-gold-light" :
                  "bg-bg-elevated border border-border text-text-muted"
                }`}>
                  {p.numero}
                </span>
                <div className="flex-1">
                  <p className="text-text-primary text-sm font-medium">{p.nom_cheval}</p>
                  {p.jockey && <p className="text-text-muted text-xs">{p.jockey}</p>}
                </div>
                <span className={`font-mono font-bold text-sm ${
                  p.cote! <= 3 ? "text-status-win" : p.cote! <= 7 ? "text-gold-light" : "text-text-secondary"
                }`}>
                  {p.cote!.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forme musicale */}
      {musicStats.length > 0 && (
        <div className="p-4">
          <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-gold-primary" />
            Meilleure forme récente (musique)
          </p>
          <div className="space-y-2">
            {musicStats.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  p.ratio >= 0.5 ? "bg-status-win/20 border border-status-win/40 text-status-win" :
                  p.ratio >= 0.3 ? "bg-gold-faint border border-gold-primary/40 text-gold-light" :
                  "bg-bg-elevated border border-border text-text-muted"
                }`}>
                  {p.numero}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-text-primary text-sm font-medium truncate">{p.nom_cheval}</p>
                    <span className="text-text-muted text-xs flex-shrink-0">{p.top3}/{p.courses} top-3</span>
                  </div>
                  <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.ratio >= 0.5 ? "bg-status-win" : p.ratio >= 0.3 ? "bg-gold-primary" : "bg-border"}`}
                      style={{ width: `${Math.round(p.ratio * 100)}%` }}
                    />
                  </div>
                </div>
                <span className={`text-xs font-bold flex-shrink-0 ${
                  p.ratio >= 0.5 ? "text-status-win" : p.ratio >= 0.3 ? "text-gold-light" : "text-text-muted"
                }`}>
                  {Math.round(p.ratio * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Résumé */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Partants",    value: partants.length },
            { label: "Avec côte",  value: partants.filter((p) => p.cote).length },
            { label: "Avec musique", value: partants.filter((p) => p.musique).length },
          ].map((s, i) => (
            <div key={i} className="p-3 bg-bg-elevated rounded-xl border border-border/50 text-center">
              <p className="text-text-primary font-bold text-lg">{s.value}</p>
              <p className="text-text-muted text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────

export default function CourseTabsClient({
  courseId,
  partants,
  arriveeOfficielle,
  pronosticSelection,
  statut,
  genyUrl,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("partants");

  const tabs: { id: Tab; label: string; icon: any; badge?: string }[] = [
    { id: "partants",  label: "Partants",           icon: Users,     badge: partants.length > 0 ? String(partants.length) : undefined },
    { id: "cotes",     label: "Côtes en direct",    icon: TrendingUp },
    { id: "arrivees",  label: "Arrivées & Rapports", icon: Trophy },
    { id: "stats",     label: "Statistiques",       icon: BarChart3 },
  ];

  return (
    <div className="card-base overflow-hidden">
      {/* Barre d'onglets */}
      <div className="flex overflow-x-auto border-b border-border bg-bg-elevated/30 scrollbar-hide">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            id={tab.id}
            active={activeTab === tab.id}
            label={tab.label}
            icon={tab.icon}
            badge={tab.badge}
            onClick={setActiveTab}
          />
        ))}
      </div>

      {/* Contenu */}
      {activeTab === "partants" && (
        <TabPartants
          partants={partants}
          arriveeOfficielle={arriveeOfficielle}
          pronosticSelection={pronosticSelection}
          genyUrl={genyUrl}
        />
      )}
      {activeTab === "cotes" && (
        <TabCotes courseId={courseId} partants={partants} />
      )}
      {activeTab === "arrivees" && (
        <TabArrivees
          courseId={courseId}
          statut={statut}
          arriveeOfficielle={arriveeOfficielle}
          partants={partants}
        />
      )}
      {activeTab === "stats" && (
        <TabStats partants={partants} />
      )}
    </div>
  );
}
