/**
 * lib/sync/genybet-partants.ts
 *
 * Enrichissement des CHAMPS DE FORME des partants via GenyBet (musique, âge,
 * sexe, poids, corde, jockey, entraîneur) — les données que LONACI n'a PAS.
 *
 * ⚠️ Les COTES GenyBet sont chargées en JavaScript/WebSocket (absentes du HTML
 * server-rendered, vérifié 2026-07-06) → NON scrapables. GenyBet ne remplace
 * donc pas les cotes : il complète les partants LONACI (qui portent les cotes)
 * avec la forme. Fusion par numéro côté appelant (geny-enrich-cli).
 *
 * Page course : /courses/partants-pronostics/{id}. Les colonnes CHANGENT selon
 * la discipline (relevé du 02/10/2026) :
 *   plat     : N° · Cheval · C · S/A · Poids · Jockey · Entraîneur · Val. · Performances · Réf. · Live
 *   trot     : N° · Cheval · S/A · Dist. · Driver · Entraîneur · Gains · Performances · Réf. · Live
 *   obstacle : N° · Cheval · S/A · Poids · Jockey · Entraîneur · Val. · Performances · Réf. · Live
 * → elles sont lues PAR LEUR EN-TÊTE. Lues par position jusqu'au 02/10/2026 :
 * au trot et en obstacle, l'entraîneur partait en « jockey », les gains (ou la
 * valeur) en « entraîneur » et la cote de référence en « musique » (84 % des
 * musiques du trot, 100 % de l'obstacle sur 30 jours).
 *
 * IDENTITÉ DE COURSE : (date, R, C) ne suffit pas. Les réunions relayées par
 * LONACI (Maroc) n'ont pas la numérotation de GenyBet : jusqu'au 03/10/2026, la
 * R9 de Settat recevait les musiques de la R9 GenyBet, Beaumont-de-Lomagne
 * (trot). GenyBet ne sert plus que si c'est la même course (memeCourseGenybet)
 * et, cheval par cheval, le même cheval (completerAvecGenybet).
 *
 * PUR (fetch via genybet-programme) → bundlable Node sur GitHub Actions.
 */
import { fetchGenybetHtml, toGenybetDate } from "./genybet-programme";
import { estMusique } from "@/lib/courses/musique";
import { memesPartants, nomCheval } from "@/lib/pmu-cotes";
import { sameHorse } from "@/lib/cotes/pmu-csv";
import { memesHippodromes } from "@/lib/sync/pmu-rattrapage";

/** Champs de forme d'un partant (sous-ensemble GenyParticipant, SANS cote). */
export interface GenybetPartant {
  numPmu:      number;
  nom:         string;
  jockey?:     { nom: string };
  entraineur?: { nom: string };
  musique?:    string;
  poids?:      number;
  age?:        number;
  sexe?:       string;
  placeCorde?: number;
  nonPartant:  boolean;
}

/** Entités nommées présentes chez GenyBet (« Entra&icirc;neur », « In&eacute;dit », « N&deg; »). */
const ENTITES: Record<string, string> = {
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", agrave: "à", acirc: "â",
  icirc: "î", iuml: "ï", ocirc: "ô", ucirc: "û", ugrave: "ù", ccedil: "ç", deg: "°",
};

function decode(str: string): string {
  return str
    .replace(/&#0*39;/g, "'").replace(/&#0*34;/g, '"')
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&([a-z]+);/gi, (m, nom) => ENTITES[nom.toLowerCase()] ?? m)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/’/g, "'");
}

/**
 * Retire les balises, décode les entités, normalise les espaces. Les icônes de la
 * page (police d'icônes, caractères Unicode privés U+E000-U+F8FF) sont retirées :
 * elles s'affichaient « □□ » après les noms.
 */
function cellText(html: string): string {
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/[-]/g, "").replace(/\s+/g, " ").trim();
}

/** « Entra&icirc;neur » → « entraineur », « N° » → « n », « S/A » → « sa ». */
function cleEntete(texte: string): string {
  return texte.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
}

/** Un nom de personne contient des lettres (pas « 143 570 » ni « 52,5 »). */
function estNom(texte: string): boolean {
  return /[A-Za-zÀ-ÿ]/.test(texte);
}

/**
 * Parse la table partants d'une page course GenyBet → champs de forme.
 * PURE (testable). Ne throw jamais ; ligne malformée ignorée.
 */
