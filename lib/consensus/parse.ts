import type { PartantConsensus } from "./engine";

export interface ParseResult {
  partants: PartantConsensus[];
  errors: string[];
}

/**
 * Parse une table de consensus collée (1 ligne par cheval).
 *
 * Format attendu : `numero  citations  [bases]`
 *   - séparateurs de champs : espace, point-virgule, tabulation
 *   - `bases` (optionnel, entier) = nb de sources qui en font leur base / N°1
 *   - la COTE n'est PAS saisie ici : elle est enrichie automatiquement depuis la
 *     course liée (table `partants`). Cowork ne fournit que citations + bases.
 *   - tolérance : si le 3e champ ressemble à une cote (décimale, ex. "3.2"), il
 *     est ignoré (ancien format) et `bases` est lu en 4e champ.
 *     ⚠️ Limite connue : une ancienne cote ENTIÈRE en 3e champ (ex. "11 28 4 8")
 *     est indistinguable d'un `bases` → lue comme bases. Sans impact en pratique :
 *     le nouveau format n'émet plus jamais de cote (Elite l'enrichit en aval).
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
    // 3e champ = bases (entier). Tolère l'ancien format où le 3e champ était la
    // cote (décimale, ex. "3.2") → ignorée (la cote vient de la course liée),
    // et bases lu au 4e champ.
    let basesTok: string | undefined = tokens[2];
    if (basesTok != null && (basesTok.indexOf(".") !== -1 || basesTok.indexOf(",") !== -1)) {
      basesTok = tokens[3];
    }
    if (basesTok != null) {
      const bases = parseInt(basesTok, 10);
      if (isFinite(bases)) p.bases = bases;
    }

    seen[numero] = true;
    partants.push(p);
  }

  return { partants, errors };
}
