/**
 * lib/brouillons-quinte/commentaires.ts — textes des brouillons.
 *
 * Modèle éditorial de Steph du 22/10/2026 (« Modèle éditorial & Spécifications
 * d'intégration — Pronostics Quinté+ Elite Turf ») :
 *   - analyse courte (aperçu public) ;
 *   - analyse complète Pro : LA COURSE & LES CONDITIONS, LA BASE SOLIDE,
 *     LES VALUES SPÉCULATIVES, SYNTHÈSE PRO, À SAVOIR ;
 *   - analyse complète Elite : les mêmes sections, puis LES ASSOCIÉS DE
 *     COMPLÉMENT et le PLAN DE JEU ELITE.
 * En-tête de chaque cheval et phrase de forme selon la discipline : trot
 * (fautes d'allure), plat (jamais de « faute » : poids, corde, terrain),
 * obstacle (chutes et arrêts seulement).
 *
 * Phrases FIXES remplies avec les données PMU (et, pour le couplé maître et le
 * sniper du plan Elite, l'édition T-90 scellée d'Argon). Un fait manquant fait
 * omettre le morceau de phrase. Aucune probabilité, aucun avantage ni aucune
 * étoile d'Argon dans un texte abonné. Texte brut : le site l'affiche avec
 * `whitespace-pre-line` (pas de Markdown). Steph peut tout modifier avant de
 * publier.
 *
 * Réponse « course » du PMU absente : discipline et conditions sont omises.
 * `courses.categorie` n'est PAS un repli : elle a longtemps été écrite « PLAT »
 * par défaut (migration 20260515_backfill_discipline_trot).
 */
import type { AllocationsPmu, CoursePmu, ParticipantPmu } from "./pmu";
import { analyserMusique, dernieresPlaces, NB_DERNIERES, type BilanMusique } from "./musique";
import { ANALYSE_COURTE_MAX } from "@/lib/pronostics/analyse-courte";

/** L'aperçu public tient en un court paragraphe (cartes, WhatsApp, Slack) : voir lib/pronostics/analyse-courte. */
export { ANALYSE_COURTE_MAX };

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
  /** Allocations des dernières courses de chaque cheval (euros) ; absent ou null = inconnues. */
  allocations?: AllocationsPmu | null;
}

export interface ChevalCommente {
  numero: number;
  nom: string;
  rang: number;
}

/** Avis d'Argon recopié dans le plan de jeu Elite (édition T-90 scellée). */
export interface AvisArgon {
  /** Couplé maître (2 chevaux) ; null si Argon n'en désigne pas. */
  couple: number[] | null;
  sniper: { numero: number; cote: number | null } | null;
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
  /** Spécialité seule, quand le PMU ne précise pas haies, steeple ou cross. */
  OBSTACLE: "Obstacle",
};
const FERRURES: Record<string, string> = {
  DEFERRE_ANTERIEURS_POSTERIEURS: "D4",
  DEFERRE_ANTERIEURS: "DA",
  DEFERRE_POSTERIEURS: "DP",
  PROTEGE_ANTERIEURS_POSTERIEURS: "P4",
  PROTEGE_ANTERIEURS: "PA",
  PROTEGE_POSTERIEURS: "PP",
  DEFERRE_ANTERIEURS_PROTEGE_POSTERIEURS: "DA, PP",
  PROTEGE_ANTERIEURS_DEFERRE_POSTERIEURS: "PA, DP",
};
const CATEGORIES: Array<[string, string]> = [
  ["HANDICAP_CATEGORIE_DIVISE", "Handicap divisé"],
  ["HANDICAP_DIVISE", "Handicap divisé"],
  ["HANDICAP_DE_CATEGORIE", "Handicap de catégorie"],
  ["HANDICAP", "Handicap"],
  ["A_RECLAMER", "Course à réclamer"],
  ["COURSE_A_CONDITIONS", "Course à conditions"],
  ["INTERNATIONALE", "Épreuve internationale"],
  ["EUROPEENNE", "Épreuve européenne"],
  ["NATIONALE", "Épreuve nationale"],
  ["AMATEURS", "Course d'amateurs"],
];

type Famille = "TROT_ATTELE" | "TROT_MONTE" | "PLAT" | "OBSTACLE";

// ── Outils ──────────────────────────────────────────────────────────────────

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

