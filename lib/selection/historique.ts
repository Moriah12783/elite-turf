/**
 * lib/selection/historique.ts
 *
 * « Course par course » du bilan de la Sélection stats (admin, demande de Steph
 * du 03/10/2026) : pour chaque photo prise avant le départ (cf. photo.ts), la
 * sélection, les favoris PMU du même instant (même nombre de chevaux),
 * l'arrivée et ce que chacune a couvert. Filtres par jour, par mois ou sur
 * tout l'historique, et recherche par hippodrome, réunion, course ou épreuve.
 * PUR : testable, sans I/O.
 */
import { favoris } from "./bilan";

/** Une photo de la sélection, avec sa course. */
export interface PhotoSelection {
  courseId: string;
  /** Sélection photographiée, dans l'ordre. */
  numeros: number[];
  /** Marché au moment de la photo : numéro → cote. */
  cotesMarche: Record<string, number>;
  nbPartants: number;
  /** « csv » = cotes du moment ; « base » = cotes en base (repli). */
  sourceCotes: string;
  priseLe: string;
  departPrevu: string | null;
  /** Date de la course, heure de Paris (AAAA-MM-JJ). */
  date: string | null;
  /** Heure de départ, heure de Paris (HH:MM ou HH:MM:SS). */
  heure: string | null;
  hippodrome: string | null;
  reunion: number | null;
  numeroCourse: number | null;
  libelle: string | null;
  /** Arrivée officielle (vide tant qu'elle n'est pas connue). */
  arrivee: number[];
}

export interface Couverture {
  gagnant: boolean;
  /** Chevaux des 3 premiers présents dans la sélection (0 à 3). */
  troisPremiers: number;
  /** Chevaux des 5 premiers présents dans la sélection (0 à `nCinq`). */
  cinqPremiers: number;
  /** Taille du « 5 premiers » : 5, ou moins si l'arrivée est plus courte. */
  nCinq: number;
}

/** `null` tant que l'arrivée ne compte pas au moins les 3 premiers. */
export function couverture(selection: number[], arrivee: number[]): Couverture | null {
  if (arrivee.length < 3 || selection.length === 0) return null;
  const dedans = (numeros: number[]) => numeros.filter((n) => selection.indexOf(n) !== -1).length;
  const cinq = arrivee.slice(0, 5);
  return {
    gagnant: selection.indexOf(arrivee[0]) !== -1,
    troisPremiers: dedans(arrivee.slice(0, 3)),
    cinqPremiers: dedans(cinq),
    nCinq: cinq.length,
  };
}

export interface LigneCourse {
  photo: PhotoSelection;
  /** Favoris PMU de la photo, autant que de chevaux sélectionnés. */
  marche: number[];
  couvSelection: Couverture | null;
  couvMarche: Couverture | null;
  /** Minutes entre la photo et le départ prévu. */
  minutesAvant: number | null;
}

export function ligneCourse(photo: PhotoSelection): LigneCourse {
  const marche = favoris(photo.cotesMarche, photo.numeros.length);
  const ecart = photo.departPrevu ? Date.parse(photo.departPrevu) - Date.parse(photo.priseLe) : NaN;
  return {
    photo,
    marche,
    couvSelection: couverture(photo.numeros, photo.arrivee),
    couvMarche: couverture(marche, photo.arrivee),
    minutesAvant: Number.isFinite(ecart) ? Math.round(ecart / 60000) : null,
  };
}

// ── Périodes ───────────────────────────────────────────────────────────

/** « AAAA-MM-JJ » = un jour, « AAAA-MM » = un mois, « tout » = tout l'historique. */
export function periodeValide(periode: string | undefined): periode is string {
  return !!periode && (periode === "tout" || /^\d{4}-\d{2}(-\d{2})?$/.test(periode));
}

export function dansPeriode(date: string | null, periode: string): boolean {
  if (!date) return false;
  return periode === "tout" || date.startsWith(periode);
}

/** Aujourd'hui s'il a des photos, sinon le dernier jour photographié. */
export function periodeParDefaut(dates: Array<string | null>, aujourdHui: string): string {
  const jours = dates.filter((d): d is string => !!d);
  if (jours.indexOf(aujourdHui) !== -1 || jours.length === 0) return aujourdHui;
  return jours.reduce((max, d) => (d > max ? d : max));
}

