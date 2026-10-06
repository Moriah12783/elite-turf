import { Star } from "lucide-react";
import { tiersDuPlan, type PlanRadar } from "@/lib/pronostics/plan-radar";
import { TIERS } from "./plan-radar-tiers";

export interface ChevalAffiche {
  nom?:    string | null;
  cote?:   number | null;
  jockey?: string | null;
}

/**
 * Le plan de jeu en LIGNES, avec le nom des chevaux — fiche détail d'un
 * pronostic et colonne « Pronostic Expert » de la fiche course.
 *
 * Mêmes niveaux, même ordre, mêmes couleurs que les pastilles de la carte
 * (PlanRadarBlock, via ./plan-radar-tiers.ts) : l'abonné retrouve ses repères
 * d'un écran à l'autre. Remplace le bloc de la fiche détail qui avait ses
 * propres intitulés (« 🎯 Base », « 🎲 Outsiders & value ») et pas de pivot.
 *
 * Rendu réservé aux abonnés : l'appelant passe par `planRadarAbonne`.
 *
 * Pas de badge « placé » ici, comme l'ancien bloc Pro/Elite : le résultat se
 * lit dans l'encadré « Arrivée officielle » de la fiche, avec le rang réel.
 *
 * @param chevaux nom, cote et jockey par numéro, quand la page les connaît.
 * @param compact colonne étroite : ni consigne, ni cote, ni ticket.
 */
export default function PlanRadarListe({
  plan,
  chevaux,
  ticket = null,
  compact = false,
}: {
  plan: PlanRadar;
  chevaux: Record<number, ChevalAffiche>;
  ticket?: string | null;
  compact?: boolean;
}) {
  const cheval = (n: number) => chevaux[n] as ChevalAffiche | undefined;

  return (
    <div className="space-y-3">
      {tiersDuPlan(plan).map(({ cle, numeros }) => {
        const t = TIERS[cle];

        // Le couplé double des chevaux déjà rangés dans leur niveau : un encadré,
        // pas une liste de plus.
        if (cle === "couple") {
          return (
            <div key={cle} className={`p-3 rounded-xl border ${t.chip}`}>
              <p className={`text-xs uppercase tracking-wider mb-1 font-semibold ${t.text}`}>
                {t.label}
                {!compact && <span className="normal-case font-normal text-text-muted/70"> · {t.consigne}</span>}
              </p>
              <p className="text-text-primary text-sm font-semibold">
                {numeros.map((n) => (cheval(n)?.nom ? `n°${n} ${cheval(n)!.nom}` : `n°${n}`)).join("  –  ")}
              </p>
            </div>
          );
        }

        return (
          <div key={cle}>
            <p className={`uppercase tracking-wider mb-1.5 font-semibold ${compact ? "text-[10px]" : "text-xs"} ${t.text}`}>
              {t.label}
              {!compact && <span className="normal-case font-normal text-text-muted/70"> · {t.consigne}</span>}
            </p>
            <div className="space-y-1.5">
              {numeros.map((n) => {
                const c = cheval(n);
                const pivot = n === plan.pivot;

                if (compact) {
                  return (
                    <div key={n} className="flex items-center gap-2">
                      <span className={`w-7 h-7 rounded-full border flex items-center justify-center font-bold text-xs flex-shrink-0 ${t.chip}`}>
                        {n}
                      </span>
                      {c?.nom && <span className="text-text-secondary text-xs font-medium truncate">{c.nom}</span>}
                      {pivot && (
                        <Star className="w-3 h-3 text-gold-primary flex-shrink-0" fill="currentColor" aria-hidden="true" />
                      )}
                    </div>
                  );
                }

                return (
                  <div key={n} className="flex items-center gap-3 p-2.5 rounded-xl border bg-bg-elevated border-border/50">
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 border-2 ${t.chip}`}>
                      {n}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary text-sm font-semibold leading-tight flex items-center gap-2 flex-wrap">
                        {c?.nom || `Cheval n°${n}`}
                        {pivot && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gold-faint border border-gold-primary/40 text-gold-light font-bold uppercase tracking-wider">
                            <Star className="w-2.5 h-2.5" fill="currentColor" />
                            Pivot
                          </span>
                        )}
                      </p>
                      {(c?.cote || c?.jockey) && (
                        <div className="flex items-center gap-2 mt-0.5">
                          {c?.cote ? (
                            <span className="text-gold-light text-xs font-medium">cote {Number(c.cote).toFixed(1)}</span>
                          ) : null}
                          {c?.jockey ? (
                            <span className="text-text-muted text-xs hidden sm:inline">· {c.jockey}</span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* En lignes, le badge « Pivot » parle de lui-même ; en colonne étroite,
          l'étoile seule a besoin de sa légende. */}
      {compact && plan.pivot != null && (
        <p className="text-[11px] text-text-muted pt-1 border-t border-border/40">
          <Star className="w-2.5 h-2.5 inline text-gold-primary mb-0.5" fill="currentColor" />{" "}
          <span className="text-gold-light font-semibold">n°{plan.pivot}</span> = notre pivot du jeu
        </p>
      )}

      {!compact && ticket ? (
        <div className="mt-1 p-3 rounded-xl border border-gold-primary/30 bg-gold-faint/30">
          <p className="text-text-muted text-xs uppercase tracking-wider mb-1">🎫 Ticket conseillé</p>
          <p className="text-text-secondary text-sm leading-relaxed">{ticket}</p>
        </div>
      ) : null}
    </div>
  );
}
