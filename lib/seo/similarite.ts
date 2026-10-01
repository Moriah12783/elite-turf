/**
 * Mesure de similarité des pages pays `/pronostics-pmu-*` (brief « pages pays »
 * du 01/10/2026, §5 — garde-fou anti « doorway pages »).
 *
 * Méthode :
 *   1. Texte du `<main>` uniquement, sans `<script>`/`<style>` et sans les blocs
 *      marqués `data-shared="true"` (tarifs, méthodologie, appel à l'action).
 *   2. Normalisation : minuscules ; nom du pays, gentilé, capitale, opérateur
 *      et devise remplacés par des jetons génériques (xpays, xcapitale,
 *      xoperateur, xdevise) — une page qui ne diffère que par ces mots est
 *      donc mesurée comme identique.
 *   3. Similarité de Jaccard sur les 5-grammes de mots, pour chaque paire.
 *
 * Seuils bloquants : similarité max par paire ≤ 0,25 ; au moins 60 % des
 * 5-grammes de chaque page lui sont propres ; titres, H1 et meta descriptions
 * uniques.
 *
 * PUR, sans dépendance, ES5-safe (pas de spread de Set/Map, pas de regex /u).
 */

export const SEUIL_SIMILARITE_MAX = 0.25;
export const SEUIL_PART_PROPRE_MIN = 0.6;
const TAILLE_NGRAMME = 5;

/** Variantes à remplacer par un jeton générique, par catégorie. */
export interface JetonsPays {
  pays: string[];       // nom, nom complet, gentilé (« burkinabè », « sénégalais »…)
  capitale: string[];
  operateur: string[];
  devise: string[];
}

export interface PageMesuree {
  slug: string;
  titre: string;
  h1: string;
  metaDescription: string;
  texte: string;        // texte du <main> déjà extrait (non normalisé)
  jetons: JetonsPays;
}

export interface PaireSimilaire { a: string; b: string; similarite: number }

export interface ResultatPage {
  slug: string;
  nbNgrammes: number;
  partPropre: number;   // part des 5-grammes absents de toutes les autres pages
  similariteMax: number;
  plusProche: string;
}

export interface Rapport {
  pages: ResultatPage[];
  paires: PaireSimilaire[];        // triées de la plus similaire à la moins similaire
  doublons: { champ: "titre" | "h1" | "metaDescription"; valeur: string; slugs: string[] }[];
  infractions: string[];           // vide = sous les seuils
}

const ENTITES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»",
};

function decoderEntites(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (tout, code: string) => {
    if (code.charAt(0) === "#") {
      const n = code.charAt(1) === "x" || code.charAt(1) === "X"
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return isNaN(n) ? tout : String.fromCharCode(n);
    }
    return ENTITES[code] !== undefined ? ENTITES[code] : tout;
  });
}

/** Retire un élément et tout son contenu (gère l'imbrication de balises de même nom). */
function retirerElements(html: string, ouverture: RegExp): string {
  let sortie = html;
  for (let garde = 0; garde < 500; garde++) {
    ouverture.lastIndex = 0;
    const m = ouverture.exec(sortie);
    if (!m) return sortie;
    const balise = m[1].toLowerCase();
    const debut = m.index;
    const finOuverture = debut + m[0].length;
    if (m[0].charAt(m[0].length - 2) === "/") {           // <balise … />
      sortie = sortie.slice(0, debut) + " " + sortie.slice(finOuverture);
      continue;
    }
    const scan = new RegExp("<(/?)" + balise + "(?=[\\s>/])[^>]*>", "gi");
    scan.lastIndex = finOuverture;
    let profondeur = 1;
    let fin = sortie.length;
    let t: RegExpExecArray | null;
    while ((t = scan.exec(sortie)) !== null) {
      if (t[1] === "/") profondeur--;
      else if (t[0].charAt(t[0].length - 2) !== "/") profondeur++;
      if (profondeur === 0) { fin = t.index + t[0].length; break; }
    }
    sortie = sortie.slice(0, debut) + " " + sortie.slice(fin);
  }
  return sortie;
}

/**
 * Texte lisible du `<main>` : sans script, style, noscript ni blocs
 * `data-shared="true"`. Chaîne vide s'il n'y a pas de `<main>`.
 */
export function extraireTexteMain(html: string): string {
  const debut = html.search(/<main[\s>]/i);
  if (debut < 0) return "";
  const fin = html.indexOf("</main>", debut);
  let main = html.slice(debut, fin < 0 ? html.length : fin);
  main = retirerElements(main, /<(script|style|noscript)(?=[\s>])[^>]*>/gi);
  main = retirerElements(main, /<([a-zA-Z][a-zA-Z0-9]*)(?=[\s>])[^>]*\sdata-shared="true"[^>]*>/g);
  const texte = decoderEntites(main.replace(/<[^>]+>/g, " "));
  return texte.replace(/\s+/g, " ").trim();
}

/** Contenu texte du premier élément `<balise>` trouvé (ex. le premier `<h1>`). */
export function texteDePremiere(html: string, balise: string): string {
  const m = new RegExp("<" + balise + "(?=[\\s>])[^>]*>([\\s\\S]*?)</" + balise + ">", "i").exec(html);
  return m ? decoderEntites(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() : "";
}

/** Contenu de `<meta name="description">`. */
export function metaDescription(html: string): string {
  const m = /<meta\s+name="description"\s+content="([^"]*)"/i.exec(html);
  return m ? decoderEntites(m[1]).trim() : "";
}

function echapperRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lettres françaises conservées ; tout le reste sépare les mots. */
const HORS_MOT = /[^a-z0-9àâäçéèêëîïôöùûüÿœæ]+/g;

/** Minuscules, jetons génériques, ponctuation retirée → liste de mots. */
export function normaliserEnMots(texte: string, jetons: JetonsPays): string[] {
  let t = " " + texte.toLowerCase().replace(/[’`]/g, "'") + " ";
  const remplacements: { variante: string; jeton: string }[] = [];
  const ajouter = (liste: string[], jeton: string) => {
    for (let i = 0; i < liste.length; i++) {
      const v = liste[i].trim().toLowerCase().replace(/[’`]/g, "'");
      if (v) remplacements.push({ variante: v, jeton });
    }
  };
  ajouter(jetons.pays, " xpays ");
  ajouter(jetons.capitale, " xcapitale ");
  ajouter(jetons.operateur, " xoperateur ");
  ajouter(jetons.devise, " xdevise ");
  // Les plus longues d'abord (« Côte d'Ivoire » avant « Côte »).
  remplacements.sort((x, y) => y.variante.length - x.variante.length);
  for (let i = 0; i < remplacements.length; i++) {
    const v = remplacements[i].variante;
    // Pas de lettre accolée de part et d'autre (sans \b, qui ignore les accents).
    const re = new RegExp("(^|[^a-z0-9àâäçéèêëîïôöùûüÿœæ])" + echapperRegex(v) + "(?![a-z0-9àâäçéèêëîïôöùûüÿœæ])", "g");
    t = t.replace(re, "$1" + remplacements[i].jeton);
  }
  return t.replace(HORS_MOT, " ").trim().split(" ").filter((m) => m.length > 0);
}

/** Ensemble des n-grammes de mots (objet-clé : ES5-safe). */
export function ngrammes(mots: string[], n: number = TAILLE_NGRAMME): Record<string, true> {
  const ens: Record<string, true> = {};
  for (let i = 0; i + n <= mots.length; i++) ens[mots.slice(i, i + n).join(" ")] = true;
  return ens;
}

/** Jaccard |A ∩ B| / |A ∪ B| ; 0 si les deux ensembles sont vides. */
export function jaccard(a: Record<string, true>, b: Record<string, true>): number {
  let inter = 0;
  const cles = Object.keys(a);
  for (let i = 0; i < cles.length; i++) if (b[cles[i]]) inter++;
  const union = cles.length + Object.keys(b).length - inter;
  return union === 0 ? 0 : inter / union;
}

export function analyserPages(pages: PageMesuree[]): Rapport {
  const ens = pages.map((p) => ngrammes(normaliserEnMots(p.texte, p.jetons)));
  const paires: PaireSimilaire[] = [];
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      paires.push({ a: pages[i].slug, b: pages[j].slug, similarite: jaccard(ens[i], ens[j]) });
    }
  }
  paires.sort((x, y) => y.similarite - x.similarite);

  const resultats: ResultatPage[] = pages.map((p, i) => {
    let total = 0;
    let propres = 0;
    for (const k in ens[i]) {
      total++;
      let ailleurs = false;
      for (let j = 0; j < ens.length && !ailleurs; j++) if (j !== i && ens[j][k]) ailleurs = true;
      if (!ailleurs) propres++;
    }
    // Paires triées par similarité décroissante : la première qui contient la
    // page donne sa voisine la plus proche.
    let max = 0;
    let proche = "";
    for (let q = 0; q < paires.length; q++) {
      if (paires[q].a === p.slug || paires[q].b === p.slug) {
        max = paires[q].similarite;
        proche = paires[q].a === p.slug ? paires[q].b : paires[q].a;
        break;
      }
    }
    return { slug: p.slug, nbNgrammes: total, partPropre: total === 0 ? 0 : propres / total, similariteMax: max, plusProche: proche };
  });

  const doublons: Rapport["doublons"] = [];
  const champs: ("titre" | "h1" | "metaDescription")[] = ["titre", "h1", "metaDescription"];
  for (let c = 0; c < champs.length; c++) {
    const parValeur: Record<string, string[]> = {};
    for (let i = 0; i < pages.length; i++) {
      const v = pages[i][champs[c]].trim().toLowerCase();
      (parValeur[v] = parValeur[v] || []).push(pages[i].slug);
    }
    for (const v in parValeur) {
      if (parValeur[v].length > 1 || v === "") doublons.push({ champ: champs[c], valeur: v, slugs: parValeur[v] });
    }
  }

  const infractions: string[] = [];
  for (let q = 0; q < paires.length; q++) {
    if (paires[q].similarite > SEUIL_SIMILARITE_MAX) {
      infractions.push(`Similarité ${paires[q].a} / ${paires[q].b} = ${paires[q].similarite.toFixed(2)} (> ${SEUIL_SIMILARITE_MAX})`);
    }
  }
  for (let i = 0; i < resultats.length; i++) {
    if (resultats[i].partPropre < SEUIL_PART_PROPRE_MIN) {
      infractions.push(`${resultats[i].slug} : ${(resultats[i].partPropre * 100).toFixed(0)} % de 5-grammes propres (< ${SEUIL_PART_PROPRE_MIN * 100} %)`);
    }
  }
  for (let d = 0; d < doublons.length; d++) {
    infractions.push(doublons[d].valeur === ""
      ? `${doublons[d].champ} vide : ${doublons[d].slugs.join(", ")}`
      : `${doublons[d].champ} en double : ${doublons[d].slugs.join(", ")}`);
  }

  return { pages: resultats, paires, doublons, infractions };
}
