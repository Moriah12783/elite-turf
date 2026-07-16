/**
 * lib/courses/arrivees-group.ts
 *
 * Dédoublonnage + regroupement des arrivées par hippodrome, robuste au
 * MULTI-SOURCES. Une même course peut exister en double dans `courses` quand
 * deux sources créent deux hippodromes distincts pour la même piste :
 *   « Compiegne » vs « Compiègne » · « Le Mont Saint Michel » vs
 *   « Le Mont-Saint-Michel » · « Pornichet » vs « Pornichet-La Baule »…
 * (accents / espaces / tirets non normalisés → deux `hippodrome_id`).
 *
 * On regroupe sur la clé CANONIQUE de l'hippodrome (cf. canonicalHippodrome)
 * + réunion/course, et on ne garde que la ligne la PLUS RICHE (rapports PMU >
 * nom d'hippodrome propre > partants nommés). Effet de bord bénéfique : la
 * ligne « propre » porte aussi l'heure locale (Paris) et les rapports.
 *
 * PUR, testable — consommé par la page /arrivees/[date].
 */
import { canonicalHippodrome } from "@/lib/sync/hippodrome-canonical";

export interface ArriveeCourseLike {
  numero_reunion: number;
  numero_course:  number;
  heure_depart?:  string | null;
  hippodrome?:    { nom?: string | null; pays?: string | null } | null;
  rapports_pmu?:  unknown;
  partants?:      Array<{ nom_cheval?: string | null }> | null;
}

export interface HippoGroup<T> {
  hippodrome: { nom: string; pays: string | null } | null;
  courses:    T[];
}

/** true si `s` contient au moins un diacritique combinant (détection par
 * code-point → aucun littéral de caractère accentué en source). */
function hasAccents(s: string): boolean {
  const nfd = (s || "").normalize("NFD");
  for (const ch of nfd) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x0300 && c <= 0x036f) return true;
  }
  return false;
}

/** Score de « richesse » d'une ligne course pour départager les doublons.
 * Priorité : rapports (source la plus complète) → nom propre (accents/tirets,
 * qui vient de la source locale = heure de Paris) → partants nommés. */
function richness(c: ArriveeCourseLike): number {
  const nom = c.hippodrome?.nom ?? "";
  let s = 0;
  if (c.rapports_pmu) s += 100;
  if (hasAccents(nom)) s += 5;
  if (/[-']/.test(nom)) s += 3;
  const named = (c.partants ?? []).filter((p) => p?.nom_cheval).length;
  s += Math.min(named, 30);
  return s;
}

/** Deux formes canoniques désignent-elles le même hippodrome ? Égalité, OU
 * l'une est préfixe de l'autre (partie commune ≥ 5 car.) → gère les alias
 * court/long (« pornichet » ⊂ « pornichetlabaule », « cagnes » ⊂
 * « cagnessurmer »). Le garde-fou « préfixe + longueur » évite de fusionner
 * deux pistes réellement distinctes (ex. réunion étrangère homonyme). */
function sameHippodrome(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.startsWith(short);
}

/**
 * Dédoublonne une liste de courses. Sur une même date, (réunion, course)
 * identifie UNE épreuve : on regroupe dessus, puis on clusterise par
 * hippodrome COMPATIBLE (cf. sameHippodrome — jamais deux pistes distinctes)
 * et on garde la ligne la plus RICHE de chaque cluster. Ordre stable
 * (1re apparition de la réunion/course). PUR.
 */
export function dedupeArriveeCourses<T extends ArriveeCourseLike>(list: T[]): T[] {
  const groups = new Map<string, T[]>();
  const order: string[] = [];
  for (const c of list) {
    const key = `${c.numero_reunion}|${c.numero_course}`;
    let g = groups.get(key);
    if (!g) { g = []; groups.set(key, g); order.push(key); }
    g.push(c);
  }
  const out: T[] = [];
  for (const key of order) {
    const clusters: { proto: string; best: T }[] = [];
    for (const c of groups.get(key)!) {
      const cc = canonicalHippodrome(c.hippodrome?.nom ?? "");
      const cl = clusters.find((x) => sameHippodrome(x.proto, cc));
      if (!cl) {
        clusters.push({ proto: cc, best: c });
      } else {
        if (cc.length > cl.proto.length) cl.proto = cc; // proto = variante la plus complète
        if (richness(c) > richness(cl.best)) cl.best = c;
      }
    }
    for (const cl of clusters) out.push(cl.best);
  }
  return out;
}

/**
 * Regroupe des courses par hippodrome CANONIQUE. Le nom affiché est la variante
 * la plus « propre » du groupe (celle de la course la plus riche). N'effectue
 * PAS le dédoublonnage des courses : passer une liste déjà dédoublonnée via
 * `dedupeArriveeCourses`. PUR.
 */
export function groupByCanonicalHippodrome<T extends ArriveeCourseLike>(list: T[]): HippoGroup<T>[] {
  const groups = new Map<string, { hippodrome: { nom: string; pays: string | null }; courses: T[]; bestScore: number }>();
  const order: string[] = [];
  for (const c of list) {
    const key = canonicalHippodrome(c.hippodrome?.nom ?? "") || "autre";
    const nom = c.hippodrome?.nom ?? "Hippodrome";
    const pays = c.hippodrome?.pays ?? null;
    const score = richness(c);
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { hippodrome: { nom, pays }, courses: [c], bestScore: score });
      order.push(key);
    } else {
      g.courses.push(c);
      if (score > g.bestScore) { g.bestScore = score; g.hippodrome.nom = nom; g.hippodrome.pays = pays; }
    }
  }
  return order.map((key) => {
    const g = groups.get(key)!;
    g.courses.sort((a, b) => {
      const ha = a.heure_depart ?? "";
      const hb = b.heure_depart ?? "";
      if (ha !== hb) return ha < hb ? -1 : 1;
      return a.numero_course - b.numero_course;
    });
    return { hippodrome: g.hippodrome, courses: g.courses };
  });
}
