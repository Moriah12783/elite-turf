/**
 * lib/brouillons-quinte/commentaires.ts — textes des brouillons (spec §7).
 *
 * Modèles de phrases FIXES, remplis uniquement avec les données PMU. Aucune
 * opinion ; un fait manquant fait omettre la phrase. Noms recopiés tels que le
 * PMU les écrit. Steph peut tout modifier avant de publier.
 *
 * Réponse « course » du PMU absente : discipline et libellé driver/jockey sont
 * omis. `courses.categorie` n'est PAS un repli : elle a longtemps été écrite
 * « PLAT » par défaut (migration 20260515_backfill_discipline_trot).
 */
import type { CoursePmu, ParticipantPmu } from "./pmu";
import { analyserMusique, type BilanMusique } from "./musique";

export const ANALYSE_COURTE_MAX = 160;

/** Vérifiés par les tests : jamais dans un texte produit. */
export const MOTS_INTERDITS = ["garanti", "assuré", "sûr", "certain", "immanquable", "coup sûr", "100 %", "jackpot", "gagnant à coup"];

export interface ContexteCourse {
  /** Date de la course (Paris), AAAA-MM-JJ. */
  dateISO: string;
  /** Libellé du site (courses.libelle), ex. « Prix des Gobelins ». */
  prix: string;
  hippodrome: string;
  reunion: number;
  course: number;
  /** Heure de départ en base (Paris), « 13:55:00 ». */
  heureParis: string;
  departUtc: Date;
  coursePmu: CoursePmu | null;
  /** Repli si ni les partants ni la course PMU ne donnent la distance. */
  distanceBase: number | null;
  /** Partants PMU, non-partants compris (ils sont écartés ici). */
  participants: ParticipantPmu[];
  /** Plus récente des cotes utilisées (ms) ; null si inconnue. */
  releveCotes: number | null;
}

