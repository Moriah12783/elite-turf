import type { RunnerRole } from "@/lib/ai-pronostics/types";
import { ROLE_COUP, ROLE_CHAMP } from "@/lib/pronostics/selection-roles";

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
 * Découpe la sélection PRO en tiers jouables.
 * - COMPLEMENT (couverture) est rangé avec les « Chances » — JAMAIS présenté
 *   comme outsider/value (anti-mislabel du favori, cf revue 2026-06-26).
 * - COUP est le pari d'audace DÉSIGNÉ par l'expert dans l'admin (il n'est jamais
 *   produit par le pipeline) : tier dédié, en dernier, pour que la fiche dise la
 *   même chose que le bloc « façon Radar » de la carte.
 * - L'avant-dernier tier reste un catch-all (OUTSIDER + rôle inattendu)
 *   → aucun cheval perdu.
 * L'ordre de mérite est préservé (items est déjà rank-ordonné).
 */
/**
 * Palette des tiers — STRICTEMENT la même que le bloc « façon Radar » de la
 * carte (PlanRadarBlock) : l'abonné doit retrouver ses repères d'un écran à
 * l'autre. « Chances régulières » prend le teal, entre l'émeraude de la base et
 * le bleu de la value — sa position exacte dans la hiérarchie. Le champ reste
 * neutre : c'est de la couverture, elle ne doit pas capter l'œil.
 */
const TONES = {
  base:   { label: "text-emerald-400", badge: "bg-emerald-500/10 border-emerald-500/40 text-emerald-300" },
  socle:  { label: "text-teal-400",    badge: "bg-teal-500/10 border-teal-500/40 text-teal-300" },
  value:  { label: "text-blue-400",    badge: "bg-blue-500/10 border-blue-500/40 text-blue-300" },
  coup:   { label: "text-gold-primary", badge: "bg-gold-faint border-gold-primary/50 text-gold-light" },
  champ:  { label: "text-text-muted",  badge: "bg-bg-elevated border-border text-text-secondary" },
} as const;

export function buildProSections(items: SelectionDetailItem[]) {
  return [
    {
      label: "🎯 Base",
      hint: "Chevaux de confiance — le socle du jeu",
      tone: TONES.base,
      horses: items.filter((it) => it.role === "BASE"),
    },
    {
      label: "💪 Chances régulières",
      hint: "Le cœur de la sélection à associer à la base",
      tone: TONES.socle,
      horses: items.filter((it) => it.role === "APPUI" || it.role === "COMPLEMENT"),
    },
    {
      label: "🎲 Outsiders & value",
      hint: "Cotes intéressantes pour élargir le jeu",
      tone: TONES.value,
      horses: items.filter(
        (it) =>
          it.role !== "BASE" &&
          it.role !== "APPUI" &&
          it.role !== "COMPLEMENT" &&
          it.role !== ROLE_COUP &&
          it.role !== ROLE_CHAMP,
      ),
    },
    {
      label: "⚡ Le coup",
      hint: "Le pari d'audace de l'expert",
      tone: TONES.coup,
      horses: items.filter((it) => it.role === ROLE_COUP),
    },
    {
      label: "🧩 Champ (couverture)",
      hint: "Complètent le ticket sans être mis en avant",
      tone: TONES.champ,
      horses: items.filter((it) => it.role === ROLE_CHAMP),
    },
  ];
}

/**
 * Nombre de tiers non vides. L'appelant n'affiche la hiérarchie que si ≥ 2 tiers
 * existent ; sinon il retombe sur la liste par mérite (évite un bloc « hiérarchisé »
 * dégénéré à une seule section + le mislabel du favori sur BDD jeune).
 */
export function countNonEmptyProSections(items: SelectionDetailItem[]): number {
  return buildProSections(items).filter((s) => s.horses.length > 0).length;
}

/**
 * Affichage PRO hiérarchisé — la sélection groupée par RÔLE (Base / Chances /
 * Outsiders) + le ticket jouable conseillé. C'est ce qui distingue le « pronostic
 * jouable » Pro de la simple liste. Rendu pour un abonné ayant accès (gating géré
 * par l'appelant). Source : pronostics.selection_detail (jsonb, rôles déterministes).
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
  const sections = buildProSections(items);

  return (
    <div className="space-y-3">
      {sections.map((section) =>
        section.horses.length === 0 ? null : (
          <div key={section.label}>
            <p className={`text-xs uppercase tracking-wider mb-1.5 font-semibold ${section.tone.label}`}>
              {section.label}{" "}
              <span className="normal-case font-normal text-text-muted/70">· {section.hint}</span>
            </p>
            <div className="space-y-1.5">
              {section.horses.map((it) => {
                const horse = byNumber.get(it.number);
                return (
                  <div
                    key={it.number}
                    className="flex items-center gap-3 p-2.5 rounded-xl border bg-bg-elevated border-border/50"
                  >
                    <span
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 border-2 ${section.tone.badge}`}
                    >
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