export interface BoutonPeriode {
  periode: string;
  libelle: string;
  n: number;
}

/**
 * Aujourd'hui et hier (toujours affichés, même à 0), les autres jours
 * photographiés (les plus récents, `maxJours` jours en tout), puis les mois et
 * tout l'historique — avec le nombre de photos de chacun.
 */
export function boutonsPeriodes(
  dates: Array<string | null>,
  aujourdHui: string,
  hier: string,
  maxJours = 12,
): BoutonPeriode[] {
  const parJour = new Map<string, number>();
  const parMois = new Map<string, number>();
  let total = 0;
  for (const d of dates) {
    if (!d) continue;
    total++;
    parJour.set(d, (parJour.get(d) ?? 0) + 1);
    parMois.set(d.slice(0, 7), (parMois.get(d.slice(0, 7)) ?? 0) + 1);
  }
  const court = (d: string) => d.slice(5);
  const jours: BoutonPeriode[] = [
    { periode: aujourdHui, libelle: `Aujourd'hui (${court(aujourdHui)})`, n: parJour.get(aujourdHui) ?? 0 },
    { periode: hier, libelle: `Hier (${court(hier)})`, n: parJour.get(hier) ?? 0 },
  ];
  // tsconfig sans `target` → pas d'itération directe de Map ; on passe par les clés.
  const autres = Array.from(parJour.keys())
    .filter((d) => d !== aujourdHui && d !== hier)
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, Math.max(0, maxJours - jours.length));
  for (const d of autres) jours.push({ periode: d, libelle: court(d), n: parJour.get(d) ?? 0 });
  const mois = Array.from(parMois.keys())
    .sort((a, b) => (a < b ? 1 : -1))
    .map((m) => ({ periode: m, libelle: m, n: parMois.get(m) ?? 0 }));
  return [...jours, ...mois, { periode: "tout", libelle: "Tout l'historique", n: total }];
}

// ── Recherche ──────────────────────────────────────────────────────────

const normaliser = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Hippodrome, épreuve ou code de course. Un code (« R1C4 », « r1 c4 ») est
 * comparé EXACTEMENT au code de la course : « R1C1 » ne trouve pas R1C10.
 */
export function correspond(photo: PhotoSelection, recherche: string): boolean {
  const q = normaliser(recherche);
  if (!q) return true;
  const code = normaliser(`R${photo.reunion ?? ""}C${photo.numeroCourse ?? ""}`);
  if (/^r\d+c\d+$/.test(q)) return q === code;
  return normaliser(`${photo.hippodrome ?? ""} ${photo.libelle ?? ""}`).includes(q) || code.includes(q);
}

// ── Totaux de la période affichée ──────────────────────────────────────

interface Compte {
  gagnant: number;
  /** Courses dont les 3 premiers sont TOUS dans la sélection. */
  troisPremiers: number;
  /** Courses dont les 5 premiers sont TOUS dans la sélection (arrivées d'au moins 5). */
  cinqPremiers: number;
}

export interface Totaux {
  /** Courses avec arrivée. */
  n: number;
  /** Courses dont l'arrivée compte au moins 5 chevaux. */
  nCinq: number;
  selection: Compte;
  marche: Compte;
}

export function totaux(lignes: LigneCourse[]): Totaux {
  const t: Totaux = {
    n: 0,
    nCinq: 0,
    selection: { gagnant: 0, troisPremiers: 0, cinqPremiers: 0 },
    marche: { gagnant: 0, troisPremiers: 0, cinqPremiers: 0 },
  };
  const ajouter = (c: Compte, v: Couverture) => {
    if (v.gagnant) c.gagnant++;
    if (v.troisPremiers === 3) c.troisPremiers++;
    if (v.nCinq === 5 && v.cinqPremiers === 5) c.cinqPremiers++;
  };
  for (const l of lignes) {
    if (!l.couvSelection || !l.couvMarche) continue;
    t.n++;
    if (l.couvSelection.nCinq === 5) t.nCinq++;
    ajouter(t.selection, l.couvSelection);
    ajouter(t.marche, l.couvMarche);
  }
  return t;
}
