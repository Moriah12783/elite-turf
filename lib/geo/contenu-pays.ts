/**
 * Contenu des pages pays migrées (brief « pages pays » du 01/10/2026, §3).
 * Vague 1 : Burkina Faso, Côte d'Ivoire, Sénégal.
 *
 * PUR et testé : les composants (components/geo/pays/) n'affichent que ce que
 * renvoient ces fonctions, et le garde-fou de similarité mesure ce même
 * contenu. Aucun texte n'est généré à l'affichage : tout vient du registre de
 * faits validé par Steph (lib/geo/fiches) ou des textes éditoriaux fixes
 * ci-dessous. Un fait non publiable (sans source ni date) n'apparaît jamais.
 *
 * ES5-safe (pas de spread de Set/Map, pas de regex /u).
 */
import { estPubliable, type Fait, type FichePays, type ModeDeJeu } from "@/lib/geo/fiches/types";
import { heureLocaleDepuisParis } from "@/lib/geo/heure-locale";

/** Vague 1 : pages servies par le nouveau gabarit (components/geo/pays). */
export const PAYS_MIGRES: string[] = ["burkina-faso", "cote-d-ivoire", "senegal"];

/** Pages en noindex et hors sitemap tant qu'aucune fiche vérifiée n'existe (brief §6). */
export const PAYS_NOINDEX: string[] = ["togo"];

export const estMigre = (slug: string) => PAYS_MIGRES.indexOf(slug) >= 0;

export interface CourseDuJour {
  libelle: string | null;
  heure_depart: string | null;
  hippodrome?: { nom?: string | null } | { nom?: string | null }[] | null;
}

export interface EditoPays {
  slug: string;
  nom: string;
  /** « depuis le Burkina Faso » */
  depuis: string;
  /** Ville de référence de l'heure locale. */
  ville: string;
  /** <title> stable, sans date (brief §3). Le gabarit du site ajoute « | Elite Turf ». */
  titre: string;
  h1: string;
  sousTitre: string;
  /** Meta description quand la course du jour est inconnue. */
  metaParDefaut: string;
  /** Meta description du jour (course + heure locale de départ). */
  metaDuJour: (c: { prix: string; hippodrome: string; heure: string }) => string;
  /** Nom court de l'opérateur, pour la mention d'indépendance. */
  operateurCourt: string;
  /** Le programme du jour de l'opérateur est-il connu ? (seule la LONACI l'est). */
  coursesOperateur: boolean;
}

export const EDITO: Record<string, EditoPays> = {
  "burkina-faso": {
    slug: "burkina-faso",
    nom: "Burkina Faso",
    depuis: "depuis le Burkina Faso",
    ville: "Ouagadougou",
    titre: "Pronostic PMU Burkina Faso du jour : Quinté+ à l'heure de Ouagadougou",
    h1: "Pronostic PMU Burkina Faso du jour",
    sousTitre: "Le PMU'B de la LONAB, ses formules et notre pronostic du Quinté+, à l'heure de Ouagadougou.",
    metaParDefaut: "Le PMU'B de la LONAB : 4+1, Tiercé, Quarté, Couplé, formules et mises de base, avec notre pronostic du Quinté+ à l'heure de Ouagadougou.",
    metaDuJour: (c) => `Quinté+ du jour : ${c.prix} à ${c.hippodrome}, départ à ${c.heure} à Ouagadougou. Le PMU'B de la LONAB, ses formules et notre pronostic.`,
    operateurCourt: "la LONAB",
    coursesOperateur: false,
  },
  "cote-d-ivoire": {
    slug: "cote-d-ivoire",
    nom: "Côte d'Ivoire",
    depuis: "depuis la Côte d'Ivoire",
    ville: "Abidjan",
    titre: "Pronostic LONACI du jour : Quinté+ PMU à l'heure d'Abidjan",
    h1: "Pronostic LONACI du jour",
    sousTitre: "Le PMU de la LONACI, les Nationales du jour et notre pronostic du Quinté+, à l'heure d'Abidjan.",
    metaParDefaut: "Le PMU de la LONACI : Nationale 1, Quinté+ et Quinté, paris ALR et PLR, avec notre pronostic du Quinté+ à l'heure d'Abidjan.",
    metaDuJour: (c) => `Quinté+ du jour : ${c.prix} à ${c.hippodrome}, départ à ${c.heure} à Abidjan. Les Nationales de la LONACI et notre pronostic du jour.`,
    operateurCourt: "la LONACI",
    coursesOperateur: true,
  },
  senegal: {
    slug: "senegal",
    nom: "Sénégal",
    depuis: "depuis le Sénégal",
    ville: "Dakar",
    titre: "PMU Sénégal : pronostic du jour à l'heure de Dakar",
    h1: "PMU Sénégal : pronostic du jour",
    sousTitre: "Le PMU de la LONASE, ses paris ALR et PLR et notre pronostic du Quinté+, à l'heure de Dakar.",
    metaParDefaut: "Le PMU de la LONASE : ALR 1, 2 et 3, paris ALR et PLR, LONASE.BET, avec notre pronostic du Quinté+ à l'heure de Dakar.",
    metaDuJour: (c) => `Quinté+ du jour : ${c.prix} à ${c.hippodrome}, départ à ${c.heure} à Dakar. Le PMU de la LONASE, ses paris ALR et PLR et notre pronostic.`,
    operateurCourt: "la LONASE",
    coursesOperateur: false,
  },
};