export function parseGenybetPartants(html: string): GenybetPartant[] {
  const out: GenybetPartant[] = [];
  const tbodyM = html.match(/<tbody[^>]*class="[^"]*table-body[^"]*"[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyM || tbodyM.index === undefined) return out;

  // En-têtes du MÊME tableau : le dernier <thead> avant ce <tbody>.
  const avant = html.slice(0, tbodyM.index);
  const debutThead = avant.lastIndexOf("<thead");
  if (debutThead === -1) return out; // sans en-têtes, pas de lecture à l'aveugle
  const entetes = Array.from(avant.slice(debutThead).matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi))
    .map((m) => cleEntete(cellText(m[1])));
  const colonne = (...noms: string[]) => entetes.findIndex((e) => noms.indexOf(e) !== -1);
  const iNum = colonne("n"), iNom = colonne("cheval"), iCorde = colonne("c"), iSa = colonne("sa"),
        iPoids = colonne("poids"), iJockey = colonne("jockey", "driver"),
        iEntraineur = colonne("entraineur"), iMusique = colonne("performances", "musique");
  if (iNum === -1 || iNom === -1) return out;

  // Défensif : retire d'éventuelles sous-tables imbriquées (icônes) qui
  // casseraient le découpage des cellules.
  const body = tbodyM[1].replace(/<table\b[\s\S]*?<\/table>/gi, "");
  const rows = body.split(/<tr\b/i).slice(1);

  for (const row of rows) {
    const cells = Array.from(row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)).map((m) => m[1]);
    const lire = (i: number) => (i >= 0 && i < cells.length ? cellText(cells[i]) : "");

    const numPmu = parseInt(lire(iNum), 10);
    const nom = lire(iNom);
    if (!Number.isFinite(numPmu) || !nom) continue;

    const corde = parseInt(lire(iCorde), 10);
    const sa = lire(iSa).match(/([A-Za-z])\s*(\d+)/); // "M2" → M, 2
    const poids = parseFloat(lire(iPoids).replace(",", "."));
    const jockey = lire(iJockey);
    const entraineur = lire(iEntraineur);
    const musique = lire(iMusique);

    out.push({
      numPmu,
      nom,
      jockey:      estNom(jockey) ? { nom: jockey } : undefined,
      entraineur:  estNom(entraineur) ? { nom: entraineur } : undefined,
      musique:     estMusique(musique) ? musique : undefined,
      poids:       Number.isFinite(poids) && poids > 0 ? poids : undefined,
      age:         sa ? parseInt(sa[2], 10) : undefined,
      sexe:        sa ? sa[1].toUpperCase() : undefined,
      placeCorde:  Number.isFinite(corde) ? corde : undefined,
      nonPartant:  /non[- ]?partant/i.test(row),
    });
  }

  return out;
}

/**
 * Hippodrome de la page course GenyBet, lu dans son titre « R9 - Beaumont-de-Lomagne ».
 * PURE. null si le titre n'a pas ce format : on ne devine pas.
 */
export function parseGenybetHippodrome(html: string): string | null {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!h1) return null;
  const m = cellText(h1[1]).match(/^R\d+\s*-\s*(.+)$/);
  return m ? m[1].trim() : null;
}

/** Une course GenyBet : son hippodrome (titre de la page) et ses partants. */
export interface CourseGenybet {
  hippodrome: string | null;
  partants: GenybetPartant[];
}

/**
 * PUR : la course GenyBet de mêmes numéros est-elle bien la nôtre ? Nos
 * partants connus (au moins 3 noms) → mêmes chevaux (memesPartants, ≥ 60 %) ;
 * sinon → même hippodrome. Ni l'un ni l'autre vérifiable → false.
 */
export function memeCourseGenybet(
  base: { hippodrome: string | null; noms: string[] },
  genybet: CourseGenybet,
): boolean {
  if (base.noms.map(nomCheval).filter(Boolean).length >= 3) {
    return memesPartants(base.noms, genybet.partants.map((p) => p.nom));
  }
  return memesHippodromes(base.hippodrome, genybet.hippodrome);
}

/** Partant à compléter (format Geny / LONACI du script d'enrichissement). */
export interface PartantACompleter {
  numPmu: number;
  nom: string;
  musique?: string | null;
  age?: number | null;
  sexe?: string | null;
  poids?: number | null;
  placeCorde?: number | null;
  jockey?: { nom: string } | null;
  entraineur?: { nom: string } | null;
}

