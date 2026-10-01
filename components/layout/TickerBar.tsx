"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Trophy, Minus } from "lucide-react";
import { MESSAGES_ELITE_TURF, type TickerItem } from "@/lib/ticker/bandeau";

/*
 * Bandeau défilant (brief SEO du 01/10/2026, B4).
 *
 * Avant : il démarrait sur une liste INVENTÉE (« R1 Vincennes — Quinté+ :
 * Programme disponible à 8h00 ◆ R2 Longchamp… ») sous un badge « PMU Live »
 * clignotant. Rendue côté serveur, c'est elle que Google lisait sur toutes les
 * pages, quel que soit le jour.
 *
 * Désormais : rendu serveur VIDE (hauteur fixe, aucun décalage de mise en
 * page), puis les données réelles du jour (/api/ticker-data). Badge
 * « Aujourd'hui » — ce n'est pas un flux officiel du PMU — et point clignotant
 * seulement quand le bandeau contient de vraies données de course.
 */

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "win")     return <Trophy    className="w-3 h-3 text-status-win flex-shrink-0" />;
  if (status === "partial") return <Minus     className="w-3 h-3 text-status-partial flex-shrink-0" />;
  return                           <TrendingUp className="w-3 h-3 text-text-muted flex-shrink-0" />;
};

/** Un élément décrit une vraie course du jour (pas un message permanent). */
const estUneCourse = (i: TickerItem) => /^(⭐ )?R\d+C\d+ /.test(i.label);

export default function TickerBar() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    async function charger() {
      try {
        const res = await fetch("/api/ticker-data", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data: TickerItem[] = await res.json();
        setItems(Array.isArray(data) && data.length ? data : MESSAGES_ELITE_TURF);
      } catch {
        // Messages exacts plutôt qu'un bandeau vide ; jamais de fausses courses.
        setItems((actuels) => (actuels.length ? actuels : MESSAGES_ELITE_TURF));
      }
    }
    charger();
    // Rafraîchir toutes les 15 min
    const interval = setInterval(charger, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const enDirect = items.some(estUneCourse);
  const doubled = [...items, ...items];

  return (
    <div className="relative w-full overflow-hidden bg-bg-card/80 backdrop-blur-sm border-b border-gold-primary/15 h-9 flex items-center z-40">
      {/* Left fade */}
      <div className="absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-bg-card to-transparent z-10 pointer-events-none" />
      {/* Right fade */}
      <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-bg-card to-transparent z-10 pointer-events-none" />

      {/* Badge */}
      <div className="absolute left-3 z-20 flex items-center gap-1.5 pr-3 border-r border-gold-primary/20">
        {enDirect && <span className="w-1.5 h-1.5 rounded-full bg-status-win animate-pulse flex-shrink-0" />}
        <span className="text-gold-primary text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
          Aujourd&apos;hui
        </span>
      </div>

      {/* Scrolling track */}
      {items.length > 0 && (
        <div className="pl-[100px] overflow-hidden w-full">
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
      )}
    </div>
  );
}
