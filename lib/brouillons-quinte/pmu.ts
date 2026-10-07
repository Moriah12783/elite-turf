/**
 * lib/brouillons-quinte/pmu.ts
 *
 * Données PMU des brouillons du Quinté+ (spec
 * docs/superpowers/specs/2026-10-07-brouillons-quinte-design.md, §5).
 * Lecteurs PURS, testés sur les vraies réponses du 07/10/2026, + accès réseau
 * (relais puis direct, comme les cotes en direct des fiches course).
 */
import { fetchPmuJson } from "@/lib/pmu-cotes";
import { isoVersDdmmyyyy } from "@/lib/sync/pmu-arrivees";

export interface ParticipantPmu {
  numero: number;
  nom: string;
  nonPartant: boolean;
  /** Cote directe (rapport probable simple gagnant) ; null tant que le PMU n'en publie pas. */
  cote: number | null;
  /** Horodatage PMU de cette cote (ms). */
  coteMaj: number | null;
  /** Driver (trot) ou jockey (galop) : le PMU range les deux dans `driver`. */
  driver: string | null;
  entraineur: string | null;
  musique: string | null;
  /** Valeurs PMU : "FEMELLES", "MALES", "HONGRES". */
  sexe: string | null;
  age: number | null;
  /** Distance du partant, recul compris (m). */
  distance: number | null;
}

export interface CoursePmu {
  libelle: string | null;
  /** TROT_ATTELE, TROT_MONTE, PLAT, HAIES, STEEPLECHASE, CROSS… */
  specialite: string | null;
  distance: number | null;
  /** "FEMELLES" quand la course est réservée aux juments. */
  conditionSexe: string | null;
  /** Départ prévu (ms UTC). */
  heureDepart: number | null;
}

function positif(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function texte(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** PUR : réponse `/participants` du PMU → chevaux, non-partants compris. */
export function lireParticipantsPmu(json: unknown): ParticipantPmu[] {
  const liste = json && typeof json === "object" ? (json as { participants?: unknown }).participants : null;
  if (!Array.isArray(liste)) return [];
  const out: ParticipantPmu[] = [];
  for (const brut of liste as any[]) {
    const numero = Number(brut?.numPmu);
    if (!Number.isFinite(numero) || numero <= 0) continue;
    const direct = brut?.dernierRapportDirect ?? null;
    out.push({
      numero,
      nom: String(brut?.nom ?? "").trim(),
      nonPartant: String(brut?.statut ?? "").toUpperCase() === "NON_PARTANT",
      cote: positif(direct?.rapport),
      coteMaj: positif(direct?.dateRapport),
      driver: texte(brut?.driver),
      entraineur: texte(brut?.entraineur),
      musique: texte(brut?.musique),
      sexe: texte(brut?.sexe),
      age: positif(brut?.age),
      distance: positif(brut?.handicapDistance),
    });
  }
  return out;
}

/** PUR : réponse « course » du PMU → infos utiles ; null si rien d'exploitable. */
export function lireCoursePmu(json: unknown): CoursePmu | null {
  if (!json || typeof json !== "object") return null;
  const c = json as Record<string, unknown>;
  const out: CoursePmu = {
    libelle: texte(c.libelle),
    specialite: texte(c.specialite),
    distance: positif(c.distance),
    conditionSexe: texte(c.conditionSexe),
    heureDepart: positif(c.heureDepart),
  };
  return out.specialite || out.distance || out.heureDepart ? out : null;
}

/** Partants et course PMU. `participants: null` = PMU injoignable. */
export async function chargerDonneesPmu(
  dateISO: string,
  R: number,
  C: number,
  timeoutMs = 8000,
): Promise<{ participants: ParticipantPmu[] | null; course: CoursePmu | null }> {
  const base = `/rest/client/1/programme/${isoVersDdmmyyyy(dateISO)}/R${R}/C${C}`;
  const [jsonParticipants, jsonCourse] = await Promise.all([
    fetchPmuJson(`${base}/participants`, timeoutMs),
    fetchPmuJson(base, timeoutMs),
  ]);
  return {
    participants: jsonParticipants === null ? null : lireParticipantsPmu(jsonParticipants),
    course: jsonCourse === null ? null : lireCoursePmu(jsonCourse),
  };
}
