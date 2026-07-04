/**
 * lib/sync/lonaci-partants.ts
 *
 * Fallback des PARTANTS + COTES via l'API LONACI, quand Geny bloque (429) le
 * scraping des cotes. LONACI (opérateur ivoirien) expose, par course, les
 * partants avec nom, driver (`jocker`), entraîneur (`coach`), cote LIVE
 * (`currentCotes`) et statut (`status` ≠ "Partant" → non-partant).
 *
 * Les partants sont façonnés comme des `GenyParticipant` afin de réutiliser TEL
 * QUEL le code d'insertion existant (CLI enrich + backfill). LONACI = JOUR
 * seulement (pas de musique/âge → laissés vides, corrigés par Geny s'il revient).
 *
 * PUR (fetch global + import lonaci-api pur) → bundlable Node sur GitHub Actions.
 */
import { fetchLonaciProgramme, type LonaciReunion } from "@/lib/lonaci-api";

/** Partant façonné comme un GenyParticipant (sous-ensemble utilisé par l'insert). */
export interface LonaciPartant {
  numPmu:       number;
  nom:          string;
  jockey?:      { nom: string };
  entraineur?:  { nom: string };
  coteProbable?: number;
  placeCorde?:  number;
  sexe?:        string;
  nonPartant:   boolean;
}

/**
 * Normalise un partant brut LONACI → forme GenyParticipant. Retourne null si
 * numéro/nom manquants. PURE (testable).
 */
export function normalizeLonaciPartant(raw: unknown): LonaciPartant | null {
  const p = (raw ?? {}) as Record<string, unknown>;
  const numPmu = parseInt(String(p.numero), 10);
  const nom = typeof p.nom_partant === "string" ? p.nom_partant.trim() : "";
  if (!Number.isFinite(numPmu) || !nom) return null;

  const coteN = parseFloat(String(p.currentCotes ?? "").replace(",", "."));
  const corde = parseInt(String(p.corde ?? p.Placealacorde ?? ""), 10);
  const jocker = typeof p.jocker === "string" ? p.jocker.trim() : "";
  const coach = typeof p.coach === "string" ? p.coach.trim() : "";

  return {
    numPmu,
    nom,
    jockey:       jocker ? { nom: jocker } : undefined,
    entraineur:   coach ? { nom: coach } : undefined,
    coteProbable: Number.isFinite(coteN) && coteN > 0 ? coteN : undefined,
    placeCorde:   Number.isFinite(corde) ? corde : undefined,
    sexe:         typeof p.sexe === "string" && p.sexe ? p.sexe : undefined,
    // status "Partant" = courant ; tout autre ("Non partant"…) = rayé.
    nonPartant:   String(p.status ?? "").trim().toLowerCase() !== "partant",
  };
}

/**
 * Récupère les partants LONACI d'une date → map `${reunion}|${course}` → partants.
 * Une seule requête pour toutes les courses. Ne throw jamais (map vide si KO).
 * @param dateISO "YYYY-MM-DD"
 */
export async function fetchLonaciPartantsMap(dateISO: string): Promise<Map<string, LonaciPartant[]>> {
  const map = new Map<string, LonaciPartant[]>();

  let reunions: LonaciReunion[];
  try {
    reunions = await fetchLonaciProgramme();
  } catch {
    return map; // LONACI KO → pas de fallback (map vide)
  }

  for (const r of reunions) {
    for (const c of r.races ?? []) {
      // LONACI ne sert que le jour courant : on filtre par sécurité sur la date.
      if ((String(c.racedt ?? "").split(" ")[0]) !== dateISO) continue;

      const partants: LonaciPartant[] = [];
      for (const raw of (c.partants as unknown[]) ?? []) {
        const p = normalizeLonaciPartant(raw);
        if (p) partants.push(p);
      }
      if (partants.length > 0) map.set(`${r.nReunion}|${c.course_number}`, partants);
    }
  }
  return map;
}