/** « 11:55 » → « 11 h 55 » */
export function heureFr(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm);
  return m ? `${m[1]} h ${m[2]}` : hhmm;
}

/** « 2026-10-01 » → « 01/10/2026 » */
const dateFr = (iso: string) => iso.split("-").reverse().join("/");

const domaine = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");

function hippodromeDe(c: CourseDuJour): string {
  const h = Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome;
  return (h && h.nom ? h.nom : "").trim();
}

export interface EnteteDuJour {
  phrase: string;
  prix: string;
  hippodrome: string;
  heure: string;
  ville: string;
}

/**
 * Bloc 1 — « Quinté+ du jour depuis {pays} : {Prix}, {hippodrome}, départ à
 * {heure locale} ({ville}) ». null si une donnée manque : le bloc est masqué,
 * sans texte de remplacement (brief §8, critère 6).
 */
export function enteteDuJour(edito: EditoPays, fiche: FichePays, date: string, course: CourseDuJour | null | undefined): EnteteDuJour | null {
  if (!course || !course.libelle || !course.heure_depart) return null;
  const hippodrome = hippodromeDe(course);
  if (!hippodrome) return null;
  const locale = heureLocaleDepuisParis(date, course.heure_depart, fiche.fuseau);
  if (!locale) return null;
  const heure = heureFr(locale.heure);
  const prix = course.libelle.trim();
  return {
    phrase: `Quinté+ du jour ${edito.depuis} : ${prix}, ${hippodrome}, départ à ${heure} (${edito.ville})`,
    prix, hippodrome, heure, ville: edito.ville,
  };
}

export function metaDescriptionPays(edito: EditoPays, entete: EnteteDuJour | null): string {
  return entete ? edito.metaDuJour({ prix: entete.prix, hippodrome: entete.hippodrome, heure: entete.heure }) : edito.metaParDefaut;
}

export interface SourceAffichee { url: string; domaine: string; date: string }

const sourceDe = (f: Fait<unknown>): SourceAffichee => ({ url: f.source, domaine: domaine(f.source), date: dateFr(f.verifieLe) });

const LIBELLES_MODES: Record<ModeDeJeu, string> = {
  guichet: "En point de vente (guichet)",
  "en-ligne": "En ligne",
  mobile: "Sur mobile",
};

export interface BlocJouer {
  titre: string;
  operateur: { nom: string; site: string; source: SourceAffichee };
  modes?: { libelles: string[]; source: SourceAffichee };
  heureLimite?: { texte: string; source: SourceAffichee };
  courses?: { lignes: string[]; source: SourceAffichee };
  paris?: { lignes: { nom: string; description: string }[]; source: SourceAffichee };
  vocabulaire?: { termes: { terme: string; sens: string }[]; source: SourceAffichee };
  mention: string;
}

/**
 * Bloc 2 — « Jouer {depuis} » : uniquement les faits publiables du registre.
 * null sans opérateur publiable (le bloc entier est alors masqué).
 */
