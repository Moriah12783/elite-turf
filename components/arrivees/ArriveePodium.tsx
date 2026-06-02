import { buildArriveePodium } from "@/lib/courses/arrivee";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const ordinal = (rank: number): string => (rank === 1 ? "1ᵉʳ" : `${rank}ᵉ`);

/**
 * Podium d'arrivée : vainqueur mis en avant (dossard doré + nom), puis places
 * 2-5 classées (médailles top 3, dossards ronds distincts du rang). `compact`
 * masque les noms 2-5 sur mobile (lignes par course) ; sinon ils restent visibles.
 */
export function ArriveePodium({
  arrivee,
  partants,
  compact = false,
}: {
  arrivee: number[];
  partants: { numero: number; nom_cheval?: string | null }[];
  compact?: boolean;
}) {
  const places = buildArriveePodium(arrivee, partants);
  if (places.length === 0) return null;

  const winner = places[0];
  const rest = places.slice(1, 5);
  const extra = places.length - 5;

  return (
    <div className="space-y-2">
      {/* Vainqueur */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base leading-none" aria-hidden>{MEDALS[1]}</span>
        <span className="text-gold-primary text-[11px] font-bold uppercase tracking-wide flex-shrink-0">
          {ordinal(1)}
        </span>
        <span className="w-8 h-8 rounded-full bg-gold-faint border border-gold-primary/50 text-gold-light text-sm font-bold flex items-center justify-center flex-shrink-0">
          {winner.numero}
        </span>
        {winner.nom && (
          <span className="text-gold-light font-bold text-sm truncate">{winner.nom}</span>
        )}
      </div>

      {/* Places 2 → 5 */}
      {rest.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {rest.map((p) => (
            <span key={p.rank} className="inline-flex items-center gap-1.5 min-w-0">
              {MEDALS[p.rank] && (
                <span className="text-xs leading-none" aria-hidden>{MEDALS[p.rank]}</span>
              )}
              <span className="text-text-muted text-[11px] font-semibold flex-shrink-0">{ordinal(p.rank)}</span>
              <span className="w-6 h-6 rounded-full bg-bg-card border border-border text-text-secondary text-xs font-bold flex items-center justify-center flex-shrink-0">
                {p.numero}
              </span>
              {p.nom && (
                <span className={`text-text-muted text-xs truncate max-w-[140px] ${compact ? "hidden sm:inline" : "inline"}`}>
                  {p.nom}
                </span>
              )}
            </span>
          ))}
          {extra > 0 && (
            <span className="text-text-muted text-xs px-2 py-0.5 rounded-full bg-bg-card border border-border flex-shrink-0">
              +{extra}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
