/**
 * Validation STRICTE du bloc consensus — contrat de données Elite Turf v2.4.
 * Module PUR (client & serveur), déterministe, testable.
 *
 * Incident fondateur (01/07/2026) : un bloc contenant une COTE en 3e colonne
 * (« 3 2 144 12 ») a été lu avec l'ancienne tolérance comme « 144 bases » →
 * score gonflé → cheval cité 2/33 tagué Base → injecté dans l'Elite-6.
 * Ce module rend cet incident techniquement impossible :
 *   - E01 : chaque ligne de données = EXACTEMENT 3 entiers « numero citations bases »
 *           (la cote ne figure JAMAIS dans le bloc — Elite l'ajoute depuis la course liée) ;
 *   - E04 : bases ≤ citations (« 144 bases pour 2 citations » = impossible) ;
 *   - E05/E06 : totaux vérifiés (8 chevaux par avis ; 1 base par avis) ;
 *   - R01 (moteur) : citations < seuil → jamais tagué « Base » automatiquement.
 *
 * Consommé par : (a) l'action « Analyser » de l'admin (via /api/admin/consensus/validate,
 * qui journalise dans `consensus_imports`), (b) l'API d'ingestion (Lot 2).
 * Le frontend ne fait qu'AFFICHER le rapport — aucune règle dupliquée côté client.
 */
import { seuilBase, type PartantConsensus } from "./engine";

// Ré-export : le seuil R01 vit dans le moteur (règle de sélection), la
// validation et l'UI le consomment depuis ici aussi.
export { seuilBase };

export interface ValidationIssue {
  code: string;
  ligne?: number;
  message: string;
}

export interface ValidationWarning extends ValidationIssue {
  requires_ack: boolean;
}

export interface ValidationReport {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationWarning[];
  /** partants parsés — renseignés UNIQUEMENT si ok (sinon []) */
  partants: PartantConsensus[];
  /** seuil anti-fausse-base R01 (appliqué aussi par le moteur, défense en profondeur) */
  seuil_base: number;
  /** nb_sources < 15 → fiabilité moindre, propagé jusqu'à l'affichage abonnés */
  echantillon_reduit: boolean;
}

/** Grille Quinté+ : chaque avis (journal) sélectionne exactement 8 chevaux. */
export const SELECTIONS_PAR_SOURCE = 8;
/** En dessous de 15 avis indépendants → bandeau « échantillon réduit ». */
export const SEUIL_ECHANTILLON_REDUIT = 15;

const INT_RE = /^\d+$/;
const DECIMAL_RE = /^\d+[.,]\d+$/;

export interface ValidateInput {
  nbPartants: number;
  nbSources: number;
  /** texte brut collé (ou reçu par l'API) */
  texte: string;
}

