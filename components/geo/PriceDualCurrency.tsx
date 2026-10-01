/**
 * PriceDualCurrency — affichage prix avec devise primaire + équivalent secondaire.
 *
 * 2 modes selon le contexte :
 *
 *  mode="local-primary" (pages géo /pronostics-pmu-[pays]) :
 *    Équivalent local en GROS, marqué « ≈ » (arrondi indicatif), + prix facturé
 *    en EUR en petit. Ex. sur /pronostics-pmu-cote-d-ivoire : "≈ 42 500 FCFA"
 *    en gros + "65 € facturés" en petit. (Avant le 01/10/2026, le « ≈ » portait
 *    sur l'euro, alors que c'est le montant exact débité et le FCFA l'arrondi.)
 *
 *  mode="eur-primary" (homepage, /abonnements — pages neutres) :
 *    EUR en GROS + équivalent local en petit selon le pays détecté
 *    Ex sur /abonnements : "65 €" en gros + "≈ 42 500 FCFA" en petit (si user en CI)
 *
 * Cohérent avec la pratique AirBnB/Stripe :
 *  - Diaspora & France voient EUR en gros (familier, sans friction)
 *  - Utilisateur CI/SN sur page géo voit FCFA en gros (intentionnel)
 *  - Mais TOUJOURS les 2 prix présents → transparence + zéro ambiguïté checkout
 */

import { type Country, formatPrice, DEVISE_SYMBOL } from "@/lib/geo/countries";

interface Props {
  /** Prix de base en EUR (référence interne stable, non affichée brute) */
  eur: number;
  /** Pays détecté (CF-IPCountry) ou pays choisi par l'utilisateur (page géo). Si null → EUR seul */
  country: Country | null;
  /** Mode d'affichage. Default 'eur-primary' (sécurité psychologique pour diaspora). */
  mode?: "local-primary" | "eur-primary";
  /** Taille de l'affichage. Default 'md'. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Afficher "/mois" en suffixe ? */
  perMonth?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: { primary: "text-xl",  secondary: "text-[10px]" },
  md: { primary: "text-2xl", secondary: "text-xs"     },
  lg: { primary: "text-3xl", secondary: "text-xs"     },
  xl: { primary: "text-4xl", secondary: "text-sm"     },
};

export default function PriceDualCurrency({
  eur, country, mode = "eur-primary", size = "md", perMonth = false, className = "",
}: Props) {
  const sizes = SIZE_CLASSES[size];

  // Si pas de pays détecté ou EUR — affichage simple
  if (!country || country.devise === "EUR") {
    return (
      <span className={`inline-flex items-baseline gap-1 ${className}`}>
        <span className={`font-serif font-bold ${sizes.primary}`}>
          {eur.toLocaleString("fr-FR")} €
        </span>
        {perMonth && <span className="text-text-muted text-xs">/mois</span>}
      </span>
    );
  }

  const localFormatted = formatPrice(eur, country.devise);

  if (mode === "local-primary") {
    // Équivalent local (arrondi) en gros, prix réellement facturé en EUR en petit
    return (
      <span className={`inline-flex flex-col items-baseline ${className}`}>
        <span className="inline-flex items-baseline gap-1">
          <span className={`font-serif font-bold ${sizes.primary}`}>
            ≈ {localFormatted}
          </span>
          {perMonth && <span className="text-text-muted text-xs">/mois</span>}
        </span>
        <span className={`text-text-muted ${sizes.secondary} mt-0.5`}>
          {eur.toLocaleString("fr-FR")} € facturés
        </span>
      </span>
    );
  }

  // Default: eur-primary — EUR en gros, équivalent local en petit
  return (
    <span className={`inline-flex flex-col items-baseline ${className}`}>
      <span className="inline-flex items-baseline gap-1">
        <span className={`font-serif font-bold ${sizes.primary}`}>
          {eur.toLocaleString("fr-FR")} €
        </span>
        {perMonth && <span className="text-text-muted text-xs">/mois</span>}
      </span>
      <span className={`text-text-muted ${sizes.secondary} mt-0.5`}>
        ≈ {localFormatted}
      </span>
    </span>
  );
}
