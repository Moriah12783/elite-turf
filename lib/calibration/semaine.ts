/**
 * lib/calibration/semaine.ts — calcul des semaines ISO (lundi → dimanche), en UTC.
 *
 * Le tableau de bord de calibration scelle chaque lundi la semaine PRÉCÉDENTE,
 * complète et intégralement jugée. Tout est calculé en UTC (les crons
 * Cloudflare sont en UTC fixe, cf. CLAUDE.md).
 */

/** Premier jour scellé du journal Radar (v4-labels, édition du matin). */
export const DEBUT_JOURNAL = "2026-07-22";

/** Ordre d'affichage des tranches de cote (identique au protocole Phase 1). */
export const TRANCHES = ["<2", "2-3", "3-5", "5-10", "10-20", "20+"] as const;
export type Tranche = (typeof TRANCHES)[number];

const JOUR_MS = 24 * 60 * 60 * 1000;

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Lundi (UTC) de la semaine ISO contenant `d`. */
export function lundiDeLaSemaine(d: Date): Date {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const jour = utc.getUTCDay(); // 0 = dimanche
  const decalage = jour === 0 ? 6 : jour - 1;
  return new Date(utc.getTime() - decalage * JOUR_MS);
}

/** Lundi de la dernière semaine COMPLÈTE avant `now` (la semaine en cours est exclue). */
export function lundiSemainePrecedente(now: Date = new Date()): string {
  const lundiCourant = lundiDeLaSemaine(now);
  return toIsoDate(new Date(lundiCourant.getTime() - 7 * JOUR_MS));
}

/** Dimanche (ISO) de la semaine qui commence le lundi `semaine`. */
export function dimancheDeLaSemaine(semaine: string): string {
  const lundi = new Date(`${semaine}T00:00:00Z`);
  return toIsoDate(new Date(lundi.getTime() + 6 * JOUR_MS));
}

/** Vrai si `s` est une date ISO valide qui tombe un lundi (UTC). */
export function estUnLundi(s: string | undefined | null): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && toIsoDate(d) === s && d.getUTCDay() === 1;
}

/** Libellé humain « du 31 août au 6 septembre 2026 ». */
export function libelleSemaine(semaine: string): string {
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
  const fmtAnnee = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const lundi = new Date(`${semaine}T00:00:00Z`);
  const dimanche = new Date(`${dimancheDeLaSemaine(semaine)}T00:00:00Z`);
  return `du ${fmt.format(lundi)} au ${fmtAnnee.format(dimanche)}`;
}
