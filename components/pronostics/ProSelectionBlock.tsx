import type { RunnerRole } from "@/lib/ai-pronostics/types";

export interface SelectionDetailItem {
  number: number;
  name: string;
  role: RunnerRole | string;
}

interface PartantLite {
  numero: number;
  nom_cheval: string;
  cote: number | null;
  jockey: string | null;
}

/**
 * Affichage PRO hiérarchisé — la sélection groupée par RÔLE (Base / Chances /
 * Outsiders) + le ticket jouable conseillé. C'est ce qui distingue le « pronostic
 * jouable » Pro de la simple liste. Rendu pour un abonné ayant accès (gating géré
 * par l'appelant). Source : pronostics.selection_detail (jsonb).
 */
export function ProSelectionBlock({
  items,
  ticket,
  partants,
}: {
  items: SelectionDetailItem[];
  ticket: string | null;
  partants: PartantLite[];
}) {
  const byNumber = new Map(partants.map((p) => [p.numero, p]));

  // Groupes robustes : tout cheval atterrit dans un groupe (le 3e est un
  // catch-all → aucun cheval n'est perdu, même si un rôle inattendu apparaît).
  const sections = [
    {
      label: "🎯 Base",
      hint: "Chevaux de confiance — le socle du jeu",
      horses: items.filter((it) => it.role === "BASE"),
    },
    {
      label: "💪 Chances régulières",
      hint: "Profils réguliers à associer à la base",
      horses: items.filter((it) => it.role === "APPUI"),
    },
    {
      label: "🎲 Outsiders & value",
      hint: "Cotes intéressantes pour élargir le jeu",
      horses: items.filter((it) => it.role !== "BASE" && it.role !== "APPUI"),
    },
  ];

  return (
    <div className="space-y-3">
      {sections.map((section) =>
        section.horses.length === 0 ? null : (
          <div key={section.label}>
            <p className="text-text-muted text-xs uppercase tracking-wider mb-1.5">
              {section.label}{" "}
              <span className="normal-case text-text-muted/70">· {section.hint}</span>
            </p>
            <div className="space-y-1.5">
              {section.horses.map((it) => {
                const horse = byNumber.get(it.number);
                return (
                  <div
                    key={it.number}
                    className="flex items-center gap-3 p-2.5 rounded-xl border bg-bg-elevated border-border/50"
                  >
                    <span className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 bg-gold-faint border-2 border-gold-primary/50 text-gold-light">
                      {it.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary text-sm font-semibold leading-tight">
                        {horse?.nom_cheval ?? it.name ?? `Cheval n°${it.number}`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {horse?.cote ? (
                          <span className="text-gold-light text-xs font-medium">
                            cote {Number(horse.cote).toFixed(1)}
                          </span>
                        ) : null}
                        {horse?.jockey ? (
                          <span className="text-text-muted text-xs hidden sm:inline">
                            · {horse.jockey}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ),
      )}

      {ticket ? (
        <div className="mt-1 p-3 rounded-xl border border-gold-primary/30 bg-gold-faint/30">
          <p className="text-text-muted text-xs uppercase tracking-wider mb-1">🎫 Ticket conseillé</p>
          <p className="text-text-secondary text-sm leading-relaxed">{ticket}</p>
        </div>
      ) : null}
    </div>
  );
}
