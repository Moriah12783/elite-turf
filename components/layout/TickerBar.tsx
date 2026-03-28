"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Trophy, Minus } from "lucide-react";

interface TickerItem {
  label:  string;
  result: string;
  status: "win" | "partial" | "pending";
}

// Données de fallback statiques si Supabase est indisponible
const FALLBACK_ITEMS: TickerItem[] = [
  { label: "R1 Vincennes",   result: "Quinté+ : Programme disponible à 8h00",  status: "pending" },
  { label: "R2 Longchamp",   result: "Tiercé : Sélection à venir",             status: "pending" },
  { label: "R3 Chantilly",   result: "Quarté+ : Nos experts analysent",        status: "pending" },
  { label: "Elite Turf",     result: "Pronostics PMU — Abonnez-vous",          status: "pending" },
];

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "win")     return <Trophy    className="w-3 h-3 text-status-win flex-shrink-0" />;
  if (status === "partial") return <Minus     className="w-3 h-3 text-status-partial flex-shrink-0" />;
  return                           <TrendingUp className="w-3 h-3 text-text-muted flex-shrink-0" />;
};

export default function TickerBar() {
  const [items, setItems] = useState<TickerItem[]>(FALLBACK_ITEMS);

  useEffect(() => {
    async function loadArrivees() {
      try {
        const res = await fetch("/api/ticker-data", { next: { revalidate: 900 } });
        if (!res.ok) return;
        const data: TickerItem[] = await res.json();
        if (data?.length) setItems(data);
      } catch {
        // Utilise le fallback
      }
    }
    loadArrivees();
    // Rafraîchir toutes les 15 min
    const interval = setInterval(loadArrivees, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const doubled = [...items, ...items];

  return (
    <div className="relative w-full overflow-hidden bg-bg-card/80 backdrop-blur-sm border-b border-gold-primary/15 h-9 flex items-center z-40">
      {/* Left fade */}
      <div className="absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-bg-card to-transparent z-10 pointer-events-none" />
      {/* Right fade */}
      <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-bg-card to-transparent z-10 pointer-events-none" />

      {/* Live badge */}
      <div className="absolute left-3 z-20 flex items-center gap-1.5 pr-3 border-r border-gold-primary/20">
        <span className="w-1.5 h-1.5 rounded-full bg-status-win animate-pulse flex-shrink-0" />
        <span className="text-gold-primary text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
          PMU Live
        </span>
      </div>

      {/* Scrolling track */}
      <div className="pl-[80px] overflow-hidden w-full">
        <div className="ticker-track">
          {doubled.map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-5 whitespace-nowrap">
              <StatusIcon status={item.status} />
              <span className="text-gold-light text-xs font-semibold">{item.label}</span>
              <span className="text-text-muted text-[11px]">—</span>
              <span className="text-text-secondary text-xs">{item.result}</span>
              <span className="text-gold-primary/30 text-xs ml-2">◆</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
