"use client";

import { useEffect, useState } from "react";

interface MonthData {
  mois: string;       // "Jan", "Fév"…
  taux: number;       // 0-100
  gagnants: number;
  total: number;
}

interface Props {
  data: MonthData[];
}

export default function MonthlyChart({ data }: Props) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 150);
    return () => clearTimeout(t);
  }, []);

  if (!data || data.length === 0) return null;

  const maxTaux = Math.max(...data.map((d) => d.taux), 100);
  const chartH   = 160; // px — hauteur utile des barres
  const target   = 50;  // % — ligne de référence (seuil rentabilité)

  return (
    <div className="w-full">
      {/* Légende */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gold-primary inline-block" />
          <span className="text-text-secondary">Taux de réussite mensuel</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-px bg-status-win/70 border-t border-dashed border-status-win/70 inline-block" />
          <span className="text-text-secondary">Objectif 50%</span>
        </div>
      </div>

      {/* Graph area */}
      <div className="relative" style={{ height: chartH + 40 }}>
        {/* Y-axis grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => {
          const y = chartH - (pct / maxTaux) * chartH;
          return (
            <div
              key={pct}
              className="absolute left-0 right-0 flex items-center gap-2"
              style={{ top: y }}
            >
              <span className="text-text-muted text-[10px] w-6 text-right flex-shrink-0">
                {pct}%
              </span>
              <div
                className={`flex-1 h-px ${
                  pct === target
                    ? "border-t border-dashed border-status-win/40"
                    : "bg-border/30"
                }`}
              />
            </div>
          );
        })}

        {/* Bars */}
        <div
          className="absolute flex items-end gap-1 sm:gap-2"
          style={{ left: 32, right: 0, bottom: 28, top: 0 }}
        >
          {data.map((d, i) => {
            const pct   = d.taux;
            const h     = animated ? (pct / maxTaux) * chartH : 0;
            const isGood = pct >= target;

            return (
              <div
                key={d.mois}
                className="flex-1 flex flex-col items-center gap-1 group"
              >
                {/* Taux value on hover */}
                <div
                  className="text-[10px] font-bold text-gold-light opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ minHeight: 16 }}
                >
                  {pct > 0 ? `${pct}%` : ""}
                </div>

                {/* Bar */}
                <div className="relative w-full flex items-end" style={{ height: chartH - 16 }}>
                  <div
                    className="w-full rounded-t-md transition-all duration-700 ease-out cursor-default"
                    style={{
                      height: h,
                      transitionDelay: `${i * 60}ms`,
                      background: isGood
                        ? "linear-gradient(to top, #A07830, #C9A84C, #E8D5A3)"
                        : "linear-gradient(to top, #2A2A3E, #3A3A50)",
                      boxShadow: isGood ? "0 0 12px rgba(201,168,76,0.25)" : "none",
                    }}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-bg-card border border-border rounded-lg px-2.5 py-1.5 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow-card">
                      <p className="text-gold-light font-bold">{pct}% réussite</p>
                      <p className="text-text-muted">{d.gagnants}/{d.total} gagnants</p>
                    </div>
                  </div>
                </div>

                {/* Month label */}
                <span className="text-[10px] text-text-muted mt-1 font-medium">{d.mois}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
