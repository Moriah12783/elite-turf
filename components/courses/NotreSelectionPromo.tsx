import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import type { NotreSelectionItem } from "@/lib/courses/notre-selection";

/**
 * Bloc promo « Notre sélection » (gratuite) — preuve de valeur + CTA vers le
 * produit premium. Deux variantes : `banner` (pleine largeur, haut de page,
 * mobile-first) et `sidebar` (carte verticale). Ne s'affiche pas si la
 * sélection est vide. Le ciblage (non-abonné) est décidé par l'appelant via
 * `shouldShowNotreSelectionPromo`.
 */
export function NotreSelectionPromo({
  items,
  variant,
}: {
  items: NotreSelectionItem[];
  variant: "banner" | "sidebar";
}) {
  if (!items || items.length === 0) return null;
  const numeros = items.map((i) => i.numero);

  const Pastilles = (
    <div className="flex flex-wrap gap-1.5">
      {numeros.map((n) => (
        <span
          key={n}
          className="w-7 h-7 rounded-full bg-bg-elevated border border-gold-primary/40 text-gold-light text-xs font-bold flex items-center justify-center"
        >
          {n}
        </span>
      ))}
    </div>
  );

  if (variant === "banner") {
    return (
      <div className="mb-4 rounded-2xl border border-gold-primary/30 bg-gradient-to-br from-gold-faint via-bg-elevated to-bg-elevated overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-gold-primary flex-shrink-0" />
              <h3 className="text-text-primary text-sm font-bold">
                Notre sélection — <span className="text-gold-light">gratuite</span> sur chaque course
              </h3>
            </div>
            <div className="mb-2">{Pastilles}</div>
            <p className="text-text-muted text-xs leading-relaxed">
              Notre lecture statistique pour{" "}
              <span className="text-text-secondary font-semibold">structurer vos paris</span> et comprendre la
              course. Différente de nos{" "}
              <span className="text-text-secondary font-semibold">pronostics du jour</span> (analyse experte
              réservée aux abonnés).
            </p>
          </div>
          <Link
            href="/pronostics"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-xs rounded-xl transition-all shadow-gold-sm whitespace-nowrap flex-shrink-0"
          >
            Voir les pronostics du jour <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // variant === "sidebar"
  return (
    <div className="card-base overflow-hidden border border-gold-primary/30">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-gold-primary flex-shrink-0" />
          <h3 className="text-text-primary text-sm font-bold">
            Notre sélection <span className="text-gold-light">gratuite</span>
          </h3>
        </div>
        <div className="mb-3">{Pastilles}</div>
        <p className="text-text-muted text-xs leading-relaxed mb-3">
          Lecture statistique pour structurer vos paris. Différente de nos pronostics du jour, réservés aux
          abonnés.
        </p>
        <Link
          href="/pronostics"
          className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-xs rounded-xl transition-all shadow-gold-sm"
        >
          Voir les pronostics du jour <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
