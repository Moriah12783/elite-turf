import type { PartantConsensus } from "./engine";

export interface ParseResult {
  partants: PartantConsensus[];
  errors: string[];
}

/**
 * Parse une table de consensus collée (1 ligne par cheval).
 *
 * Format attendu : `numero  citations  [cote]  [bases]`
 *   - séparateurs de champs : espace, point-virgule, tabulation (PAS la virgule)
 *   - cote décimale : "3.2" ou "3,2" (la virgule = décimale, jamais séparateur)
 *   - lignes vides, commentaires (#…) et lignes d'en-tête (1er token non numérique) ignorés
 *   - doublons de numéro ignorés (1ère occurrence gardée)
 *
 * Module PUR : aucune dépendance serveur, testable, réutilisable côté client.
 */
export function parseConsensus(text: string): ParseResult {
  const partants: PartantConsensus[] = [];
  const errors: string[] = [];
  const seen: Record<number, boolean> = {};
  const lines = (text || "").split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.charAt(0) === "#") continue;

    const tokens = raw.split(/[\s;]+/).filter((t) => t.length > 0);
    if (tokens.length === 0) continue;
    if (!/^\d+$/.test(tokens[0])) continue; // ligne d'en-tête (ex. "Cheval Citations Cote")

    if (tokens.length < 2) {
      errors.push(`Ligne ${i + 1} ignorée (citations manquantes) : "${raw}"`);
      continue;
    }

    const numero = parseInt(tokens[0], 10);
    const citations = parseInt(tokens[1], 10);
    if (!isFinite(numero) || !isFinite(citations)) {
      errors.push(`Ligne ${i + 1} invalide : "${raw}"`);
      continue;
    }
    if (seen[numero]) {
      errors.push(`Cheval ${numero} en double (ligne ${i + 1}) — ignoré`);
      continue;
    }

    const p: PartantConsensus = { numero, citations };
    if (tokens[2] != null) {
      const cote = parseFloat(tokens[2].replace(",", "."));
      if (isFinite(cote)) p.cote = cote;
    }
    if (tokens[3] != null) {
      const bases = parseInt(tokens[3], 10);
      if (isFinite(bases)) p.bases = bases;
    }

    seen[numero] = true;
    partants.push(p);
  }

  return { partants, errors };
}