/**
 * PUR : complète la forme des partants (musique, âge, sexe, poids, corde, et le
 * jockey ou l'entraîneur s'il manque) avec GenyBet — seulement si c'est la même
 * course (memeCourseGenybet) et, cheval par cheval, si le même dossard porte le
 * même nom (sameHorse). Ne remplace rien d'existant, ne touche jamais la cote.
 * @returns le nombre de chevaux complétés, ou null si GenyBet parle d'une autre course.
 */
export function completerAvecGenybet(
  partants: PartantACompleter[],
  genybet: CourseGenybet,
  hippodromeBase: string | null,
): number | null {
  if (!memeCourseGenybet({ hippodrome: hippodromeBase, noms: partants.map((p) => p.nom) }, genybet)) return null;
  const parNumero = new Map(genybet.partants.map((r) => [r.numPmu, r] as const));
  let completes = 0;
  for (const g of partants) {
    const r = parNumero.get(g.numPmu);
    if (!r || !sameHorse(g.nom, r.nom)) continue;
    if (g.musique == null && r.musique != null) g.musique = r.musique;
    if (g.age == null && r.age != null) g.age = r.age;
    if (g.sexe == null && r.sexe != null) g.sexe = r.sexe;
    if (g.poids == null && r.poids != null) g.poids = r.poids;
    if (g.placeCorde == null && r.placeCorde != null) g.placeCorde = r.placeCorde;
    if (!g.jockey?.nom && r.jockey) g.jockey = r.jockey;
    if (!g.entraineur?.nom && r.entraineur) g.entraineur = r.entraineur;
    completes++;
  }
  return completes;
}

/**
 * Mappe `${reunion}|${course}` → ID de course GenyBet, depuis la page programme.
 * Nécessaire pour construire l'URL des pages course (l'ID = même que PMU/Geny).
 */
export function parseGenybetCourseIds(html: string): Map<string, number> {
  const map = new Map<string, number>();
  const parts = html.split(/id="reunion-(\d+)"/i);
  for (let i = 1; i < parts.length; i += 2) {
    const reunionNum = parseInt(parts[i], 10);
    const block = parts[i + 1] || "";
    const tbodyM = block.match(/<tbody class="table-body">([\s\S]*?)<\/tbody>/i);
    if (!tbodyM) continue;
    for (const row of tbodyM[1].split(/<tr\b/i).slice(1)) {
      const numM = row.match(/<th[^>]*scope="row"[^>]*>\s*(\d+)\s*<\/th>/i);
      const idM = row.match(/\/courses\/(?:partants-pronostics|resultats)\/(\d+)/i);
      if (numM && idM) map.set(`${reunionNum}|${parseInt(numM[1], 10)}`, parseInt(idM[1], 10));
    }
  }
  return map;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Récupère les champs de forme GenyBet des courses voulues → map
 * `${reunion}|${course}` → course (hippodrome + partants). 1 fetch (page
 * programme, pour les IDs) + 1 fetch par course voulue. Ne throw jamais (map
 * vide/partielle si KO). La clé R|C ne garantit PAS que c'est la même course :
 * l'appelant vérifie (memeCourseGenybet, completerAvecGenybet).
 * @param dateISO "YYYY-MM-DD"
 * @param wanted  clés `${reunion}|${course}` à récupérer (limite les fetches)
 */
export async function fetchGenybetPartantsMap(
  dateISO: string,
  wanted?: Set<string>,
): Promise<Map<string, CourseGenybet>> {
  const out = new Map<string, CourseGenybet>();

  let idMap: Map<string, number>;
  try {
    const html = await fetchGenybetHtml(`https://www.genybet.fr/reunions/${toGenybetDate(dateISO)}`);
    idMap = parseGenybetCourseIds(html);
  } catch {
    return out;
  }

  // tsconfig sans `target` → pas d'itération directe de Map ; on passe par les clés.
  for (const key of Array.from(idMap.keys())) {
    if (wanted && !wanted.has(key)) continue;
    const courseId = idMap.get(key)!;
    try {
      const html = await fetchGenybetHtml(`https://www.genybet.fr/courses/partants-pronostics/${courseId}`);
      const partants = parseGenybetPartants(html);
      if (partants.length > 0) out.set(key, { hippodrome: parseGenybetHippodrome(html), partants });
    } catch {
      // course KO → on continue (enrichissement best-effort)
    }
    await sleep(300); // pacing poli entre pages course
  }

  return out;
}
