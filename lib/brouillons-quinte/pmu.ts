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
import { lirePerformancesPmu } from "@/lib/courses/performances-pmu";

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
  /** Ferrure PMU (`deferre`) : DEFERRE_ANTERIEURS_POSTERIEURS, PROTEGE_ANTERIEURS… ; null = ferré ou inconnu. */
  deferre: string | null;
  /** Poids porté (kg) en plat et en obstacle ; null au trot attelé ou si inconnu. */
  poids: number | null;
  /** Place à la corde (stalles) en plat ; null sinon. */
  corde: number | null;
  /** Valeur de handicap ; null hors handicap. */
  valeurHandicap: number | null;
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
  /** Allocation totale de la course (euros). */
  allocation: number | null;
  /** CORDE_DROITE ou CORDE_GAUCHE. */
  corde: string | null;
  /** `categorieParticularite` : EUROPEENNE, NATIONALE_AUTOSTART, HANDICAP_DIVISE… */
  categorie: string | null;
  /** État du terrain (pénétromètre) : « Très souple », « Bon », « PSF »… */
  terrain: string | null;
  /** Parcours : « GRANDE PISTE », « 1800 M. PISTE EN SABLE FIBRE »… */
  parcours: string | null;
}

/**
 * Allocations (euros) des dernières courses de chaque cheval, par numéro, de la
 * plus récente à la plus ancienne ; `null` pour une course sans montant. Un
 * cheval sans course connue est absent.
 */
export type AllocationsPmu = Record<number, Array<number | null>>;

function positif(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function texte(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Le PMU écrit le poids en hectogrammes (620 = 62 kg). */
function poidsKg(v: unknown): number | null {
  const n = positif(v);
  if (n === null) return null;
  return n >= 200 ? Math.round(n) / 10 : n;
}

/** Ferrure à signaler : « FERRE » (ou absente) ne dit rien. */
function ferrureUtile(v: unknown): string | null {
  const t = texte(v);
  return t && t.toUpperCase() !== "FERRE" ? t.toUpperCase() : null;
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
      deferre: ferrureUtile(brut?.deferre),
      poids: poidsKg(brut?.handicapPoids ?? brut?.poidsConditionMonte),
      corde: positif(brut?.placeCorde),
      valeurHandicap: positif(brut?.handicapValeur),
    });
  }
  return out;
}

/** PUR : réponse « course » du PMU → infos utiles ; null si rien d'exploitable. */
/**
 * Le PMU range haies, steeple-chase et cross sous la spécialité « OBSTACLE » :
 * la discipline précise est dans `discipline` (Quinté+ d'Auteuil du 22/10/2026 :
 * specialite OBSTACLE, discipline STEEPLECHASE).
 */
function specialitePmu(c: Record<string, unknown>): string | null {
  const s = texte(c.specialite);
  const d = texte(c.discipline);
  if (s === "OBSTACLE" && d && ["HAIES", "STEEPLECHASE", "CROSS"].indexOf(d) !== -1) return d;
  return s;
}

export function lireCoursePmu(json: unknown): CoursePmu | null {
  if (!json || typeof json !== "object") return null;
  const c = json as Record<string, unknown>;
  const out: CoursePmu = {
    libelle: texte(c.libelle),
    specialite: specialitePmu(c),
    distance: positif(c.distance),
    conditionSexe: texte(c.conditionSexe),
    heureDepart: positif(c.heureDepart),
    allocation: positif(c.montantPrix),
    corde: texte(c.corde),
    categorie: texte(c.categorieParticularite),
    terrain: texte((c.penetrometre as { intitule?: unknown } | null | undefined)?.intitule),
    parcours: texte(c.parcours),
  };
  return out.specialite || out.distance || out.heureDepart ? out : null;
}

/**
 * PUR : réponse `/performances-detaillees/pretty` du PMU → allocations des
 * dernières courses (le PMU en donne 5 au plus). Sert à voir, dans l'e-mail à
 * Steph, quel cheval monte ou descend de catégorie.
 */
export function lireAllocationsPmu(json: unknown): AllocationsPmu {
  const out: AllocationsPmu = {};
  for (const cheval of lirePerformancesPmu(json)) {
    if (cheval.courses.length > 0) out[cheval.numero] = cheval.courses.map((c) => c.allocation);
  }
  return out;
}

/**
 * Partants, course et allocations PMU. `participants: null` = PMU injoignable.
 * `allocations: null` = performances indisponibles : simple confort de lecture,
 * leur absence ne bloque rien.
 */
export async function chargerDonneesPmu(
  dateISO: string,
  R: number,
  C: number,
  timeoutMs = 8000,
): Promise<{ participants: ParticipantPmu[] | null; course: CoursePmu | null; allocations: AllocationsPmu | null }> {
  const base = `/rest/client/1/programme/${isoVersDdmmyyyy(dateISO)}/R${R}/C${C}`;
  const [jsonParticipants, jsonCourse, jsonPerformances] = await Promise.all([
    fetchPmuJson(`${base}/participants`, timeoutMs),
    fetchPmuJson(base, timeoutMs),
    fetchPmuJson(`${base}/performances-detaillees/pretty`, timeoutMs),
  ]);
  return {
    participants: jsonParticipants === null ? null : lireParticipantsPmu(jsonParticipants),
    course: jsonCourse === null ? null : lireCoursePmu(jsonCourse),
    allocations: jsonPerformances === null ? null : lireAllocationsPmu(jsonPerformances),
  };
}
