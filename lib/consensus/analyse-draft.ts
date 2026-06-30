/**
 * Brouillon d'analyse à partir du consensus — module PUR, déterministe.
 *
 * Génère un texte d'analyse (courte = teaser public ; complète = abonnés) à partir
 * UNIQUEMENT des données mesurées (citations, cote, badge stats, divergence). C'est
 * un BROUILLON que l'admin relit/retouche avant publication.
 *
 * ANTI-FABRICATION PAR CONSTRUCTION : aucune phrase n'invente de forme, de résultat
 * passé ou de promesse de gain — on ne fait que reformuler des comptages et des
 * étiquettes déjà calculés. La note de prudence est toujours incluse.
 */
import type { ConsensusResult } from "./engine";

export interface AnalyseDraftInput {
  result: ConsensusResult;
  /** la sélection retenue (Elite-6 ou Pro-8) */
  selection: number[];
  /** numéro → nom du cheval (depuis la course liée) */
  noms?: Record<number, string | null>;
  /** numéro → badge sélection stats (Favori marché, Bonne forme…) */
  statLabel?: Record<number, string | null>;
  /** numéro → flag de divergence presse × stats */
  divergence?: Record<number, "BASE" | "VALUE" | "PIEGE" | null>;
  hippodrome?: string | null;
  /** "Quinté+" / "Quarté+" / "Tiercé" */
  typePariLabel?: string;
}

export interface AnalyseDraft {
  analyseCourte: string;
  analyseTexte: string;
}

const PRUDENCE = "Jeu d'argent interdit aux mineurs. Jouez avec modération. Aucune garantie de gain.";

export function buildAnalyseDraft(input: AnalyseDraftInput): AnalyseDraft {
  const { result } = input;
  const selection = input.selection || [];
  const noms = input.noms || {};
  const statLabel = input.statLabel || {};
  const divergence = input.divergence || {};
  const nb = result.nbSources;
  const pari = input.typePariLabel || "Quinté+";
  const lieu = input.hippodrome ? ` de ${input.hippodrome}` : "";

  const byNum: Record<number, (typeof result.partants)[number]> = {};
  result.partants.forEach((p) => { byNum[p.numero] = p; });

  const nom = (n: number): string => {
    const nm = noms[n];
    return nm ? `${n} ${nm}` : `n°${n}`;
  };
  const avecCote = (n: number): string => {
    const p = byNum[n];
    return p && p.cote != null ? `${nom(n)} (cote ${p.cote})` : nom(n);
  };
  const cit = (n: number): string => {
    const p = byNum[n];
    return p ? `${p.citations}/${nb}` : `?/${nb}`;
  };

  // Favori / pivot = le mieux classé de la sélection (score consensus desc).
  const ordered = selection.slice().sort((a, b) => (byNum[b]?.scoreConsensus ?? 0) - (byNum[a]?.scoreConsensus ?? 0));
  const favori = ordered.length > 0 ? ordered[0] : null;
  const base = ordered.filter((n) => n !== favori && divergence[n] === "BASE");
  const values = selection.filter((n) => divergence[n] === "VALUE");
  const pieges = selection.filter((n) => divergence[n] === "PIEGE");

  const lignes: string[] = [];
  if (favori != null) {
    const sl = statLabel[favori] ? ` — « ${statLabel[favori]} » côté data` : "";
    lignes.push(`Base : ${avecCote(favori)}, cité ${cit(favori)} par la presse${sl}. C'est le pivot du jeu.`);
  }
  if (base.length > 0) {
    const items = base.map((n) => `${nom(n)} (${cit(n)}${statLabel[n] ? `, ${statLabel[n]!.toLowerCase()}` : ""})`).join(" ; ");
    lignes.push(`Associés solides : ${items}.`);
  }
  if (values.length > 0) {
    lignes.push(`Outsiders à valeur (la data les soutient, la presse moins) : ${values.map(avecCote).join(", ")}.`);
  }
  if (pieges.length > 0) {
    lignes.push(`⚠️ À surveiller : ${pieges.map(avecCote).join(", ")} — très cité(s) mais à grosse cote sans appui statistique (surcote possible).`);
  }
  lignes.push(`Notre champ ${pari} : ${selection.join(" · ")}.`);
  lignes.push(PRUDENCE);
  const analyseTexte = lignes.join("\n");

  // Teaser ≤160, sans dévoiler la sélection.
  const parts: string[] = ["un favori plébiscité par la presse"];
  parts.push(values.length > 0 ? "des outsiders à valeur" : "une base solide");
  if (pieges.length > 0) parts.push("des pièges de cote à éviter");
  let analyseCourte = `${pari}${lieu} : ${parts.join(", ")}. Analyse + sélection réservées aux abonnés.`;
  if (analyseCourte.length > 160) analyseCourte = analyseCourte.slice(0, 157).trim() + "…";

  return { analyseCourte, analyseTexte };
}
