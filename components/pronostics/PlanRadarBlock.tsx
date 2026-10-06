import { Star } from "lucide-react";
import { tiersDuPlan, type PlanRadar } from "@/lib/pronostics/plan-radar";
import { TIERS } from "./plan-radar-tiers";

/**
 * Bloc « façon Radar » du VRAI pronostic, pour les ABONNÉS — en pastilles :
 * carte de /pronostics et accueil. Version en lignes, avec le nom des chevaux :
 * PlanRadarListe. Libellés, couleurs et ordre : ./plan-radar-tiers.ts.
 *
 * Reprend volontairement le langage visuel du Radar de la presse (mêmes
 * couleurs, même vocabulaire base / value / coup) pour que l'abonné retrouve
 * ses repères — mais ici les chevaux viennent du pronostic de nos experts,
 * pas du consensus presse.
 *
 * Le pivot (banker) est marqué d'une ⭐ : c'est l'information que le Radar
 * gratuit ne donne jamais.
 *
 * Aucun effectif imposé : on affiche ce que l'expert a réellement défini. Le
 * bloc REMPLACE la liste des dossards : le champ y figure pour qu'aucun cheval
 * payé ne disparaisse.
 */
export default function PlanRadarBlock({ plan }: { plan: PlanRadar }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated/40 p-3 space-y-2">
      {tiersDuPlan(plan).map(({ cle, numeros }) => {
        const t = TIERS[cle];
        return (
          <div key={cle} className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] uppercase tracking-wider font-bold w-[84px] flex-shrink-0 ${t.text}`}>
              {t.label}
            </span>
            {numeros.map((n) => (
              <span
                key={n}
                className={`inline-flex items-center gap-0.5 min-w-[28px] h-7 px-1.5 rounded-full border font-bold text-xs justify-center ${t.chip}`}
              >
                {/* Étoile dans le niveau du pivot, pas dans le couplé qui le double. */}
                {cle !== "couple" && n === plan.pivot && <Star className="w-2.5 h-2.5" fill="currentColor" />}
                {n}
              </span>
            ))}
          </div>
        );
      })}
      {plan.pivot != null && (
        <p className="text-[11px] text-text-muted pt-1 border-t border-border/40">
          <Star className="w-2.5 h-2.5 inline text-gold-primary mb-0.5" fill="currentColor" />{" "}
          <span className="text-gold-light font-semibold">n°{plan.pivot}</span> = notre pivot du jeu
        </p>
      )}
    </div>
  );
}
