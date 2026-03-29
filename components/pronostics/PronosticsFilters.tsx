"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPES = [
  { value: "", label: "Tous" },
  { value: "SIMPLE", label: "Simple" },
  { value: "TIERCE", label: "Tiercé" },
  { value: "QUARTE", label: "Quarté+" },
  { value: "QUINTE_PLUS", label: "Quinté+" },
  { value: "COUPLE", label: "Couplé" },
];

const NIVEAUX = [
  { value: "", label: "Tous" },
  { value: "GRATUIT", label: "Gratuit" },
  { value: "PREMIUM", label: "Premium" },
  { value: "VIP", label: "VIP" },
];

const PERIODES = [
  { value: "", label: "Aujourd'hui" },
  { value: "semaine", label: "Cette semaine" },
  { value: "mois", label: "Ce mois" },
  { value: "30_jours", label: "30 derniers jours" },
];

interface Props {
  hippodromes: { nom: string }[];
  totalCount: number;
}

export default function PronosticsFilters({ hippodromes, totalCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = {
    type: searchParams.get("type") || "",
    niveau: searchParams.get("niveau") || "",
    periode: searchParams.get("periode") || "",
    hippodrome: searchParams.get("hippodrome") || "",
  };

  const hasFilters = Object.values(current).some(Boolean);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    router.push(pathname);
  }

  return (
    <div className="space-y-3">
      {/* Filter bar header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gold-primary" />
          <span className="text-text-secondary text-sm font-medium">
            {totalCount} pronostic{totalCount > 1 ? "s" : ""}
          </span>
        </div>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-text-muted hover:text-text-primary text-xs transition-colors"
          >
            <X className="w-3 h-3" />
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Filter pills rows */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-2 flex-nowrap sm:flex-wrap pb-1">
          {/* Type de pari */}
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setParam("type", t.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
                current.type === t.value
                  ? "bg-gold-primary text-bg-primary border-gold-primary"
                  : "bg-bg-elevated border-border text-text-secondary hover:border-gold-primary/40 hover:text-text-primary"
              )}
            >
              {t.label}
            </button>
          ))}

          <span className="text-border text-xs px-1 hidden sm:block">|</span>

          {/* Niveau */}
          {NIVEAUX.slice(1).map((n) => (
            <button
              key={n.value}
              onClick={() => setParam("niveau", current.niveau === n.value ? "" : n.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
                current.niveau === n.value
                  ? n.value === "GRATUIT"
                    ? "bg-status-win text-white border-status-win"
                    : n.value === "VIP"
                    ? "bg-purple-500 text-white border-purple-500"
                    : "bg-gold-primary text-bg-primary border-gold-primary"
                  : "bg-bg-elevated border-border text-text-secondary hover:border-gold-primary/40 hover:text-text-primary"
              )}
            >
              {n.value === "GRATUIT" ? "✓ " : n.value === "VIP" ? "★ " : "⭐ "}
              {n.label}
            </button>
          ))}

          <span className="text-border text-xs px-1 hidden sm:block">|</span>

          {/* Période */}
          {PERIODES.map((p) => (
            <button
              key={p.value}
              onClick={() => setParam("periode", p.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
                current.periode === p.value
                  ? "bg-bg-elevated border-gold-primary/60 text-gold-light"
                  : "bg-bg-elevated border-border text-text-secondary hover:border-gold-primary/40 hover:text-text-primary"
              )}
            >
              {p.label}
            </button>
          ))}

          {/* Hippodrome filter */}
          {hippodromes.length > 0 && (
            <>
              <span className="text-border text-xs px-1 hidden sm:block">|</span>
              <select
                value={current.hippodrome}
                onChange={(e) => setParam("hippodrome", e.target.value)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-bg-elevated border border-border text-text-secondary hover:border-gold-primary/40 transition-all cursor-pointer appearance-none pr-6 outline-none"
              >
                <option value="">Tous les hippodromes</option>
                {hippodromes.map((h) => (
                  <option key={h.nom} value={h.nom}>
                    {h.nom}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