export function validateConsensusBlock(input: ValidateInput): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationWarning[] = [];
  const nbPartants = Math.floor(Number(input.nbPartants));
  const nbSources = Math.floor(Number(input.nbSources));

  // ── E00 — pré-requis : sans eux, E02/E05/E06 ne peuvent pas s'appliquer ──
  if (!Number.isFinite(nbPartants) || nbPartants < 1) {
    errors.push({ code: "E00", message: "Nb partants requis (entier ≥ 1) — renseigne le champ ou lie la course." });
  }
  if (!Number.isFinite(nbSources) || nbSources < 1) {
    errors.push({ code: "E00", message: "Nb sources requis (entier ≥ 1) — nombre d'avis indépendants réellement comptés." });
  }
  if (errors.length > 0) {
    return { ok: false, errors, warnings, partants: [], seuil_base: 0, echantillon_reduit: false };
  }

  const seuil = seuilBase(nbSources);
  const partants: PartantConsensus[] = [];
  const seen: Record<number, boolean> = {};
  const lines = (input.texte || "").split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.charAt(0) === "#") continue;

    const tokens = rawLine.split(/[\s;]+/).filter((t) => t.length > 0);
    if (tokens.length === 0) continue;
    // Un entier NÉGATIF en tête de ligne n'est ni de la prose ni une donnée
    // valide → erreur explicite plutôt que skip silencieux (défense complète).
    if (/^-\d+$/.test(tokens[0])) {
      errors.push({
        code: "E01", ligne: i + 1,
        message: `Ligne ${i + 1} : nombre négatif (« ${tokens[0]} ») — les numéros/citations/bases sont des entiers positifs.`,
      });
      continue;
    }
    // Prose / en-têtes / méta (« Date : … », « Nb sources : … ») : 1er token non entier → ignoré.
    if (!INT_RE.test(tokens[0])) continue;

    const n = i + 1;

    // ── E01 — ligne de données = EXACTEMENT 3 entiers ─────────────────────
    const allInts = tokens.every((t) => INT_RE.test(t));
    const hasDecimal = tokens.some((t) => DECIMAL_RE.test(t));
    if (tokens.length !== 3 || !allInts) {
      if (hasDecimal || (allInts && tokens.length >= 4)) {
        errors.push({
          code: "E01", ligne: n,
          message: `Ligne ${n} : ${tokens.length} valeurs détectées au lieu de 3. La cote ne doit JAMAIS figurer dans le bloc (incident du 01/07) — Elite l'ajoute depuis la course liée.`,
        });
      } else if (allInts && tokens.length === 2) {
        errors.push({
          code: "E01", ligne: n,
          message: `Ligne ${n} : 2 valeurs détectées au lieu de 3. Le format v2.4 exige « numero citations bases » (3 entiers).`,
        });
      } else {
        errors.push({
          code: "E01", ligne: n,
          message: `Ligne ${n} : contenu non conforme (« ${rawLine.slice(0, 40)} ») — colle uniquement le bloc de citations (3 entiers par ligne).`,
        });
      }
      continue;
    }

    const numero = parseInt(tokens[0], 10);
    const citations = parseInt(tokens[1], 10);
    const bases = parseInt(tokens[2], 10);

    // ── E02 — numéro dans le champ ─────────────────────────────────────────
    if (numero < 1 || numero > nbPartants) {
      errors.push({ code: "E02", ligne: n, message: `Ligne ${n} : cheval ${numero} > ${nbPartants} partants.` });
      continue;
    }
    // ── E03 — unicité ──────────────────────────────────────────────────────
    if (seen[numero]) {
      errors.push({ code: "E03", ligne: n, message: `Ligne ${n} : cheval ${numero} en doublon.` });
      continue;
    }
    // ── E04 — bornes citations & bases ────────────────────────────────────
    if (citations < 0 || citations > nbSources) {
      errors.push({ code: "E04", ligne: n, message: `Ligne ${n} : ${citations} citations hors bornes [0, ${nbSources}].` });
      continue;
    }
    if (bases > citations) {
      errors.push({ code: "E04", ligne: n, message: `Ligne ${n} : ${bases} bases > ${citations} citations (impossible).` });
      continue;
    }

    seen[numero] = true;
    // 0 citation = cheval NON cité. Le contrat dit de ne pas le lister, mais si
    // une source (Cowork) liste tous les partants avec 0, on l'IGNORE proprement
    // au lieu de bloquer (il ne porte aucune info).
    if (citations === 0) continue;
    partants.push({ numero, citations, bases });
  }

  if (partants.length === 0 && errors.length === 0) {
    errors.push({ code: "E00", message: "Aucune ligne de citation détectée dans le bloc." });
  }

  // ── E05 — total citations = 8 × nb_sources ──────────────────────────────
  let sumCitations = 0;
  let sumBases = 0;
  for (let i = 0; i < partants.length; i++) {
    sumCitations += partants[i].citations;
    sumBases += partants[i].bases || 0;
  }
  // E05 — total citations vs 8 × nb_sources. AVERTISSEMENT (pas bloquant) :
  // le « 8 par source » est un idéal ; en vrai certaines sources citent 5-7
  // chevaux → Σ < 8×N est LÉGITIME. On informe (ack requis) sans bloquer. Les
  // vraies corruptions (cote dans le bloc) sont déjà bloquées par E01/E04.
  const attendu = SELECTIONS_PAR_SOURCE * nbSources;
  if (errors.length === 0 && sumCitations !== attendu) {
    warnings.push({
      code: "E05", requires_ack: true,
      message: `Total citations = ${sumCitations}, attendu ~${attendu} (${SELECTIONS_PAR_SOURCE} × ${nbSources} avis). Normal si des sources citent moins de ${SELECTIONS_PAR_SOURCE} chevaux ; à vérifier si le bloc est incomplet ou Nb sources erroné.`,
    });
  }

  // ── E06 — total bases = nb_sources (1 base par avis) ────────────────────
  if (errors.length === 0) {
    if (sumBases > nbSources) {
      errors.push({ code: "E06", message: `Total bases = ${sumBases} pour ${nbSources} avis (impossible : 1 base par avis).` });
    } else if (sumBases < nbSources) {
      warnings.push({
        code: "E06", requires_ack: true,
        message: `Total bases = ${sumBases} pour ${nbSources} avis — bases partiellement collectées ?`,
      });
    }
  }

  // ── E07 — échantillon réduit ─────────────────────────────────────────────
  const echantillonReduit = nbSources < SEUIL_ECHANTILLON_REDUIT;
  if (echantillonReduit) {
    warnings.push({
      code: "E07", requires_ack: true,
      message: `Échantillon réduit (${nbSources} avis) — fiabilité moindre.`,
    });
  }

  const ok = errors.length === 0;
  return {
    ok,
    errors,
    warnings,
    partants: ok ? partants : [],
    seuil_base: seuil,
    echantillon_reduit: echantillonReduit,
  };
}
