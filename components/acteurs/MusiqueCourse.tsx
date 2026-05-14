/**
 * Musique d'un cheval/jockey : codes des 10 dernières courses sous forme
 * de badges colorés. Format PMU standard : "1p 3p Da 5p…"
 *
 *   - Vert (status-win) : victoires (1)
 *   - Doré (gold)        : top 3 (2-3)
 *   - Gris clair         : top 5 (4-5)
 *   - Gris               : 6+
 *   - Rouge              : abandon (Da)
 *   - Bleu               : course à venir / en cours
 */

import { Music } from "lucide-react";
import type { CourseLine } from "@/lib/seo/acteurs";

interface Props {
  rows:    CourseLine[];
  /** Nombre max de courses à afficher (par défaut 10). */
  limit?:  number;
}

function MusiqueBadge({ code }: { code: string }) {
  let bg = "bg-bg-elevated";
  let border = "border-border";
  let text = "text-text-secondary";

  const num = parseInt(code, 10);
  if (code === "1p") {
    bg = "bg-status-win/15"; border = "border-status-win/30"; text = "text-status-win";
  } else if (code === "2p" || code === "3p") {
    bg = "bg-gold-primary/10"; border = "border-gold-primary/30"; text = "text-gold-light";
  } else if (code === "4p" || code === "5p") {
    bg = "bg-blue-500/10"; border = "border-blue-500/25"; text = "text-blue-300";
  } else if (code === "Da" || code === "Ra" || code === "T") {
    bg = "bg-status-loss/10"; border = "border-status-loss/25"; text = "text-status-loss";
  } else if (code === "—") {
    bg = "bg-bg-elevated/60"; border = "border-border/40"; text = "text-text-muted";
  } else if (!isNaN(num) && num >= 6) {
    bg = "bg-bg-elevated"; border = "border-border"; text = "text-text-secondary";
  }

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded text-xs font-bold font-mono ${bg} ${border} border ${text}`}
      title={
        code === "1p" ? "Victoire"
        : code === "Da" ? "Abandon / Disqualifié"
        : code === "—" ? "Course à venir"
        : `${code.replace("p", "")}ème place`
      }
    >
      {code}
    </span>
  );
}

/**
 * Convertit une ligne course en code musique.
 * Renvoie "—" si la course n'est pas encore terminée.
 */
function lineToCode(r: CourseLine): string {
  if (r.statut !== "TERMINE") return "—";
  if (r.arrivee === null) return "Da";
  if (r.arrivee >= 1 && r.arrivee <= 9) return `${r.arrivee}p`;
  return "0p";
}

export default function MusiqueCourse({ rows, limit = 10 }: Props) {
  const items = rows.slice(0, limit);

  if (items.length === 0) {
    return (
      <section className="card-base p-5 sm:p-6">
        <h2 className="font-serif font-bold text-text-primary text-lg mb-3 flex items-center gap-2">
          <Music className="w-5 h-5 text-gold-primary" />
          Musique
        </h2>
        <p className="text-text-muted text-sm">Pas encore de courses enregistrées.</p>
      </section>
    );
  }

  // Stats résumé pour le sous-titre
  const termines = items.filter((r) => r.statut === "TERMINE");
  const victoires = termines.filter((r) => r.arrivee === 1).length;
  const places    = termines.filter((r) => r.arrivee !== null && r.arrivee <= 3).length;

  return (
    <section className="card-base p-5 sm:p-6">
      <div className="flex items-baseline justify-between mb-4 gap-4">
        <h2 className="font-serif font-bold text-text-primary text-lg flex items-center gap-2">
          <Music className="w-5 h-5 text-gold-primary" />
          Musique
          <span className="text-text-muted text-xs font-normal normal-case ml-1">
            — {items.length} dernières courses
          </span>
        </h2>
        {termines.length > 0 && (
          <p className="text-text-muted text-xs hidden sm:block">
            <span className="text-status-win font-bold">{victoires}V</span>
            {" · "}
            <span className="text-gold-light font-bold">{places} top 3</span>
            {" · "}
            <span className="text-text-secondary">{termines.length} c.</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {items.map((r, i) => (
          <MusiqueBadge key={`${r.course_id}-${i}`} code={lineToCode(r)} />
        ))}
      </div>

      <p className="mt-4 text-text-muted text-xs leading-relaxed">
        <span className="text-status-win font-bold">1p</span> = victoire ·{" "}
        <span className="text-gold-light font-bold">2p–3p</span> = top 3 ·{" "}
        <span className="text-blue-300 font-bold">4p–5p</span> = top 5 ·{" "}
        <span className="text-status-loss font-bold">Da</span> = abandon ·{" "}
        <span className="text-text-muted font-bold">—</span> = à venir
      </p>
    </section>
  );
}
