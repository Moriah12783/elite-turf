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
 * IDENTITÉ : LONACI numérote ses réunions à sa façon. Jusqu'au 03/10/2026, sa
 * R9 (Settat, Maroc) remplissait notre R9 (Beaumont-de-Lomagne, trot) de chevaux
 * marocains. Une course LONACI ne sert que si sa réunion est sur le même
 * hippodrome que la nôtre (memeReunionLonaci).
 *
 * PUR (fetch global + import lonaci-api pur) → bundlable Node sur GitHub Actions.
 */
import { fetchLonaciProgramme, type LonaciReunion } from "@/lib/lonaci-api";
import { cotesPlausibles } from "@/lib/cotes/fiabilite";
import { memesHippodromes } from "@/lib/sync/pmu-rattrapage";

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
 * Retire les cotes d'une course quand elles ne sont pas de vraies cotes : la
 * LONACI renvoie « 1,2 » pour chaque cheval quand elle n'a pas de cote (93 % des
 * courses marocaines au 02/10/2026). PURE (testable).
 */
export function retirerCotesFactices(partants: LonaciPartant[]): LonaciPartant[] {
  if (cotesPlausibles(partants.filter((p) => !p.nonPartant).map((p) => p.coteProbable))) return partants;
  return partants.map((p) => ({ ...p, coteProbable: undefined }));
}

/** Une course LONACI : l'hippodrome de sa réunion et ses partants. */
export interface CourseLonaci {
  hippodrome: string | null;
  partants: LonaciPartant[];
}

/**
 * PUR : la course LONACI de mêmes numéros est-elle dans la même réunion que la
 * nôtre ? Même hippodrome exigé ; hippodrome LONACI inconnu → false.
 */
export function memeReunionLonaci(hippodromeBase: string | null, lonaci: CourseLonaci): boolean {
  return memesHippodromes(hippodromeBase, lonaci.hippodrome);
}

/**
 * Récupère les partants LONACI d'une date → map `${reunion}|${course}` → course
 * (hippodrome de la réunion + partants). Une seule requête pour toutes les
 * courses. Ne throw jamais (map vide si KO). La clé R|C ne garantit PAS la même
 * course : l'appelant vérifie la réunion (memeReunionLonaci).
 * @param dateISO "YYYY-MM-DD"
 */
export async function fetchLonaciPartantsMap(dateISO: string): Promise<Map<string, CourseLonaci>> {
  const map = new Map<string, CourseLonaci>();

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
      if (partants.length > 0) {
        map.set(`${r.nReunion}|${c.course_number}`, { hippodrome: r.libelle || null, partants: retirerCotesFactices(partants) });
      }
    }
  }
  return map;
}
