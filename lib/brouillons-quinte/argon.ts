/**
 * lib/brouillons-quinte/argon.ts — lecture du moteur Argon (spec
 * docs/superpowers/specs/2026-10-16-brouillons-argon-design.md, §5 et §7).
 *
 * Lecture STRICTE : un champ attendu absent ou mal typé = échec, jamais un
 * brouillon approximatif. Seule la course du Quinté+ est lue en détail : une
 * autre course mal formée dans la réponse ne bloque rien.
 */
import { memeNom, nomCheval } from "@/lib/pmu-cotes";
import type { ParticipantPmu } from "./pmu";

export interface CoureurArgon {
  numero: number;
  nom: string;
  /** `edge_pts` d'Argon au moment de la lecture (non figé dans l'édition T-90) ; null si absent. */
  avantage: number | null;
}

export interface CourseArgon {
  date: string;
  reunion: number;
  course: number;
  hippodrome: string;
  t90: { argon8: number[]; sealed: boolean; lockGmt: string | null };
  coureurs: CoureurArgon[];
  /** 1 à 5. */
  etoiles: number;
  /** `is_no_bet` : Argon déconseille de jouer la course. */
  deconseillee: boolean;
  /** Avis d'Argon (couplé maître, sniper), recopié tel quel dans l'e-mail. */
  decision: string | null;
  sniper: { numero: number; cote: number | null } | null;
}

export type RaisonArgon =
  | "argon_injoignable"
  | "argon_format_inattendu"
  | "argon_course_introuvable"
  | "argon_non_scelle"
  | "argon_partants_incoherents"
  | "argon_partants_insuffisants";

export interface CibleArgon {
  /** Date de la course (Paris), AAAA-MM-JJ. */
  dateISO: string;
  reunion: number;
  course: number;
  /** Nom de l'hippodrome en base. */
  hippodrome: string;
}

const TAILLE_ARGON = 8;

function entierPositif(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function texteNonVide(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

/** Nombre fini, ou null quand le champ est absent ou null ; undefined = mal typé. */
function nombreOuNul(v: unknown): number | null | undefined {
  if (v === undefined || v === null) return null;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Texte, ou null quand le champ est absent ou null ; undefined = mal typé. */
function texteOuNul(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return null;
  return typeof v === "string" ? v : undefined;
}

/** PUR : la course retenue, lue strictement ; null si un champ n'a pas le format attendu. */
function lireCourse(r: any): CourseArgon | null {
  const t90 = r?.editions_schedule?.T90;
  if (!t90 || typeof t90 !== "object") return null;
  const argon8 = t90.argon8;
  if (!Array.isArray(argon8) || argon8.length !== TAILLE_ARGON || !argon8.every(entierPositif)) return null;
  if (argon8.some((n: number, i: number) => argon8.indexOf(n) !== i)) return null;
  if (typeof t90.sealed !== "boolean") return null;
  const lockGmt = texteOuNul(t90.lock_gmt);
  if (lockGmt === undefined) return null;

  if (!Array.isArray(r.runners)) return null;
  const coureurs: CoureurArgon[] = [];
  for (const x of r.runners as any[]) {
    const avantage = nombreOuNul(x?.edge_pts);
    if (!entierPositif(x?.num) || !texteNonVide(x?.name) || avantage === undefined) return null;
    coureurs.push({ numero: x.num, nom: x.name.trim(), avantage });
  }

  const etoiles = r.confidence_stars;
  if (!Number.isInteger(etoiles) || etoiles < 1 || etoiles > 5) return null;
  if (typeof r.is_no_bet !== "boolean") return null;
  const decision = texteOuNul(r.decision);
  if (decision === undefined) return null;

  const sniperNum = r.sniper_num;
  const sniperCote = nombreOuNul(r.sniper_odds);
  if (sniperCote === undefined || (sniperNum !== undefined && sniperNum !== null && !entierPositif(sniperNum))) return null;

  return {
    date: r.date,
    reunion: r.reunion,
    course: r.course_num,
    hippodrome: r.hippodrome,
    t90: { argon8: argon8.slice(), sealed: t90.sealed, lockGmt },
    coureurs,
    etoiles,
    deconseillee: r.is_no_bet,
    decision,
    sniper: entierPositif(sniperNum) ? { numero: sniperNum, cote: sniperCote } : null,
  };
}

/**
 * PUR : la course du Quinté+ chez Argon (même date, même R/C, même hippodrome).
 * L'historique d'Argon contient d'autres jours aux mêmes numéros : la date fait
 * partie de l'identité. Plusieurs candidates = réponse anormale.
 */
export function trouverCourseArgon(
  json: unknown,
  cible: CibleArgon,
): { ok: true; course: CourseArgon } | { ok: false; raison: "argon_format_inattendu" | "argon_course_introuvable" } {
  const racine = json && typeof json === "object" ? (json as { status?: unknown; races?: unknown }) : null;
  if (!racine || racine.status !== "ok" || !Array.isArray(racine.races)) return { ok: false, raison: "argon_format_inattendu" };
  const hippodromeCible = nomCheval(cible.hippodrome);
  const candidates = (racine.races as any[]).filter((r) =>
    r && r.date === cible.dateISO && r.reunion === cible.reunion && r.course_num === cible.course
    && typeof r.hippodrome === "string" && memeNom(nomCheval(r.hippodrome), hippodromeCible));
  if (candidates.length === 0) return { ok: false, raison: "argon_course_introuvable" };
  if (candidates.length > 1) return { ok: false, raison: "argon_format_inattendu" };
  const course = lireCourse(candidates[0]);
  return course ? { ok: true, course } : { ok: false, raison: "argon_format_inattendu" };
}

/**
 * PUR : les 8 chevaux d'Argon sont-ils les nôtres ? Chaque numéro doit avoir un
 * coureur Argon et un participant PMU (partant ou non) qui désignent le même
 * cheval. Sinon on ne prépare rien : ce serait la sélection d'une autre course.
 */
export function controlerChevauxArgon(course: CourseArgon, participants: ParticipantPmu[]): "argon_partants_incoherents" | null {
  for (const n of course.t90.argon8) {
    const coureur = course.coureurs.find((c) => c.numero === n);
    const pmu = participants.find((p) => p.numero === n);
    if (!coureur || !pmu || !memeNom(nomCheval(coureur.nom), nomCheval(pmu.nom))) return "argon_partants_incoherents";
  }
  return null;
}
