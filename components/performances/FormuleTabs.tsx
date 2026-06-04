/**
 * Barre segmentée des formules sur /performances. Server component
 * présentationnel : l'onglet actif vient des searchParams (pas de state).
 * Chaque pastille affiche taux + volume → la comparaison est visible, et le
 * clic re-scope la page via ?formule=.
 */
import Link from "next/link";
import type { FormuleKey } from "@/lib/performances/tier-stats";

export interface FormuleTabItem {
  key: FormuleKey;
  label: string;
  taux: number;
  total: number;
}

export default function FormuleTabs({
  active,
  items,
  periode,
}: {
  active: FormuleKey;
  items: FormuleTabItem[];
  /** Période active à préserver dans les liens (undefined/"recents" = défaut). */
  periode?: string;
}) {
  // Construit l'URL en préservant la période courante (navigation historique).
  const hrefFor = (key: FormuleKey): string => {
    const params = new URLSearchParams();
    if (key !== "tous") params.set("formule", key);
    if (periode && periode !== "recents") params.set("periode", periode);
    const qs = params.toString();
    return qs ? `/performances?${qs}` : "/performances";
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-1">
      <p className="text-center text-text-muted text-xs uppercase tracking-wider mb-3">
        Performances par formule
      </p>
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {items.map((it) => {
          const isActive = it.key === active;
          const href = hrefFor(it.key);
          return (
            <Link
              key={it.key}
              href={href}
              scroll={false}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center min-w-[88px] px-4 py-2.5 rounded-xl border transition-all ${
                isActive
                  ? "bg-gold-primary border-gold-primary text-bg-primary shadow-gold-sm"
                  : "bg-bg-elevated/80 border-border text-text-secondary hover:border-gold-primary/40 hover:text-text-primary"
              }`}
            >
              <span className="text-sm font-bold leading-tight">{it.label}</span>
              <span className={`text-xs mt-0.5 ${isActive ? "text-bg-primary/80" : "text-text-muted"}`}>
                {it.total > 0 ? `${it.taux}% · ${it.total}` : "—"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
