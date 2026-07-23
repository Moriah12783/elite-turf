import { Star } from "lucide-react";
import type { PlanRadar } from "@/lib/pronostics/plan-radar";

/**
 * Bloc « façon Radar » du VRAI pronostic, pour les ABONNÉS.
 *
 * Reprend volontairement le langage visuel du Radar de la presse (mêmes
 * couleurs, même vocabulaire base / value / coup) pour que l'abonné retrouve
 * ses repères — mais ici les chevaux viennent du pronostic de nos experts,
 * pas du consensus presse.
 *
 * Le pivot (banker) est marqué d'une ⭐ : c'est l'information que le Radar
 * gratuit ne donne jamais.
 *
 * Aucun effectif imposé : on affiche ce que l'expert a réellement défini.
 */
const TIERS = {
  base:  { label: "La base",  chip: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40", text: "text-emerald-400" },
  value: { label: "La value", chip: "bg-blue-500/10 text-blue-300 border-blue-500/40",          text: "text-blue-400" },
  coup:  { label: "Le coup",  chip: "bg-gold-faint text-gold-light border-gold-primary/50",     text: "text-gold-primary" },
} as const;

function Ligne({
  tier, numeros, pivot,
}: {
  tier: keyof typeof TIERS;
  numeros: number[];
  pivot?: number | null;
}) {
  if (numeros.length === 0) return null;
  const t = TIERS[tier];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`text-[10px] uppercase tracking-wider font-bold w-[68px] flex-shrink-0 ${t.text}`}>
        {t.label}
      </span>
      {numeros.map((n) => (
        <span
          key={n}
          className={`inline-flex items-center gap-0.5 min-w-[28px] h-7 px-1.5 rounded-full border font-bold text-xs justify-center ${t.chip}`}
        >
          {n === pivot && <Star className="w-2.5 h-2.5" fill="currentColor" />}
          {n}
        </span>
      ))}
    </div>
  );
}

export default function PlanRadarBlock({ plan }: { plan: PlanRadar }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated/40 p-3 space-y-2">
      <Ligne tier="base"  numeros={plan.base}  pivot={plan.pivot} />
      <Ligne tier="value" numeros={plan.value} />
      {plan.coup != null && <Ligne tier="coup" numeros={[plan.coup]} />}
      {plan.pivot != null && (
        <p className="text-[11px] text-text-muted pt-1 border-t border-border/40">
          <Star className="w-2.5 h-2.5 inline text-gold-primary mb-0.5" fill="currentColor" />{" "}
          <span className="text-gold-light font-semibold">n°{plan.pivot}</span> = notre pivot du jeu
        </p>
      )}
    </div>
  );
}
