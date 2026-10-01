/**
 * Registre de faits sourcés par pays (brief « pages pays » du 01/10/2026, §4).
 *
 * RÈGLE ABSOLUE : rien d'inventé.
 * - Un fait n'est publié que s'il a une source (URL) et une date de vérification.
 * - Pas de valeur approximative, pas de « environ ».
 * - Un bloc de page ne s'affiche que si TOUS ses faits sont publiables.
 * - Aucun texte n'est généré à l'affichage : la FAQ est rédigée une fois, puis
 *   relue par Steph.
 *
 * Remplissage : Claude Code par recherche sourcée (`verifiePar: "recherche"`),
 * puis Steph passe `verifiePar` à `"steph"` sur les faits qu'il confirme.
 */

export type Verificateur = "steph" | "recherche";

export interface Fait<T> {
  valeur: T;
  /** URL de la source officielle (opérateur, régulateur, presse). */
  source: string;
  /** AAAA-MM-JJ */
  verifieLe: string;
  verifiePar: Verificateur;
  /** Citation exacte de la source qui établit le fait (contrôle de relecture). */
  extrait?: string;
}

export type ModeDeJeu = "guichet" | "en-ligne" | "mobile";
export type DeviseNative = "XOF" | "XAF" | "MAD" | "MGA" | "EUR";

export interface QuestionFaq {
  q: string;
  a: string;
  /** Requête Search Console réelle de cette page qui justifie la question. */
  requeteSource: string;
}

export interface FichePays {
  slug: string;
  /** Fuseau IANA, ex. "Africa/Ouagadougou". */
  fuseau: string;
  deviseNative: DeviseNative;
  operateur?: Fait<{ nom: string; site: string }>;
  modesDeJeu?: Fait<ModeDeJeu[]>;
  heureLimite?: Fait<string>;
  /** Ex. PMU France, SOREC. */
  reunionsProposees?: Fait<string[]>;
  /** Formules propres au pays. */
  parisLocaux?: Fait<{ nom: string; description: string }[]>;
  /** Ex. « Nationale 1 » = Quinté+. */
  vocabulaire?: Fait<Record<string, string>>;
  /** Fait produit, confirmé par Steph. */
  editionGuichet: boolean;
  faq: QuestionFaq[];
  terrain?: { texte: string; photos: string[]; auteur: string };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Publiable = source en http(s) + date de vérification valide. */
export function estPubliable<T>(f: Fait<T> | undefined | null): f is Fait<T> {
  if (!f) return false;
  if (!/^https?:\/\/[^\s]+\.[^\s]+/.test(f.source)) return false;
  if (!DATE_RE.test(f.verifieLe) || isNaN(Date.parse(f.verifieLe + "T00:00:00Z"))) return false;
  return f.verifiePar === "steph" || f.verifiePar === "recherche";
}

/** Un bloc ne s'affiche que si TOUS ses faits sont publiables. */
export function tousPubliables(faits: (Fait<unknown> | undefined | null)[]): boolean {
  if (faits.length === 0) return false;
  for (let i = 0; i < faits.length; i++) if (!estPubliable(faits[i])) return false;
  return true;
}

/** Anomalies d'une fiche (contrôlées par les tests) ; vide = fiche saine. */
export function anomaliesFiche(f: FichePays): string[] {
  const anomalies: string[] = [];
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: f.fuseau }).format(new Date(0));
  } catch {
    anomalies.push(`${f.slug} : fuseau inconnu « ${f.fuseau} »`);
  }
  const faits: [string, Fait<unknown> | undefined][] = [
    ["operateur", f.operateur], ["modesDeJeu", f.modesDeJeu], ["heureLimite", f.heureLimite],
    ["reunionsProposees", f.reunionsProposees], ["parisLocaux", f.parisLocaux], ["vocabulaire", f.vocabulaire],
  ];
  for (let i = 0; i < faits.length; i++) {
    if (faits[i][1] !== undefined && !estPubliable(faits[i][1])) {
      anomalies.push(`${f.slug} : fait « ${faits[i][0]} » sans source http(s) ou date valide`);
    }
  }
  for (let i = 0; i < f.faq.length; i++) {
    const q = f.faq[i];
    if (!q.q.trim() || !q.a.trim() || !q.requeteSource.trim()) {
      anomalies.push(`${f.slug} : question FAQ n° ${i + 1} incomplète (question, réponse et requête source requises)`);
    }
  }
  return anomalies;
}
