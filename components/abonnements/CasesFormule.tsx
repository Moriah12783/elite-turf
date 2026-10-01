import { Check, Minus } from "lucide-react";
import { fichesFormules, type IdFormule } from "@/lib/abonnements/comparatif";

/** Couleur des cases cochées, alignée sur la couleur de chaque formule. */
const COCHE: Record<IdFormule, string> = {
  free:    "bg-status-win/15 border-status-win/60 text-status-win",
  starter: "bg-status-win/15 border-status-win/60 text-status-win",
  pro:     "bg-gold-primary/15 border-gold-primary/70 text-gold-primary",
  elite:   "bg-purple-500/15 border-purple-400/60 text-purple-300",
};

/**
 * Liste « à cases » d'une formule : les mêmes lignes pour les quatre formules,
 * cochées ou non (lib/abonnements/comparatif.ts). Une ligne non incluse reste
 * affichée, en retrait : c'est ce qui rend la comparaison immédiate.
 */
export default function CasesFormule({
  formule,
  offreEliteJusquau = null,
}: {
  formule: IdFormule;
  offreEliteJusquau?: string | null;
}) {
  return (
    <div className="space-y-5">
      {fichesFormules(offreEliteJusquau).map((groupe) => (
        <div key={groupe.titre}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2.5">
            {groupe.titre}
          </p>
          <ul className="space-y-3">
            {groupe.lignes.map((ligne) => {
              const valeur = ligne.cases[formule];
              const inclus = valeur !== false;
              return (
                <li key={ligne.id} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-md border flex items-center justify-center ${
                      inclus ? COCHE[formule] : "bg-bg-elevated border-border text-text-muted/50"
                    }`}
                  >
                    {inclus ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <Minus className="w-3 h-3" />}
                  </span>
                  <span className="min-w-0">
                    {/* Même graisse cochée ou non : les lignes passent à la ligne
                        au même endroit dans les quatre fiches, qui restent alignées. */}
                    <span className={`block text-sm font-medium leading-snug ${inclus ? "text-text-primary" : "text-text-muted"}`}>
                      <span className="sr-only">{inclus ? "Inclus : " : "Non inclus : "}</span>
                      {ligne.libelle}
                    </span>
                    <span className={`block text-xs leading-snug mt-0.5 ${
                      typeof valeur === "string" ? "text-purple-300 font-medium" : inclus ? "text-text-secondary" : "text-text-muted/70"
                    }`}>
                      {typeof valeur === "string" ? valeur : ligne.detail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
