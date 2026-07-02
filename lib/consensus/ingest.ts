/**
 * Ingestion API — contrat de données v2.4 (Lot 2).
 * Module PUR : mappe le payload JSON du pipeline vers le format validable par
 * le Lot 1 (`validateConsensusBlock`), source de vérité UNIQUE de la validation.
 * Aucune règle de validation dupliquée ici — on ne fait que RECONSTRUIRE le bloc.
 */

export type RunType = "matin" | "filet_j1" | "sentinelle";
export const RUN_TYPES: RunType[] = ["matin", "filet_j1", "sentinelle"];

export interface IngestCitation {
  numero: number;
  citations: number;
  bases: number;
}

export interface IngestCommentaire {
  confiance: number;
  selection: number[];
  analyse_courte: string;
  analyse_complete: string;
}

export interface ParsedIngest {
  contract_version: string | null;
  run_type: RunType;
  date_course: string; // AAAA-MM-JJ
  reunion_course: string; // RxCx
  hippodrome: string | null;
  nb_partants: number;
  type_pari: string;
  nb_sources: number;
  nb_sources_brut: number | null;
  echantillon_reduit: boolean;
  citations: IngestCitation[];
  /** bloc reconstruit « numero citations bases » — passé tel quel au validateur Lot 1 */
  texteBloc: string;
  commentaires: { elite: IngestCommentaire | null; pro: IngestCommentaire | null };
}

export interface ParseResult {
  ok: boolean;
  error?: string;
  parsed?: ParsedIngest;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RC_RE = /^R\d+C\d+$/i;

/**
 * Entier STRICT : rejette tout non-entier (ex. une cote 4.6 glissée par erreur
 * dans un champ citations/bases → null, jamais planchée en silence). Défense en
 * profondeur cohérente avec l'incident du 01/07.
 */
function toInt(v: unknown): number | null {
  if (typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function parseCommentaire(raw: any): IngestCommentaire | null {
  if (!raw || typeof raw !== "object") return null;
  const selection = Array.isArray(raw.selection)
    ? raw.selection.map((x: unknown) => toInt(x)).filter((n: number | null): n is number => n != null)
    : [];
  const confiance = toInt(raw.confiance);
  return {
    confiance: confiance != null ? confiance : 2,
    selection,
    analyse_courte: typeof raw.analyse_courte === "string" ? raw.analyse_courte : "",
    analyse_complete: typeof raw.analyse_complete === "string" ? raw.analyse_complete : "",
  };
}

/**
 * Valide la STRUCTURE de l'enveloppe (pas les invariants métier, qui restent au
 * Lot 1). Reconstruit le bloc de citations. Retourne une erreur claire (FR) si
 * un champ requis manque — le pipeline saura quoi corriger.
 */
export function parseIngestPayload(payload: any): ParseResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Payload vide ou non-objet." };
  }

  const run_type = payload.run_type;
  if (RUN_TYPES.indexOf(run_type) === -1) {
    return { ok: false, error: `run_type invalide (attendu : ${RUN_TYPES.join(" | ")}).` };
  }

  const course = payload.course;
  if (!course || typeof course !== "object") {
    return { ok: false, error: "Bloc « course » manquant." };
  }
  const date_course = typeof course.date === "string" ? course.date.trim() : "";
  if (!DATE_RE.test(date_course)) {
    return { ok: false, error: "course.date invalide (attendu AAAA-MM-JJ)." };
  }
  const reunion_course = typeof course.reunion_course === "string" ? course.reunion_course.trim().toUpperCase() : "";
  if (!RC_RE.test(reunion_course)) {
    return { ok: false, error: "course.reunion_course invalide (attendu RxCx, ex. R1C2)." };
  }
  const nb_partants = toInt(course.nb_partants);
  if (nb_partants == null || nb_partants < 1) {
    return { ok: false, error: "course.nb_partants requis (entier ≥ 1)." };
  }

  const consensus = payload.consensus;
  if (!consensus || typeof consensus !== "object") {
    return { ok: false, error: "Bloc « consensus » manquant." };
  }
  const nb_sources = toInt(consensus.nb_sources);
  if (nb_sources == null || nb_sources < 1) {
    return { ok: false, error: "consensus.nb_sources requis (entier ≥ 1)." };
  }
  if (!Array.isArray(consensus.citations) || consensus.citations.length === 0) {
    return { ok: false, error: "consensus.citations manquant ou vide." };
  }

  // Reconstruit le bloc « numero citations bases » à partir des objets. Toute
  // valeur non entière devient une ligne fautive → le validateur Lot 1 la rejette
  // (E01/E04) plutôt que de la « deviner » ici.
  const citations: IngestCitation[] = [];
  const lignes: string[] = [];
  for (let i = 0; i < consensus.citations.length; i++) {
    const c = consensus.citations[i];
    const numero = toInt(c?.numero);
    const cit = toInt(c?.citations);
    const bases = toInt(c?.bases);
    if (numero == null || cit == null || bases == null) {
      // ligne volontairement non conforme → E01 côté validateur (3 entiers requis)
      lignes.push(`${c?.numero} ${c?.citations} ${c?.bases}`);
      continue;
    }
    citations.push({ numero, citations: cit, bases });
    lignes.push(`${numero} ${cit} ${bases}`);
  }

  return {
    ok: true,
    parsed: {
      contract_version: typeof payload.contract_version === "string" ? payload.contract_version : null,
      run_type,
      date_course,
      reunion_course,
      hippodrome: typeof course.hippodrome === "string" ? course.hippodrome.trim() : null,
      nb_partants,
      type_pari: typeof payload.type_pari === "string" ? payload.type_pari : "QUINTE_PLUS",
      nb_sources,
      nb_sources_brut: toInt(consensus.nb_sources_brut),
      echantillon_reduit: consensus.echantillon_reduit === true,
      citations,
      texteBloc: lignes.join("\n"),
      commentaires: {
        elite: parseCommentaire(payload?.commentaires?.elite),
        pro: parseCommentaire(payload?.commentaires?.pro),
      },
    },
  };
}