export interface ChevalCommente {
  numero: number;
  nom: string;
  rang: number;
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DISCIPLINES: Record<string, string> = {
  TROT_ATTELE: "Trot attelé",
  TROT_MONTE: "Trot monté",
  PLAT: "Plat",
  HAIES: "Haies",
  STEEPLECHASE: "Steeple-chase",
  CROSS: "Cross",
};

function deux(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** « 11h55 » (heure UTC = GMT). */
export function heureGmt(ms: number): string {
  const d = new Date(ms);
  return `${deux(d.getUTCHours())}h${deux(d.getUTCMinutes())}`;
}

function heureParisLisible(heure: string): string {
  const m = String(heure).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${deux(Number(m[1]))}h${m[2]}` : heure;
}

function dateLongue(dateISO: string): string {
  const m = String(dateISO).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateISO;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${JOURS[d.getUTCDay()]} ${Number(m[3])} ${MOIS[Number(m[2]) - 1]} ${m[1]}`;
}

/** 2875 → « 2 875 ». */
function metres(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function partantsDe(ctx: ContexteCourse): ParticipantPmu[] {
  return ctx.participants.filter((p) => !p.nonPartant);
}

function trouver(ctx: ContexteCourse, numero: number): ParticipantPmu | null {
  for (const p of ctx.participants) if (p.numero === numero) return p;
  return null;
}

function feminin(p: ParticipantPmu | null): boolean {
  return !!p && p.sexe === "FEMELLES";
}

function champFeminin(ctx: ContexteCourse): boolean {
  return !!ctx.coursePmu && ctx.coursePmu.conditionSexe === "FEMELLES";
}

function discipline(ctx: ContexteCourse): string | null {
  const s = ctx.coursePmu ? ctx.coursePmu.specialite : null;
  return s && DISCIPLINES[s] ? DISCIPLINES[s] : null;
}

/** « driver » au trot attelé, « jockey » sinon ; null si la discipline est inconnue. */
function libelleActeur(ctx: ContexteCourse): string | null {
  const s = ctx.coursePmu ? ctx.coursePmu.specialite : null;
  if (!s || !DISCIPLINES[s]) return null;
  return s === "TROT_ATTELE" ? "driver" : "jockey";
}

interface GroupeDistance {
  distance: number;
  numeros: number[];
}

function groupesDistance(partants: ParticipantPmu[]): GroupeDistance[] {
  const groupes: GroupeDistance[] = [];
  for (const p of partants) {
    if (p.distance === null) continue;
    let g: GroupeDistance | null = null;
    for (const x of groupes) if (x.distance === p.distance) g = x;
    if (!g) {
      g = { distance: p.distance, numeros: [] };
      groupes.push(g);
    }
    g.numeros.push(p.numero);
  }
  for (const g of groupes) g.numeros.sort((a, b) => a - b);
  return groupes.sort((a, b) => a.distance - b.distance);
}

function distanceDeBase(ctx: ContexteCourse, groupes: GroupeDistance[]): number | null {
  if (groupes.length > 0) return groupes[0].distance;
  if (ctx.coursePmu && ctx.coursePmu.distance) return ctx.coursePmu.distance;
  return ctx.distanceBase;
}

/** [10, 11, 13, 14, 15] → « 10, 11 et 13 à 15 » : une suite de 3 numéros ou plus est resserrée. */
function listeNumeros(nums: number[]): string {
  const morceaux: string[] = [];
  let i = 0;
  while (i < nums.length) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    if (j - i >= 2) {
      morceaux.push(`${nums[i]} à ${nums[j]}`);
    } else {
      for (let k = i; k <= j; k++) morceaux.push(String(nums[k]));
    }
    i = j + 1;
  }
  if (morceaux.length <= 1) return morceaux.join("");
  return `${morceaux.slice(0, -1).join(", ")} et ${morceaux[morceaux.length - 1]}`;
}

/** Recul pour l'analyse courte : exactement deux distances, sinon rien. */
function phraseReculCourte(groupes: GroupeDistance[], fem: boolean): string | null {
  if (groupes.length !== 2) return null;
  const g = groupes[1];
  const d = g.distance - groupes[0].distance;
  if (g.numeros.length === 1) return `Le n°${g.numeros[0]} part avec ${d} m de recul.`;
  const liste = listeNumeros(g.numeros);
  if (liste.indexOf(",") === -1) return `Les n°${liste} partent avec ${d} m de recul.`;
  return `${g.numeros.length} ${fem ? "partantes" : "partants"} partent avec ${d} m de recul.`;
}

function ages(partants: ParticipantPmu[]): string {
  let min = Infinity;
  let max = -Infinity;
  for (const p of partants) {
    if (p.age === null) continue;
    if (p.age < min) min = p.age;
    if (p.age > max) max = p.age;
  }
  if (min === Infinity) return "";
  return min === max ? ` de ${min} ans` : ` de ${min} à ${max} ans`;
}

/** « {Discipline}, {distance} m, {N} partant(e)s{ âges} » — sans le point final. */
function tete(ctx: ContexteCourse, avecAges: boolean): string {
  const partants = partantsDe(ctx);
  const dist = distanceDeBase(ctx, groupesDistance(partants));
  const morceaux: string[] = [];
  const disc = discipline(ctx);
  if (disc) morceaux.push(disc);
  if (dist) morceaux.push(`${metres(dist)} m`);
  morceaux.push(`${partants.length} ${champFeminin(ctx) ? "partantes" : "partants"}${avecAges ? ages(partants) : ""}`);
  return morceaux.join(", ");
}

/**
 * PUR : analyse courte (aperçu), 160 caractères au plus. Si c'est trop long :
 * on retire la phrase de recul, puis le driver, puis le début ; jamais de mot
 * coupé.
 */
export function analyseCourte(ctx: ContexteCourse, pivot: ChevalCommente): string {
  const p = trouver(ctx, pivot.numero);
  const favori = feminin(p) ? "favorite" : "favori";
  const debut = `${tete(ctx, false)}.`;
  const avecDriver = `Pivot : ${pivot.nom} (n°${pivot.numero}${p && p.driver ? `, ${p.driver}` : ""}), ${favori}.`;
  const sansDriver = `Pivot : ${pivot.nom} (n°${pivot.numero}), ${favori}.`;
  const recul = phraseReculCourte(groupesDistance(partantsDe(ctx)), champFeminin(ctx));
  const essais: Array<Array<string | null>> = [
    [debut, avecDriver, recul],
    [debut, avecDriver],
    [debut, sansDriver],
    [sansDriver],
  ];
  for (const morceaux of essais) {
    const t = morceaux.filter((x): x is string => !!x).join(" ");
    if (t.length <= ANALYSE_COURTE_MAX) return t;
  }
  return `Pivot : n°${pivot.numero}, ${favori}.`;
}

function surSesDernieres(n: number): string {
  return n === 1 ? "sur sa dernière course" : `sur ses ${n} dernières courses`;
}

/** Forme et fautes, sans point final ; "" si rien à dire. */
function formeEtFautes(b: BilanMusique | null, fem: boolean): string {
  if (!b) return "";
  const n = b.courses;
  const premiers = fem ? "premières" : "premiers";
  let forme = "";
  if (b.victoires >= 1) {
    forme = b.victoires === 1 && b.derniereGagnee ? "A gagné sa dernière course" : `A gagné ${b.victoires} de ses ${n} dernières courses`;
  } else if (b.top3 >= 2) {
    forme = `Dans les 3 ${premiers} ${b.top3} fois ${surSesDernieres(n)}`;
  } else if (b.top5 >= 2) {
    forme = `Dans les 5 ${premiers} ${b.top5} fois sur ${n}`;
  }
  if (b.fautes >= 1) {
    const fautes = `${b.fautes} faute${b.fautes > 1 ? "s" : ""} ${surSesDernieres(n)}`;
    return forme ? `${forme} ; ${fautes}` : fautes;
  }
  return forme ? `${forme}, sans faute` : "";
}

function ligneCheval(ctx: ContexteCourse, c: ChevalCommente, opts: { pivot: boolean; valueElite: boolean }): string {
  const p = trouver(ctx, c.numero);
  const fem = feminin(p);
  const libelle = libelleActeur(ctx);
  const acteurs: string[] = [];
  if (p && p.driver) acteurs.push(libelle ? `${libelle} ${p.driver}` : p.driver);
  if (p && p.entraineur) acteurs.push(`entraîneur ${p.entraineur}`);
  let ligne = `${opts.pivot ? "⭐ " : ""}n°${c.numero} ${c.nom}${acteurs.length ? ` — ${acteurs.join(", ")}` : ""}.`;
  ligne += c.rang === 1 ? ` ${fem ? "Favorite" : "Favori"} du marché.` : ` ${c.rang}e du marché.`;
  const forme = formeEtFautes(analyserMusique(p ? p.musique : null), fem);
  if (forme) ligne += ` ${forme}.`;
  if (opts.pivot) ligne += " Notre pivot.";
  if (opts.valueElite) ligne += ` ${fem ? "Retenue" : "Retenu"} pour sa cote parmi nos 8.`;
  return ligne;
}

function ligneEcarte(ctx: ContexteCourse, c: ChevalCommente): string {
  const p = trouver(ctx, c.numero);
  const b = analyserMusique(p ? p.musique : null);
  const retenu = feminin(p) ? "retenue" : "retenu";
  if (!b) return `n°${c.numero} ${c.nom} (${c.rang}e du marché) n'est pas ${retenu}.`;
  return `n°${c.numero} ${c.nom} (${c.rang}e du marché) n'est pas ${retenu} : ${b.fautes} faute${b.fautes > 1 ? "s" : ""} ${surSesDernieres(b.courses)}.`;
}

function sectionCourse(ctx: ContexteCourse): string[] {
  const lignes = [
    `Quinté+ du ${dateLongue(ctx.dateISO)} : ${ctx.prix}, ${ctx.hippodrome} (R${ctx.reunion}C${ctx.course}), départ ${heureGmt(ctx.departUtc.getTime())} GMT (${heureParisLisible(ctx.heureParis)} heure de Paris).`,
    `${tete(ctx, true)}.`,
  ];
  const groupes = groupesDistance(partantsDe(ctx));
  for (let i = 1; i < groupes.length; i++) {
    const g = groupes[i];
    const d = g.distance - groupes[0].distance;
    lignes.push(
      g.numeros.length === 1
        ? `Le n°${g.numeros[0]} part ${d} m derrière, sur ${metres(g.distance)} m.`
        : `Les n°${listeNumeros(g.numeros)} partent ${d} m derrière, sur ${metres(g.distance)} m.`,
    );
  }
  return lignes;
}

/** PUR : analyse complète (texte brut, sections séparées par une ligne vide). */
export function analyseComplete(
  ctx: ContexteCourse,
  niveau: "PRO" | "ELITE",
  base: ChevalCommente[],
  values: ChevalCommente[],
  ecartes: ChevalCommente[],
): string {
  const releve = ctx.releveCotes ? `Cotes PMU relevées à ${heureGmt(ctx.releveCotes)} GMT, indicatives` : "Cotes PMU indicatives";
  const blocs: string[][] = [
    ["LA COURSE"].concat(sectionCourse(ctx)),
    ["LA BASE"].concat(base.map((c, i) => ligneCheval(ctx, c, { pivot: i === 0, valueElite: false }))),
    ["LES VALUES"]
      .concat(values.map((c) => ligneCheval(ctx, c, { pivot: false, valueElite: niveau === "ELITE" })))
      .concat(niveau === "ELITE" ? ecartes.map((c) => ligneEcarte(ctx, c)) : []),
    ["À SAVOIR", `${releve} : elles évoluent jusqu'au départ. Le jeu comporte des risques : jouez responsable.`],
  ];
  return blocs.map((b) => b.join("\n")).join("\n\n");
}
