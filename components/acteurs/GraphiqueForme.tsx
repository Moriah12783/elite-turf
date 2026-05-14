/**
 * Graphique de forme — visualisation des 10 dernières positions sous forme
 * de barres verticales colorées (SVG inline, server-rendered).
 *
 * Pas de lib client (recharts, chart.js) pour rester dans le RSC et garder
 * le bundle léger. SVG natif suffit pour cette visu simple.
 *
 * Axes :
 *   - Y inversé : position 1 en haut, position 10+ en bas
 *   - X : courses les plus récentes à droite (lecture chrono naturelle)
 */

import { TrendingUp } from "lucide-react";

interface Props {
  /** Positions des N dernières courses, ordre du plus récent au plus ancien. */
  forme: Array<number | null>;
}

const WIDTH = 280;
const HEIGHT = 100;
const PADDING_X = 12;
const PADDING_Y = 12;
const MAX_POS = 10; // au-dessus de 10, on plafonne

function colorForPos(pos: number | null): string {
  if (pos === null) return "#3A3A4E";  // border (gris foncé)
  if (pos === 1) return "#10B981";     // status-win (vert)
  if (pos <= 3) return "#C9A84C";      // gold-primary
  if (pos <= 5) return "#60A5FA";      // blue-400
  return "#6B7280";                    // gris neutre
}

export default function GraphiqueForme({ forme }: Props) {
  // On affiche l'ordre chronologique : ancien → récent (left → right)
  // forme[] est ordonnée DESC date (récent → ancien), donc on reverse.
  const positions = [...forme].reverse();

  if (positions.length === 0) {
    return null;
  }

  const n = positions.length;
  const usableWidth  = WIDTH  - PADDING_X * 2;
  const usableHeight = HEIGHT - PADDING_Y * 2;
  const barWidth = usableWidth / n - 4; // 4px de gap entre barres

  // Pour une position p (1..MAX_POS), la barre a une hauteur inversement
  // proportionnelle (pos 1 = barre haute, pos 10 = barre basse).
  function barHeight(pos: number | null): number {
    if (pos === null) return 6; // mini-barre pour "course à venir"
    const clamped = Math.min(pos, MAX_POS);
    return usableHeight * ((MAX_POS - clamped + 1) / MAX_POS);
  }

  return (
    <section className="card-base p-5 sm:p-6">
      <h2 className="font-serif font-bold text-text-primary text-lg mb-3 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-gold-primary" />
        Forme récente
        <span className="text-text-muted text-xs font-normal normal-case ml-1">
          — courses du + ancien au + récent
        </span>
      </h2>

      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height="auto"
          style={{ maxWidth: "400px" }}
          role="img"
          aria-label={`Forme récente : ${positions.map((p) => p ?? "?").join(", ")}`}
        >
          {/* Ligne de référence position 1 (top) en pointillés */}
          <line
            x1={PADDING_X}
            y1={PADDING_Y}
            x2={WIDTH - PADDING_X}
            y2={PADDING_Y}
            stroke="#2A2A3E"
            strokeDasharray="2 3"
            strokeWidth={1}
          />
          {/* Texte "1er" en petite étiquette à gauche */}
          <text
            x={PADDING_X - 2}
            y={PADDING_Y + 3}
            fontSize="8"
            fill="#6B7280"
            textAnchor="end"
            fontFamily="ui-monospace, monospace"
          >
            1
          </text>
          <text
            x={PADDING_X - 2}
            y={HEIGHT - PADDING_Y + 2}
            fontSize="8"
            fill="#6B7280"
            textAnchor="end"
            fontFamily="ui-monospace, monospace"
          >
            10+
          </text>

          {/* Barres */}
          {positions.map((p, i) => {
            const h = barHeight(p);
            const x = PADDING_X + i * (barWidth + 4);
            const y = HEIGHT - PADDING_Y - h;
            const color = colorForPos(p);
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  fill={color}
                  rx={2}
                  opacity={p === null ? 0.3 : 0.9}
                />
                {/* Label de position au-dessus de la barre (si terminée) */}
                {p !== null && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 3}
                    fontSize="8"
                    fill={color}
                    textAnchor="middle"
                    fontWeight="bold"
                    fontFamily="ui-monospace, monospace"
                  >
                    {p > 9 ? "10+" : p}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#10B981" }} />
          Victoire
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#C9A84C" }} />
          Top 3
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#60A5FA" }} />
          Top 5
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#6B7280" }} />
          6+
        </span>
      </div>
    </section>
  );
}