/** 62.5 → « 62,5 » ; 58 → « 58 ». */
function decimal(n: number): string {
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

/**
 * « TH. BRIAND » → « Th. Briand » ; « G.SIAS » → « G. Sias » ;
 * « Pierrick le Moel » → « P. Le Moel » et « Mme Maria TORNQVIST » → « Mme M. Tornqvist »
 * (prénom écrit en entier ramené à l'initiale, comme le reste des montes PMU) ;
 * « J.-M. BAZIRE » → « J.-M. Bazire » ;
 * « E. LIBAUD (s) » → « E. Libaud » (la mention PMU « (s) » n'est pas reprise).
 */
export function personne(nom: string): string {
  const PARTICULES = ["de", "du", "des", "van", "von"];
  const TITRES = ["mme", "mlle"];
  const net = String(nom)
    .replace(/\s*\(s\)\s*$/i, "")
    .replace(/\.(?=[^\s-])/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
  const mots = net.split(" ");
  const t = mots.length > 0 && TITRES.indexOf(mots[0].toLowerCase()) !== -1 ? 1 : 0;
  if (mots.length - t >= 2) {
    const prenom = mots[t];
    const bas = prenom.toLowerCase();
    // Le PMU écrit le prénom en minuscules et le nom en capitales : un mot tout en capitales
    // (« SAINT MARTIN ») est un nom, jamais abrégé.
    if (/^[A-ZÀ-Ý][a-zà-ÿ]{2,}(-[A-ZÀ-Ý][a-zà-ÿ]+)*$/.test(prenom) && PARTICULES.indexOf(bas) === -1 && bas !== "le" && bas !== "la") {
      mots[t] = prenom.split("-").filter(Boolean).map((x) => `${x.charAt(0).toUpperCase()}.`).join("-");
    }
  }
  return mots
    .map((mot, i) => {
      const bas = mot.toLowerCase();
      if (i > 0 && PARTICULES.indexOf(bas) !== -1) return bas;
      // « le » / « la » : minuscule seulement après « de » (« de la Motte ») ; sinon « Le Moel ».
      if (i > 0 && (bas === "le" || bas === "la") && mots[i - 1].toLowerCase() === "de") return bas;
      // Majuscule en tête et après un tiret ou une apostrophe (« d'Arc », « Le Moël », « Jean-Pierre »).
      let out = "";
      for (let k = 0; k < bas.length; k++) {
        const prec = k === 0 ? "" : bas.charAt(k - 1);
        const debut = k === 0 || prec === "-" || prec === "'" || prec === "’";
        out += debut ? bas.charAt(k).toUpperCase() : bas.charAt(k);
      }
      return out;
    })
    .join(" ");
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

/** Accord : g(fem, "Régulier", "Régulière"). */
function g(fem: boolean, masc: string, femi: string): string {
  return fem ? femi : masc;
}

function pluriel(n: number, mot: string, motPluriel?: string): string {
  return `${n} ${n > 1 ? motPluriel ?? `${mot}s` : mot}`;
}

function specialite(ctx: ContexteCourse): string | null {
  const s = ctx.coursePmu ? ctx.coursePmu.specialite : null;
  return s && DISCIPLINES[s] ? s : null;
}

function famille(ctx: ContexteCourse): Famille | null {
  const s = specialite(ctx);
  if (!s) return null;
  if (s === "TROT_ATTELE" || s === "TROT_MONTE" || s === "PLAT") return s as Famille;
  return "OBSTACLE";
}

function categorie(ctx: ContexteCourse): string {
  return String((ctx.coursePmu && ctx.coursePmu.categorie) || "").toUpperCase();
}

function libelleCategorie(ctx: ContexteCourse): string | null {
  const c = categorie(ctx);
  for (const [cle, libelle] of CATEGORIES) if (c.indexOf(cle) === 0) return libelle;
  return null;
}

function estHandicap(ctx: ContexteCourse): boolean {
  return categorie(ctx).indexOf("HANDICAP") === 0;
}

function autostart(ctx: ContexteCourse): boolean {
  return categorie(ctx).indexOf("AUTOSTART") !== -1;
}

function libelleCorde(ctx: ContexteCourse): string | null {
  const c = ctx.coursePmu ? ctx.coursePmu.corde : null;
  if (c === "CORDE_DROITE") return "Corde à droite";
  if (c === "CORDE_GAUCHE") return "Corde à gauche";
  return null;
}

/** Sable fibré : le pénétromètre indique « PSF » ou le parcours le nomme. */
function surPsf(ctx: ContexteCourse): boolean {
  const c = ctx.coursePmu;
  if (!c) return false;
  return String(c.terrain || "").toUpperCase() === "PSF" || /SABLE|PSF/i.test(String(c.parcours || ""));
}

function terrainLisible(ctx: ContexteCourse): string | null {
  const t = ctx.coursePmu ? ctx.coursePmu.terrain : null;
  if (!t || t.toUpperCase() === "PSF") return null;
  return t.toLowerCase();
}

interface GroupeDistance {
  distance: number;
  numeros: number[];
}

function groupesDistance(partants: ParticipantPmu[]): GroupeDistance[] {
  const groupes: GroupeDistance[] = [];
  for (const p of partants) {
    if (p.distance === null) continue;
    let gr: GroupeDistance | null = null;
    for (const x of groupes) if (x.distance === p.distance) gr = x;
    if (!gr) {
      gr = { distance: p.distance, numeros: [] };
      groupes.push(gr);
    }
    gr.numeros.push(p.numero);
  }
  for (const x of groupes) x.numeros.sort((a, b) => a - b);
  return groupes.sort((a, b) => a.distance - b.distance);
}

function distanceDeBase(ctx: ContexteCourse, groupes: GroupeDistance[]): number | null {
  if (groupes.length > 0) return groupes[0].distance;
  if (ctx.coursePmu && ctx.coursePmu.distance) return ctx.coursePmu.distance;
  return ctx.distanceBase;
}

/** « 3 ans » ou « 6 à 10 ans » ; "" si inconnu. */
function trancheAges(partants: ParticipantPmu[]): string {
  let min = Infinity;
  let max = -Infinity;
  for (const p of partants) {
    if (p.age === null) continue;
    if (p.age < min) min = p.age;
    if (p.age > max) max = p.age;
  }
  if (min === Infinity) return "";
  return min === max ? `${min} ans` : `${min} à ${max} ans`;
}

function ages(partants: ParticipantPmu[], feminines = false): string {
  const t = trancheAges(partants);
  if (!t) return "";
  return t.indexOf(" à ") === -1 ? ` de ${t}` : ` ${feminines ? "âgées" : "âgés"} de ${t}`;
}

function nPartants(ctx: ContexteCourse): string {
  const n = partantsDe(ctx).length;
  return `${n} ${champFeminin(ctx) ? "partantes" : "partants"}`;
}

/** Plus forte allocation des dernières courses du cheval, en k€ ; null si inconnue. */
function allocationMaxK(ctx: ContexteCourse, numero: number): number | null {
  const a = ctx.allocations ? ctx.allocations[numero] : null;
  if (!a) return null;
  let max = 0;
  for (const x of a) if (x !== null && x > max) max = x;
  return max > 0 ? Math.round(max / 1000) : null;
}

// ── En-tête et forme de chaque cheval ───────────────────────────────────────

/** « (Driver : Th. Briand | Entraîneur : V. Martens | Ferrure : D4 | +25 m) » selon la discipline. */
function metaCheval(ctx: ContexteCourse, p: ParticipantPmu | null): string {
  if (!p) return "";
  const fam = famille(ctx);
  const morceaux: string[] = [];
  // Discipline inconnue (réponse « course » du PMU absente) : le nom seul, sans libellé.
  if (p.driver) morceaux.push(fam === null ? personne(p.driver) : `${fam === "TROT_ATTELE" ? "Driver" : "Jockey"} : ${personne(p.driver)}`);
  if (p.entraineur) morceaux.push(`Entraîneur : ${personne(p.entraineur)}`);
  const ferrure = p.deferre ? FERRURES[p.deferre] ?? null : null;
  if (fam === "TROT_ATTELE") {
    if (ferrure) morceaux.push(`Ferrure : ${ferrure}`);
    const groupes = groupesDistance(partantsDe(ctx));
    if (groupes.length > 1 && p.distance !== null && p.distance > groupes[0].distance) {
      morceaux.push(`+${p.distance - groupes[0].distance} m`);
    }
  } else if (fam === "TROT_MONTE") {
    const poids = p.poids !== null ? `Poids : ${decimal(p.poids)} kg` : "";
    const detail = [poids, ferrure || ""].filter(Boolean).join(" · ");
    if (detail) morceaux.push(detail);
  } else if (fam === "PLAT" || fam === "OBSTACLE") {
    const detail = [
      p.poids !== null ? `Poids : ${decimal(p.poids)} kg` : "",
      fam === "PLAT" && p.corde !== null ? `Corde ${p.corde}` : "",
      p.valeurHandicap !== null ? `Val. ${decimal(p.valeurHandicap)}` : "",
    ].filter(Boolean).join(" · ");
    if (detail) morceaux.push(detail);
  }
  return morceaux.length ? ` (${morceaux.join(" | ")})` : "";
}

/** « Favori du marché (1er). » / « 2e favori du marché. » / « 5e du marché. » */
function rangMarche(rang: number, fem: boolean): string {
  if (rang === 1) return fem ? "Favorite du marché (1re)." : "Favori du marché (1er).";
  if (rang === 2) return `2e ${g(fem, "favori", "favorite")} du marché.`;
  return `${rang}e du marché.`;
}

function sorties(n: number): string {
  return n === 1 ? "sa dernière sortie" : `ses ${n} dernières sorties`;
}

function courses(n: number): string {
  return n === 1 ? "sa dernière course" : `ses ${n} dernières courses`;
}

/** Places des 5 dernières courses (lettres comprises). */
function places5(p: ParticipantPmu | null): string[] {
  return (p && dernieresPlaces(p.musique, NB_DERNIERES)) || [];
}

function formeTrot(ctx: ContexteCourse, p: ParticipantPmu | null, b: BilanMusique, fem: boolean): string | null {
  const n = b.courses;
  const v = b.victoires;
  const f = b.fautes;
  const premiers = g(fem, "premiers", "premières");
  if (v >= 2 && f === 0) return `En pleine possession de ses moyens avec ${v} victoires sur ${sorties(n)}, sans la moindre faute d'allure.`;
  if (b.top3 >= 3 && f === 0) return `Modèle de régularité : ${b.top3} fois dans les 3 ${premiers} lors de ${courses(n)}, sans faute.`;
  if (v === 1 && f === 0) return `${g(fem, "Victorieux", "Victorieuse")} récemment (1 succès sur ${courses(n)}) et irréprochable dans ses allures.`;
  if (b.top5 >= 2 && f === 0) return `${g(fem, "Constant et appliqué", "Constante et appliquée")} (${b.top5} fois dans les 5 ${premiers} sur ${sorties(n)}, sans faute).`;
  if (v >= 1 && f === 1) return `${g(fem, "Performant", "Performante")} avec ${v} succès sur ${courses(n)} malgré 1 faux pas à effacer.`;
  if (f >= 2) {
    const dq = places5(p).filter((x) => x === "D").length;
    const quoi = dq === f ? "disqualifications" : "fautes";
    return `${g(fem, "Délicat", "Délicate")} récemment (${f} ${quoi} sur ${sorties(n)}), mais capable de créer la surprise ${g(fem, "s'il", "si elle")} reste sage du départ à l'arrivée.`;
  }
  return null;
}

function formePlat(ctx: ContexteCourse, p: ParticipantPmu | null, b: BilanMusique, fem: boolean): string | null {
  const n = b.courses;
  const v = b.victoires;
  const premiers = g(fem, "premiers", "premières");
  if (b.derniereGagnee) return "Reste sur une victoire convaincante et aborde cet engagement en pleine forme.";
  if (v >= 2) return `Très ${g(fem, "compétitif", "compétitive")} actuellement avec ${v} succès lors de ${sorties(n)}.`;
  if (b.top3 >= 3) return `Fait preuve d'une remarquable constance avec ${b.top3} podiums sur ses ${n} dernières tentatives.`;
  if (v === 1) return `Déjà ${g(fem, "lauréat", "lauréate")} au cours de ${sorties(n)} et ${g(fem, "confirmé", "confirmée")} sur ce profil.`;
  if (b.top5 >= 2) return `${g(fem, "Régulier", "Régulière")} à ce niveau de compétition (${b.top5} fois dans les 5 ${premiers} lors de ${courses(n)}).`;
  return null;
}

function formeObstacle(ctx: ContexteCourse, p: ParticipantPmu | null, b: BilanMusique, fem: boolean): string | null {
  const n = b.courses;
  const v = b.victoires;
  const inc = places5(p).filter((x) => x === "A" || x === "T").length;
  if (v >= 1 && inc === 0) return `${g(fem, "Sauteur fiable et performant", "Sauteuse fiable et performante")} (${pluriel(v, "victoire")} sur ${sorties(n)}, sans chute ni arrêt).`;
  if (b.top3 >= 2 && inc === 0) return `${g(fem, "Sauteur appliqué", "Sauteuse appliquée")} comptant ${b.top3} podiums lors de ${courses(n)}, sans incident de parcours.`;
  if (b.top5 >= 2 && inc === 0) return `${g(fem, "Régulier", "Régulière")} sur les obstacles (${b.top5} places dans les 5 premiers sur ${sorties(n)}, sans faute de saut).`;
  if (inc >= 1 && (v >= 1 || b.top3 >= 2)) return `${g(fem, "Doté", "Dotée")} de solides moyens (${pluriel(b.top3, "podium")} sur ${sorties(n)}) malgré ${pluriel(inc, "incident")} de parcours à oublier.`;
  if (inc >= 2) return `Capable du meilleur comme du pire sur les obstacles (${inc} arrêts ou chutes récemment), ${g(fem, "il", "elle")} peut surprendre à belle cote ${g(fem, "s'il", "si elle")} boucle son parcours.`;
  return null;
}

/** Phrase de secours : jamais de cheval sans phrase. */
function formeSecours(ctx: ContexteCourse, p: ParticipantPmu | null, c: ChevalCommente, fem: boolean, fam: Famille | null): string {
  const k = allocationMaxK(ctx, c.numero);
  const il = g(fem, "il", "elle");
  if (fam === "PLAT") {
    const lots = estHandicap(ctx) ? "aux gros handicaps" : "aux lots relevés";
    const montant = k !== null ? ` (lots jusqu'à ${k} k€)` : "";
    const marche = c.rang <= 8 ? ` et ${g(fem, "soutenu", "soutenue")} par le marché` : "";
    return `${g(fem, "Aguerri", "Aguerrie")} ${lots}${montant}${marche}, ${il} trouve une occasion de refaire parler ${g(fem, "de lui", "d'elle")}.`;
  }
  if (fam === "OBSTACLE") {
    const lots = k !== null ? `aux lots relevés (${k} k€)` : "aux lots relevés";
    const poids = p && p.poids !== null ? ` et ${g(fem, "adapté", "adaptée")} aux conditions de poids du jour (${decimal(p.poids)} kg)` : "";
    return `${g(fem, "Habitué", "Habituée")} ${lots}${poids}, ${il} mérite crédit.`;
  }
  const niveau = k !== null ? `dans des lots de niveau équivalent (${k} k€)` : "à ce niveau";
  return `${g(fem, "Confirmé", "Confirmée")} ${niveau}, ${il} possède les ressources pour se réhabiliter.`;
}

/** Bonus du plat : bon numéro de corde, petit poids en bas de tableau. */
function bonusPlat(ctx: ContexteCourse, p: ParticipantPmu | null, fem: boolean): string[] {
  if (!p) return [];
  const out: string[] = [];
  if (p.corde !== null && p.corde <= 5 && !surPsf(ctx)) out.push(`Bénéficie d'un bon numéro dans les stalles (corde ${p.corde}).`);
  else if (p.corde !== null && p.corde <= 5) out.push(`Bénéficie d'un bon numéro à la corde (${p.corde}).`);
  const pesés = partantsDe(ctx).filter((x) => x.poids !== null);
  if (p.poids !== null && pesés.length === partantsDe(ctx).length && pesés.length >= 6) {
    const plusLourds = pesés.filter((x) => (x.poids as number) > (p.poids as number)).length;
    if (plusLourds + 1 >= pesés.length - 3) out.push(`${g(fem, "Avantagé", "Avantagée")} par son petit poids en bas de tableau (${decimal(p.poids)} kg).`);
  }
  return out;
}

/**
 * Discipline lue dans la musique (« 2a3a… » attelé, « m » monté, « p » plat,
 * « h », « s », « c » obstacle ; la lettre la plus fréquente) : repli quand la
 * réponse « course » du PMU manque.
 */
function familleDeMusique(musique: string | null): Famille | null {
  const compte: Record<string, number> = {};
  for (const l of String(musique || "").match(/[a-z]/g) || []) compte[l] = (compte[l] || 0) + 1;
  let top = "";
  for (const l of Object.keys(compte)) if (!top || compte[l] > compte[top]) top = l;
  if (top === "a") return "TROT_ATTELE";
  if (top === "m") return "TROT_MONTE";
  if (top === "p") return "PLAT";
  if (top === "h" || top === "s" || top === "c") return "OBSTACLE";
  return null;
}

function phraseForme(ctx: ContexteCourse, c: ChevalCommente, p: ParticipantPmu | null, fem: boolean): string {
  const fam = famille(ctx) ?? familleDeMusique(p ? p.musique : null);
  const b = analyserMusique(p ? p.musique : null);
  if (!b) {
    const debut = `Peu de références récentes au PMU.`;
    return fam === "PLAT" ? [debut].concat(bonusPlat(ctx, p, fem)).join(" ") : debut;
  }
  let phrase: string | null = null;
  if (fam === "TROT_ATTELE" || fam === "TROT_MONTE") phrase = formeTrot(ctx, p, b, fem);
  else if (fam === "PLAT") phrase = formePlat(ctx, p, b, fem);
  else if (fam === "OBSTACLE") phrase = formeObstacle(ctx, p, b, fem);
  if (!phrase) phrase = formeSecours(ctx, p, c, fem, fam);
  return fam === "PLAT" ? [phrase].concat(bonusPlat(ctx, p, fem)).join(" ") : phrase;
}

/** Deux lignes : « {puce} n°X NOM (méta) » puis « rang au marché. forme. » */
function ficheCheval(ctx: ContexteCourse, c: ChevalCommente, puce: "pivot" | "base" | "value" | "associe"): string {
  const p = trouver(ctx, c.numero);
  const fem = feminin(p);
  const tete =
    puce === "pivot" ? `★ Notre Pivot — n°${c.numero} ${c.nom}`
      : puce === "base" ? `• n°${c.numero} ${c.nom}`
        : puce === "value" ? `◇ n°${c.numero} ${c.nom}`
          : `🤝 n°${c.numero} ${c.nom}`;
  return `${tete}${metaCheval(ctx, p)}\n${rangMarche(c.rang, fem)} ${phraseForme(ctx, c, p, fem)}`;
}

// ── La course ───────────────────────────────────────────────────────────────

function nonPartantsCourse(ctx: ContexteCourse): ParticipantPmu[] {
  return ctx.participants.filter((p) => p.nonPartant).sort((a, b) => a.numero - b.numero);
}

function mentionForfaits(ctx: ContexteCourse): string {
  const np = nonPartantsCourse(ctx);
  if (np.length === 0) return "";
  if (np.length === 1) return ` (après le forfait du n°${np[0].numero} ${np[0].nom})`;
  const liste = np.map((p) => `n°${p.numero} ${p.nom}`);
  return ` (après les forfaits des ${liste.slice(0, -1).join(", ")} et ${liste[liste.length - 1]})`;
}

function ligneProfil(ctx: ContexteCourse): string {
  const partants = partantsDe(ctx);
  const dist = distanceDeBase(ctx, groupesDistance(partants));
  const s = specialite(ctx);
  const cat = famille(ctx) === "PLAT" || famille(ctx) === "OBSTACLE" ? libelleCategorie(ctx) : null;
  const morceaux: string[] = [];
  if (s) morceaux.push(`${DISCIPLINES[s]}${cat ? ` (${cat})` : ""}`);
  if (dist) morceaux.push(`${metres(dist)} m`);
  const corde = libelleCorde(ctx);
  if (corde) morceaux.push(corde);
  morceaux.push(`${nPartants(ctx)}${ages(partants, champFeminin(ctx))}${mentionForfaits(ctx)}`);
  return `• Profil : ${morceaux.join(" — ")}`;
}

/** Configuration du parcours (trot) ou terrain et paramètres clés (plat, obstacle). */
function ligneConditions(ctx: ContexteCourse): string | null {
  const fam = famille(ctx);
  const partants = partantsDe(ctx);
  if (fam === "TROT_ATTELE" || fam === "TROT_MONTE") {
    if (autostart(ctx)) {
      const n = partants.length;
      return n > 8
        ? "• Configuration du parcours : Départ à l'autostart. Les n°1 à 8 s'élancent en première ligne derrière les ailes, les suivants en seconde ligne."
        : "• Configuration du parcours : Départ à l'autostart, tous les partants en première ligne.";
    }
    const groupes = groupesDistance(partants);
    if (groupes.length <= 1) {
      return groupes.length === 1 ? `• Configuration du parcours : Départ volté, tous les partants sur ${metres(groupes[0].distance)} m.` : null;
    }
    const echelons = groupes.length === 2 ? "deux échelons" : `${groupes.length} échelons`;
    const tete = groupes[0];
    const suite = groupes.slice(1).map((x) =>
      `les n°${listeNumeros(x.numeros)} rendent ${x.distance - tete.distance} mètres (${metres(x.distance)} m)`);
    return `• Configuration du parcours : Départ volté sur ${echelons}. Les n°${listeNumeros(tete.numeros)} s'élancent en tête (${metres(tete.distance)} m) tandis que ${suite.join(" et ")}.`;
  }
  if (fam === "PLAT") {
    const terrain = terrainLisible(ctx);
    const piste = surPsf(ctx) ? "Piste en sable fibré (PSF)" : `Piste en gazon${terrain ? ` (terrain ${terrain})` : ""}`;
    const dist = distanceDeBase(ctx, groupesDistance(partants));
    const cles = surPsf(ctx)
      ? "le numéro de corde et la vitesse seront déterminants"
      : estHandicap(ctx)
        ? "la tenue, l'aptitude au terrain et la place dans l'échelle des poids seront déterminantes"
        : "la tenue, l'aptitude au terrain et le numéro de corde seront déterminants";
    return `• Terrain & paramètres clés : ${piste}. Sur ce tracé${dist ? ` de ${metres(dist)} m` : ""}, ${cles}.`;
  }
  if (fam === "OBSTACLE") {
    const terrain = terrainLisible(ctx);
    const s = specialite(ctx) as string;
    return `• Parcours : ${DISCIPLINES[s]}${terrain ? `, terrain ${terrain}` : ""}. Le poids porté, l'aptitude au terrain et la qualité de saut compteront.`;
  }
  return null;
}

function sectionCourse(ctx: ContexteCourse): string {
  const lignes = [
    "LA COURSE & LES CONDITIONS",
    `• Épreuve : Quinté+ du ${dateLongue(ctx.dateISO)} — ${ctx.prix}, ${ctx.hippodrome} (R${ctx.reunion}C${ctx.course})`,
    `• Départ : ${heureGmt(ctx.departUtc.getTime())} GMT (${heureParisLisible(ctx.heureParis)} heure de Paris)`,
    ligneProfil(ctx),
  ];
  const cond = ligneConditions(ctx);
  if (cond) lignes.push(cond);
  return lignes.join("\n");
}

// ── Analyse courte ──────────────────────────────────────────────────────────

/** Phrase de contexte de l'aperçu : échelons, autostart, ou conditions du plat et de l'obstacle. */
function contexteCourt(ctx: ContexteCourse): string | null {
  const fam = famille(ctx);
  const partants = partantsDe(ctx);
  const cat = libelleCategorie(ctx);
  if (fam === "TROT_ATTELE" || fam === "TROT_MONTE") {
    const debut = cat && cat.indexOf("Épreuve") === 0 ? cat : "Course";
    if (autostart(ctx)) return `${debut} au départ de l'autostart.`;
    const groupes = groupesDistance(partants);
    if (groupes.length === 2) {
      const r = groupes[1];
      return `${debut} sur deux échelons de départ (recul de ${r.distance - groupes[0].distance} m pour les n°${listeNumeros(r.numeros)}).`;
    }
    if (groupes.length > 2) return `${debut} sur ${groupes.length} échelons de départ.`;
    return null;
  }
  if (fam === "PLAT") {
    const dist = distanceDeBase(ctx, groupesDistance(partants));
    const tranche = trancheAges(partants);
    let t = `${cat ?? "Course"}${tranche ? ` pour ${tranche}` : ""}`;
    if (dist) t += ` sur ${metres(dist)} m`;
    const corde = libelleCorde(ctx);
    return `${t}${corde ? ` (${corde.toLowerCase()})` : ""}.`;
  }
  if (fam === "OBSTACLE") {
    const terrain = terrainLisible(ctx);
    return `${cat ? `${cat}, ` : ""}${DISCIPLINES[specialite(ctx) as string].toLowerCase()}${terrain ? ` sur terrain ${terrain}` : ""}.`.replace(/^./, (x) => x.toUpperCase());
  }
  return null;
}

/**
 * PUR : analyse courte (aperçu public), ANALYSE_COURTE_MAX caractères au plus.
 * « Prix — Hippodrome (RxCy) | Discipline · distance · partants. » + contexte +
 * « Notre analyse place en tête … » + invitation Pro / Elite. Si c'est trop
 * long : on retire l'invitation, puis le contexte ; jamais de mot coupé.
 */
export function analyseCourte(ctx: ContexteCourse, pivot: ChevalCommente, nbElite = 8): string {
  const p = trouver(ctx, pivot.numero);
  const fem = feminin(p);
  const partants = partantsDe(ctx);
  const dist = distanceDeBase(ctx, groupesDistance(partants));
  const s = specialite(ctx);
  // Plat : la surface et l'état du terrain dans l'en-tête (« Plat · 2 400 m · Gazon (très souple) · 15 partants »).
  const terrain = terrainLisible(ctx);
  const piste = famille(ctx) !== "PLAT" ? "" : surPsf(ctx) ? "PSF" : `Gazon${terrain ? ` (${terrain})` : ""}`;
  const titre = [s ? DISCIPLINES[s] : "", dist ? `${metres(dist)} m` : "", piste, nPartants(ctx)].filter(Boolean).join(" · ");
  const entete = `${ctx.prix} — ${ctx.hippodrome} (R${ctx.reunion}C${ctx.course}) | ${titre}.`;
  const marche = pivot.rang === 1 ? g(fem, "favori du marché", "favorite du marché") : pivot.rang === 2 ? `2e ${g(fem, "favori", "favorite")} du marché` : `${pivot.rang}e du marché`;
  const qui = p && p.driver ? `n°${pivot.numero}, ${personne(p.driver)}` : `n°${pivot.numero}`;
  const tete = `Notre analyse place en tête ${pivot.nom} (${qui}), ${marche}.`;
  const invitation = `Découvrez la sélection complète en 6 chevaux (Pro) et le plan de jeu élargi en ${nbElite} chevaux (Elite).`;
  const contexte = contexteCourt(ctx);
  const essais: Array<Array<string | null>> = [
    [entete, contexte, tete, invitation],
    [entete, contexte, tete],
    [entete, tete],
    [tete],
  ];
  for (const morceaux of essais) {
    const t = morceaux.filter((x): x is string => !!x).join(" ");
    if (t.length <= ANALYSE_COURTE_MAX) return t;
  }
  return `Notre analyse place en tête le n°${pivot.numero}, ${marche}.`;
}

// ── Analyse complète ────────────────────────────────────────────────────────

function compte(n: number): string {
  return n === 1 ? "1 CHEVAL" : `${n} CHEVAUX`;
}

function suite(nums: number[], sep = " · "): string {
  return nums.join(sep);
}

function aSavoir(ctx: ContexteCourse, niveau: "PRO" | "ELITE"): string {
  const releve = ctx.releveCotes ? `Cotes PMU relevées à ${heureGmt(ctx.releveCotes)} GMT à titre indicatif` : "Cotes PMU indicatives";
  const risque = niveau === "ELITE"
    ? "Les jeux d'argent comportent des risques : misez uniquement ce que vous pouvez vous permettre de perdre."
    : "Les jeux d'argent comportent des risques : misez avec modération.";
  return `À SAVOIR\n${releve} (susceptibles d'évoluer jusqu'au départ). ${risque}`;
}

function cote(c: number | null): string {
  return c === null ? "" : ` à ${decimal(c)}/1`;
}

/**
 * PUR : analyse complète (texte brut, sections séparées par une ligne vide).
 * PRO : la course, la base de 4, les values, la synthèse.
 * ELITE : la course, la base de 4, les values, les associés, le plan de jeu.
 * `avis` (Elite) : couplé maître et sniper de l'édition T-90 scellée d'Argon ;
 * un cheval non partant n'y est jamais cité.
 */
export function analyseComplete(
  ctx: ContexteCourse,
  niveau: "PRO" | "ELITE",
  bases: ChevalCommente[],
  values: ChevalCommente[],
  associes: ChevalCommente[],
  avis: AvisArgon | null = null,
): string {
  const blocs: string[] = [sectionCourse(ctx)];
  blocs.push(
    [`LA BASE SOLIDE (${compte(bases.length)})`]
      .concat(bases.map((c, i) => ficheCheval(ctx, c, i === 0 ? "pivot" : "base")))
      .join("\n"),
  );
  if (values.length > 0) {
    blocs.push([`LES VALUES SPÉCULATIVES (${compte(values.length)})`].concat(values.map((c) => ficheCheval(ctx, c, "value"))).join("\n"));
  }
  const pivot = bases[0];
  if (niveau === "PRO") {
    const sel = bases.concat(values).map((c) => c.numero);
    blocs.push(`SYNTHÈSE PRO (${compte(sel.length)})\n${suite(sel)}${pivot ? ` (Pivot : n°${pivot.numero} ${pivot.nom})` : ""}`);
  } else {
    if (associes.length > 0) {
      blocs.push([`LES ASSOCIÉS DE COMPLÉMENT (${compte(associes.length)})`].concat(associes.map((c) => ficheCheval(ctx, c, "associe"))).join("\n"));
    }
    const sel = bases.concat(values, associes).map((c) => c.numero);
    const forfaits = nonPartantsCourse(ctx);
    const np = forfaits.length
      ? ` (Non-partant${forfaits.length > 1 ? "s" : ""} : ${forfaits.map((p) => `n°${p.numero} ${p.nom}`).join(", ")})`
      : "";
    const plan = [`PLAN DE JEU ELITE (SYNTHÈSE ${compte(sel.length)})`, `• Sélection complète (${compte(sel.length).toLowerCase()}) : ${suite(sel)}${np}`];
    const b = bases.map((c) => c.numero);
    if (b.length >= 3) plan.push(`• Base Trio / Champ réduit : ${b.slice(0, 3).join(" — ")}${b.length >= 4 ? ` (ou avec le n°${b[3]})` : ""}`);
    const partant = (n: number) => { const p = trouver(ctx, n); return !!p && !p.nonPartant; };
    const couple = avis && avis.couple && avis.couple.length === 2 && avis.couple.every(partant) ? avis.couple : null;
    const sniper = avis && avis.sniper && partant(avis.sniper.numero) ? avis.sniper : null;
    if (couple) plan.push(`• Couplé Maître recommandé : ${couple.join(" — ")}${sniper ? ` (Sniper : n°${sniper.numero}${cote(sniper.cote)})` : ""}`);
    else if (sniper) plan.push(`• Sniper : n°${sniper.numero}${cote(sniper.cote)}`);
    const autour = values.concat(associes).map((c) => c.numero);
    if (autour.length > 0) plan.push(`• Outsiders / Associés à intégrer en champ réduit : ${suite(autour)}`);
    blocs.push(plan.join("\n"));
  }
  blocs.push(aSavoir(ctx, niveau));
  return blocs.join("\n\n");
}
