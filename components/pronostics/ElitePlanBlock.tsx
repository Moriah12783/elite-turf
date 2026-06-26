import type { ElitePlanDeJeu } from "@/lib/ai-pronostics/types";

/**
 * Bloc « Plan de jeu Elite » — affichage structuré du plan déterministe
 * (banker + stratégie de mise en UNITÉS + value + Quinté+ travaillé).
 * Rendu uniquement pour un abonné ayant accès (gating géré par l'appelant).
 * Source : pronostics.plan_de_jeu (jsonb) — cf lib/ai-pronostics/elite-plan.ts.
 */
export function ElitePlanBlock({ plan }: { plan: ElitePlanDeJeu }) {
  return (
    <div className="mt-4 rounded-xl border border-gold-primary/40 bg-bg-elevated p-4 space-y-4">
      <h3 className="flex items-center gap-2 text-gold-primary font-bold text-sm uppercase tracking-wider">
        <span aria-hidden>👑</span> Plan de jeu Elite
      </h3>

      {/* Banker */}
      <div>
        <p className="text-text-muted text-xs uppercase tracking-wider mb-1">🔑 Banker</p>
        <p className="text-text-secondary text-sm leading-relaxed">
          <span className="font-bold text-gold-primary">
            n°{plan.banker.number} {plan.banker.name}
          </span>
          {" — "}
          {plan.banker.justification}
        </p>
      </div>

      {/* Stratégie de pari */}
      <div>
        <p className="text-text-muted text-xs uppercase tracking-wider mb-1">🎯 Stratégie de pari</p>
        <p className="text-text-secondary text-sm leading-relaxed">
          {plan.bet_strategy.type_pari} — champ réduit{" "}
          <span className="font-semibold text-gold-primary">
            {plan.bet_strategy.champ_reduit.join("-")}
          </span>
        </p>
      </div>

      {/* Mise en unités */}
      {plan.bet_strategy.mise_unites.length > 0 && (
        <div>
          <p className="text-text-muted text-xs uppercase tracking-wider mb-1">💰 Mise (en unités)</p>
          <ul className="space-y-1">
            {plan.bet_strategy.mise_unites.map((m, i) => (
              <li key={i} className="text-text-secondary text-sm flex justify-between gap-3">
                <span>{m.libelle}</span>
                <span className="font-semibold text-gold-primary whitespace-nowrap">{m.unites} u</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Value */}
      {plan.value_picks.length > 0 && (
        <div>
          <p className="text-text-muted text-xs uppercase tracking-wider mb-1">
            ⭐ Value (cote attractive vs forme récente)
          </p>
          <ul className="space-y-1">
            {plan.value_picks.map((v, i) => (
              <li key={i} className="text-text-secondary text-sm leading-relaxed">
                <span className="font-semibold text-gold-primary">
                  n°{v.number} {v.name}
                </span>{" "}
                — {v.raison}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quinté+ travaillé */}
      {plan.quinte_plan && (
        <div>
          <p className="text-text-muted text-xs uppercase tracking-wider mb-1">🏆 Quinté+ travaillé</p>
          <p className="text-text-secondary text-sm leading-relaxed">
            Base{" "}
            <span className="font-semibold text-gold-primary">{plan.quinte_plan.base.join("-")}</span>{" "}
            / champ{" "}
            <span className="font-semibold text-gold-primary">{plan.quinte_plan.champ.join("-")}</span>.{" "}
            {plan.quinte_plan.strategie}
          </p>
        </div>
      )}

      <p className="text-text-muted text-xs italic pt-2 border-t border-border/40">
        ⚠️ Jeu responsable : les mises sont indicatives (en unités), à adapter à votre budget. Pariez avec modération.
      </p>
    </div>
  );
}
