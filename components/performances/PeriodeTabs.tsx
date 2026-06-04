/**
 * Barre de navigation temporelle de l'historique /performances.
 * Server component présentationnel : la période active vient des searchParams.
 * Chaque onglet re-scope le tableau via ?periode= tout en préservant ?formule=.
 *
 * Onglets : [Récents] [Juin 2026] [Mai 2026] … [Tout]
 * Scrollable horizontalement sur mobile (overflow-x-auto) pour absorber
 * l'historique qui grandit mois après mois.
 */
import Link from "next/link";
import type { PeriodeKey, PeriodeTab } from "@/lib/performances/periode-filter";

export default function PeriodeTabs({
  active,
  items,
  formule,
}: {
  active:  PeriodeKey;
  items:   PeriodeTab[];
  /** Formule active à préserver dans les liens (undefined = "tous"). */
  formule?: string;
}) {
  // Construit l'URL en préservant le filtre formule courant.
  const hrefFor = (key: PeriodeKey): string => {
    const params = new URLSearchParams();
    if (formule && formule !== "tous") params.set("formule", formule);
    // "recents" est le défaut → URL propre sans param periode
    if (key !== "recents") params.set("periode", key);
    const qs = params.toString();
    return qs ? `/performances?${qs}` : "/performances";
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <p className="text-text-muted text-xs uppercase tracking-wider mb-2 font-semibold">
        Naviguer dans l&apos;historique
      </p>
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
        <div className="flex items-center gap-2 flex-nowrap">
          {items.map((it) => {
            const isActive = it.key === active;
            return (
              <Link
                key={it.key}
                href={hrefFor(it.key)}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
                  isActive
                    ? "bg-gold-primary border-gold-primary text-bg-primary shadow-gold-sm"
                    : "bg-bg-elevated/80 border-border text-text-secondary hover:border-gold-primary/40 hover:text-text-primary"
                }`}
              >
                {it.label}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-bg-primary/20 text-bg-primary" : "bg-bg-card text-text-muted"
                  }`}
                >
                  {it.count}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
