/**
 * Carte « Vedette du jour » APRÈS la course (demande de Steph du 01/10/2026) :
 * une fois le Quinté+ couru, l'accueil montre son arrivée officielle et un
 * résumé jusqu'à minuit (heure de Paris), au lieu de la carte d'avant-course.
 *
 * PUR et testé. Le résumé n'utilise que des données de la base (arrivée,
 * partants, caractéristiques de la course) : aucun commentaire inventé, et
 * aucune cote (rien ne garantit qu'elle soit la cote définitive).
 * ES5-safe (pas de spread de Set/Map, pas de regex /u).
 */
import { groupesArrivee } from "../courses/rangs";

export interface PartantNomme {
  numero: number;
  nom_cheval?: string | null;
  jockey?: string | null;
  entraineur?: string | null;
  non_partant?: boolean | null;
}

export interface CourseResumee {
  hippodrome: string | null;
  categorie: string | null;
  distance_metres: number | null;
  nb_partants: number | null;
}

const DISCIPLINES: Record<string, string> = {
  PLAT: "Course de plat",
  TROT: "Course de trot",
  OBSTACLE: "Course d'obstacles",
};

/** « 2026-10-01 » → « 2026-09-30 » (calcul à midi UTC : sans piège d'heure d'été). */
export function veille(date: string): string {
  return new Date(Date.parse(date + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
}

/** La course a-t-elle une arrivée officielle exploitable ? */
export function aUneArrivee(arrivee: number[] | null | undefined): arrivee is number[] {
  return Array.isArray(arrivee) && arrivee.length > 0;
}

/**
 * « G.MEUNIER » → « G. MEUNIER », « J.-M.BAZIRE » → « J.-M. BAZIRE » : espace
 * insécable après l'initiale (jamais coupée du nom en fin de ligne).
 */
export function nomPersonne(s: string | null | undefined): string {
  return (s || "").replace(/[ \t\r\n]+/g, " ").trim().replace(/\.(?=[A-Za-zÀ-ÿ])/g, ". ");
}

/**
 * Résumé factuel en deux ou trois phrases ; null sans arrivée. Ex. (01/10/2026) :
 * « Course d'obstacles à Auteuil sur 3 600 m, 15 partants : victoire de
 * LIPRIKA D'ANJOU (n°15), avec F. GILES, pour l'entraîneur H. MERIENNE (S).
 * GREY FIGHTER (n°3) et LUTECE ALLEN (n°14) complètent le podium. »
 */
export function resumeCourse(
  course: CourseResumee,
  arrivee: number[] | null | undefined,
  partants: PartantNomme[],
  /** Rangs officiels (ex æquo), cf. lib/courses/rangs. Absents = ordre strict. */
  rangs?: number[] | null,
): string[] | null {
  if (!aUneArrivee(arrivee)) return null;
  const parNumero: Record<number, PartantNomme> = {};
  for (let i = 0; i < partants.length; i++) parNumero[partants[i].numero] = partants[i];
  const nomme = (numero: number): string | null => {
    const p = parNumero[numero];
    return p && p.nom_cheval && p.nom_cheval.trim() ? `${p.nom_cheval.trim()} (n°${numero})` : null;
  };

  // « Course d'obstacles à Auteuil sur 3 600 m, 15 partants »
  const lieu: string[] = [];
  if (course.hippodrome && course.hippodrome.trim()) lieu.push(`à ${course.hippodrome.trim()}`);
  if (course.distance_metres && course.distance_metres > 0) lieu.push(`sur ${milliers(course.distance_metres)} m`);
  const discipline = course.categorie ? DISCIPLINES[course.categorie] : undefined;
  let contexte = discipline || lieu.length > 0 ? [discipline || "Course"].concat(lieu).join(" ") : "";
  const nb = nombrePartants(course, partants);
  if (nb > 0) contexte = contexte ? `${contexte}, ${nb} partants` : `${nb} partants`;

  // Rang par rang : deux vainqueurs en dead heat sont nommés tous les deux.
  const groupes = groupesArrivee(arrivee, rangs);
  let victoire: string;
  if (groupes[0].numeros.length > 1) {
    victoire = `victoire ex æquo ${enumerer(groupes[0].numeros.map((n) => (nomme(n) ? `de ${nomme(n)}` : `du n°${n}`)))}`;
  } else {
    const gagnant = parNumero[arrivee[0]];
    const nomGagnant = nomme(arrivee[0]);
    victoire = nomGagnant ? `victoire de ${nomGagnant}` : `victoire du n°${arrivee[0]}`;
    if (gagnant && gagnant.jockey && gagnant.jockey.trim()) victoire += `, avec ${nomPersonne(gagnant.jockey)}`;
    if (gagnant && gagnant.entraineur && gagnant.entraineur.trim()) victoire += `, pour l'entraîneur ${nomPersonne(gagnant.entraineur)}`;
  }
  const phrases = [contexte ? `${contexte} : ${victoire}.` : `${majuscule(victoire)}.`];

  // Le reste du podium : rangs 2 et 3 (un 3e ex æquo y figure).
  const podium: number[] = [];
  for (const g of groupes) {
    if (g.rang > 1 && g.rang <= 3) for (const n of g.numeros) podium.push(n);
  }
  const suivants = podium.map((n) => nomme(n) || `le n°${n}`);
  if (suivants.length >= 2) phrases.push(`${majuscule(enumerer(suivants))} complètent le podium.`);
  else if (suivants.length === 1) {
    phrases.push(`${majuscule(suivants[0])} ${groupes[1].rang === 2 ? "termine deuxième" : "complète le podium"}.`);
  }

  const nonPartants = partants
    .filter((p) => p.non_partant)
    .map((p) => p.numero)
    .sort((a, b) => a - b)
    .map((n) => `n°${n}`);
  if (nonPartants.length > 0) {
    phrases.push(`Non-partant${nonPartants.length > 1 ? "s" : ""} : ${enumerer(nonPartants)}.`);
  }
  return phrases;
}

/**
 * Chevaux qui ont couru : la liste des partants si elle est complète (moins les
 * non-partants), sinon le nombre déclaré. 0 = inconnu (rien n'est affiché).
 */
function nombrePartants(course: CourseResumee, partants: PartantNomme[]): number {
  const declares = course.nb_partants && course.nb_partants > 0 ? course.nb_partants : 0;
  if (partants.length > 0 && partants.length >= declares) {
    return partants.filter((p) => !p.non_partant).length;
  }
  return declares;
}

/** 3600 → « 3 600 » (espace insécable). */
function milliers(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** ["n°4", "n°7", "n°11"] → « n°4, n°7 et n°11 » */
function enumerer(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

function majuscule(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Rapports PMU définitifs (02/10/2026) ─────────────────────────────────────

interface RapportsAffichables {
  quinte_plus?: { ordre?: number; desordre?: number; bonus4?: number; bonus3?: number };
  quarte_plus?: { ordre?: number; desordre?: number; bonus?: number };
  tierce?: { ordre?: number; desordre?: number };
}

export interface LigneRapport {
  pari: string;
  /** Mise de référence du rapport (« pour 2 € »). */
  mise: string;
  detail: string;
}

/** 26003.8 → « 26 003,80 € » (espaces insécables, indépendant de l'ICU de la machine). */
export function euros(n: number): string {
  const centimes = Math.round(n * 100);
  const entier = String(Math.floor(centimes / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const reste = String(centimes % 100);
  return `${entier},${reste.length === 1 ? "0" + reste : reste} €`;
}

/**
 * Lignes « Rapports PMU définitifs » de la carte d'arrivée : Quinté+ (pour 2 €),
 * Quarté+ et Tiercé (pour 1 €), conventions de `arrivees.rapports_pmu`. Seules
 * les valeurs présentes sont affichées ; aucune ligne sans rapport.
 */
export function lignesRapports(r: RapportsAffichables | null | undefined): LigneRapport[] {
  if (!r) return [];
  const morceaux = (paires: [string, number | undefined][]) =>
    paires.filter((p) => typeof p[1] === "number" && (p[1] as number) > 0).map((p) => `${p[0]} ${euros(p[1] as number)}`);
  const out: LigneRapport[] = [];
  const q = r.quinte_plus;
  if (q) {
    const m = morceaux([["ordre", q.ordre], ["désordre", q.desordre], ["bonus 4/5", q.bonus4], ["bonus 3", q.bonus3]]);
    if (m.length) out.push({ pari: "Quinté+", mise: "pour 2 €", detail: m.join(" · ") });
  }
  const qa = r.quarte_plus;
  if (qa) {
    const m = morceaux([["ordre", qa.ordre], ["désordre", qa.desordre], ["bonus", qa.bonus]]);
    if (m.length) out.push({ pari: "Quarté+", mise: "pour 1 €", detail: m.join(" · ") });
  }
  const t = r.tierce;
  if (t) {
    const m = morceaux([["ordre", t.ordre], ["désordre", t.desordre]]);
    if (m.length) out.push({ pari: "Tiercé", mise: "pour 1 €", detail: m.join(" · ") });
  }
  return out;
}
