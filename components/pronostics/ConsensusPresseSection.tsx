import { buildConsensus, type PartantConsensus } from "@/lib/consensus/engine";
import { Newspaper } from "lucide-react";

interface Props {
  /** partants du consensus (jsonb stocké) : [{ numero, citations, cote?, bases? }] */
  partants: PartantConsensus[];
  nbSources: number;
  /** sélection premium du pronostic (numéros) */
  selection: number[];
  /** numéro → nom du cheval (optionnel, pour l'affichage) */
  noms?: Record<number, string>;
}

/**
 * Affiche, pour un abonné premium, la justification "consensus de la presse" :
 * pour chaque cheval de la sélection, combien de sources le citent, + une synthèse
 * (plus cité / meilleur outsider / tocard). Statistique agrégée uniquement —
 * aucun pronostic nominatif de confrère n'est reproduit.
 */
export function ConsensusPresseSection({ partants, nbSources, selection, noms }: Props) {
  if (!partants || partants.length === 0 || !selection || selection.length === 0) return null;
  // Jamais de dénominateur fabriqué : sans nombre de sources réel, on n'affiche rien.
  if (!nbSources || nbSources <= 0) return null;

  const result = buildConsensus({ nbSources, partants });
  const nb = result.nbSources;

  const byNum: Record<number, (typeof result.partants)[number]> = {};
  result.partants.forEach((p) => { byNum[p.numero] = p; });

  // sélection triée par citations décroissantes
  const sel = selection.slice().sort((a, b) => (byNum[b]?.citations ?? 0) - (byNum[a]?.citations ?? 0));
  const topCite = result.topCites[0];
  const topOut = result.topOutsiders[0];
  const topToc = result.topTocards[0];

  return (
    <div className="mb-6">
      <h2 className="text-text-muted text-xs uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
        <Newspaper className="w-4 h-4 text-gold-primary" />
        Consensus de la presse
      </h2>
      <div className="p-4 bg-bg-elevated rounded-xl border border-border/50 space-y-3">
        <p className="text-text-muted text-xs">
          {nb} sources de presse agrégées — aide à la décision, jamais une garantie.
        </p>
        <div className="flex flex-wrap gap-2">
          {sel.map((numero) => {
            const p = byNum[numero];
            const cit = p ? p.citations : 0;
            const taux = p ? Math.round(p.tauxCitation * 100) : 0;
            return (
              <span key={numero} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-card border border-border text-sm">
                <span className="font-bold text-gold-light">{numero}</span>
                {noms?.[numero] && <span className="text-text-secondary text-xs max-w-[90px] truncate">{noms[numero]}</span>}
                <span className={`text-xs ${p ? "text-text-muted" : "text-text-muted/60"}`}>
                  {p ? `cité ${cit}/${nb} · ${taux}%` : "non cité"}
                </span>
              </span>
            );
          })}
        </div>
        {(topCite || topOut || topToc) && (
          <p className="text-text-secondary text-xs leading-relaxed">
            {topCite && <>🥇 Le plus plébiscité : <b className="text-text-primary">N°{topCite.numero}</b> ({topCite.citations}/{nb}). </>}
            {topOut && <>📈 Meilleur outsider cité : <b className="text-blue-400">N°{topOut.numero}</b> ({topOut.citations}/{nb}). </>}
            {topToc && <>🎲 Tocard remarqué : <b className="text-purple-400">N°{topToc.numero}</b> ({topToc.citations}/{nb}).</>}
          </p>
        )}
        <p className="text-text-muted/70 text-[11px]">
          Statistique agrégée (nombre de sources sur ~{nb}). Aucun pronostic nominatif de confrère n&apos;est reproduit.
        </p>
      </div>
    </div>
  );
}