export function blocJouerDepuis(edito: EditoPays, fiche: FichePays): BlocJouer | null {
  if (!estPubliable(fiche.operateur)) return null;
  const op = fiche.operateur;
  const bloc: BlocJouer = {
    titre: `Jouer au PMU ${edito.depuis}`,
    operateur: { nom: op.valeur.nom, site: op.valeur.site, source: sourceDe(op) },
    mention: `Elite Turf est un service indépendant d'analyse, sans lien avec ${edito.operateurCourt}.`,
  };
  if (estPubliable(fiche.modesDeJeu)) {
    bloc.modes = { libelles: fiche.modesDeJeu.valeur.map((m) => LIBELLES_MODES[m] || m), source: sourceDe(fiche.modesDeJeu) };
  }
  if (estPubliable(fiche.heureLimite)) {
    bloc.heureLimite = { texte: fiche.heureLimite.valeur, source: sourceDe(fiche.heureLimite) };
  }
  if (estPubliable(fiche.reunionsProposees)) {
    bloc.courses = { lignes: fiche.reunionsProposees.valeur.slice(), source: sourceDe(fiche.reunionsProposees) };
  }
  if (estPubliable(fiche.parisLocaux)) {
    bloc.paris = { lignes: fiche.parisLocaux.valeur.slice(), source: sourceDe(fiche.parisLocaux) };
  }
  if (estPubliable(fiche.vocabulaire)) {
    const v = fiche.vocabulaire.valeur;
    bloc.vocabulaire = { termes: Object.keys(v).map((t) => ({ terme: t, sens: v[t] })), source: sourceDe(fiche.vocabulaire) };
  }
  return bloc;
}

export interface CourseOperateur {
  nationale: number | null;
  libelle: string | null;
  heure_depart: string | null;
  numero_reunion: number | null;
  numero_course: number | null;
  hippodrome?: { nom?: string | null } | { nom?: string | null }[] | null;
}

export interface LigneNationale { rang: string; course: string; heure: string }

/**
 * Bloc 3 (Côte d'Ivoire) — les Nationales du jour au programme de la LONACI,
 * à l'heure d'Abidjan. Seules les lignes complètes sont affichées.
 */
export function lignesNationales(courses: CourseOperateur[], fiche: FichePays, date: string): LigneNationale[] {
  const lignes: { n: number; l: LigneNationale }[] = [];
  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    if (!c.nationale || c.nationale < 1 || c.nationale > 3 || !c.libelle || !c.heure_depart) continue;
    const locale = heureLocaleDepuisParis(date, c.heure_depart, fiche.fuseau);
    const hippodrome = hippodromeDe(c);
    if (!locale || !hippodrome) continue;
    const rc = c.numero_reunion && c.numero_course ? `R${c.numero_reunion} C${c.numero_course} · ` : "";
    lignes.push({ n: c.nationale, l: { rang: `Nationale ${c.nationale}`, course: `${rc}${hippodrome} · ${c.libelle.trim()}`, heure: heureFr(locale.heure) } });
  }
  lignes.sort((a, b) => a.n - b.n);
  return lignes.map((x) => x.l);
}

/** Bloc 6 — FAQ du registre, identique à l'écran et en JSON-LD. */
export function faqPays(fiche: FichePays): { q: string; a: string }[] {
  return fiche.faq.map((f) => ({ q: f.q, a: f.a }));
}

/**
 * Texte éditorial d'une page migrée (hors blocs partagés et hors données du
 * jour) : ce que mesure le garde-fou de similarité en CI.
 */
export function texteEditorial(edito: EditoPays, fiche: FichePays): string {
  const morceaux: string[] = [edito.h1, edito.sousTitre];
  const b = blocJouerDepuis(edito, fiche);
  if (b) {
    morceaux.push(b.titre, b.operateur.nom, b.mention);
    if (b.modes) morceaux.push(b.modes.libelles.join(" "));
    if (b.heureLimite) morceaux.push(b.heureLimite.texte);
    if (b.courses) morceaux.push(b.courses.lignes.join(" "));
    if (b.paris) for (let i = 0; i < b.paris.lignes.length; i++) morceaux.push(b.paris.lignes[i].nom, b.paris.lignes[i].description);
    if (b.vocabulaire) for (let i = 0; i < b.vocabulaire.termes.length; i++) morceaux.push(b.vocabulaire.termes[i].terme, b.vocabulaire.termes[i].sens);
  }
  const faq = faqPays(fiche);
  for (let i = 0; i < faq.length; i++) morceaux.push(faq[i].q, faq[i].a);
  return morceaux.join(" ");
}
