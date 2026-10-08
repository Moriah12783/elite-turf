/**
 * lib/brouillons-quinte/email.ts — e-mails à Steph seul (spec §9).
 * PUR : objet + HTML. L'envoi et le journal (une fois par genre et par jour)
 * sont faits par la route.
 */
import type { Confiance } from "./selection";

export type RaisonEchec =
  | "pmu_injoignable"
  | "course_pmu_non_reconnue"
  | "partants_incoherents"
  | "cotes_factices"
  | "cotes_indisponibles"
  | "erreur";

export const RAISONS_LISIBLES: Record<RaisonEchec, string> = {
  pmu_injoignable: "le PMU ne répond pas",
  course_pmu_non_reconnue: "la course PMU ne correspond pas à la nôtre (chevaux différents)",
  partants_incoherents: "les partants de notre base ne correspondent pas à ceux du PMU (numéros ou noms)",
  cotes_factices: "les cotes PMU semblent factices",
  cotes_indisponibles: "moins de 8 chevaux ont une cote PMU",
  erreur: "erreur technique",
};

export interface ChevalResume {
  numero: number;
  nom: string;
}

/** Une ligne du tableau des musiques (tous les chevaux, pour l'analyse de Steph). */
export interface LigneMusique {
  numero: number;
  nom: string;
  nonPartant: boolean;
  cote: number | null;
  /** Rang au marché (1 = favori) ; null sans cote ou non partant. */
  rang: number | null;
  /** Même cote qu'un autre partant classé. */
  exAequo: boolean;
  /** 7 dernières places, de la plus récente à la plus ancienne ; null si musique inconnue. */
  places: string[] | null;
  /** Fautes (D, A, T) parmi ces places ; null si musique inconnue. */
  fautes: number | null;
  /** « Base ⭐ », « Base », « Value Pro », « Value Elite » ou « Value Pro + Elite » ; null sinon. */
  retenu: string | null;
}

export interface ResumeBrouillons {
  jour: string;
  prix: string;
  hippodrome: string;
  reunion: number;
  course: number;
  heureGmt: string;
  releve: string | null;
  confiance: Confiance;
  pro: { base: ChevalResume[]; values: ChevalResume[] };
  elite: { base: ChevalResume[]; values: ChevalResume[]; ecartes: ChevalResume[]; completeAvecFautifs: boolean };
  /** Tous les chevaux, classés par cote, non-partants à la fin. */
  partants: LigneMusique[];
  /** Textes des brouillons (analyse courte commune + analyses complètes), montrés dans l'essai à blanc. */
  textes: { courte: string; pro: string; elite: string };
}

/** Liens d'édition des brouillons ; null pour un brouillon absent. */
export interface LiensBrouillons {
  pro: string | null;
  elite: string | null;
}

export type GenreEmail = "prets" | "blanc" | "echec";

/** Type `email_sent_log` : un par genre et par jour (l'essai à blanc a le sien). */
export function typeJournal(jour: string, genre: GenreEmail): string {
  if (genre === "blanc") return `BROUILLONS_QUINTE_BLANC_${jour}`;
  if (genre === "echec") return `BROUILLONS_QUINTE_ECHEC_${jour}`;
  return `BROUILLONS_QUINTE_${jour}`;
}

const LIBELLES_CONFIANCE: Record<Confiance, string> = { ELEVE: "Élevé", MOYEN: "Moyen", FAIBLE: "Faible" };

function echapper(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function chevaux(liste: ChevalResume[], pivot: number | null): string {
  return liste.map((c) => `n°${c.numero} ${echapper(c.nom)}${c.numero === pivot ? " (pivot)" : ""}`).join(", ");
}

function blocSelection(titre: string, sel: { base: ChevalResume[]; values: ChevalResume[] }): string {
  const pivot = sel.base.length > 0 ? sel.base[0].numero : null;
  return `<h3 style="margin:16px 0 4px">${titre}</h3>`
    + `<p style="margin:0">★ Base : ${chevaux(sel.base, pivot)}<br>◇ Values : ${chevaux(sel.values, null)}</p>`;
}

/** 3.8 → « 3,8 » ; 10 → « 10 ». */
function coteFr(c: number): string {
  return String(c).replace(".", ",");
}

/** Podiums en vert, fautes en rouge, « 0 » en gris. */
function placeHtml(p: string): string {
  if (p === "1" || p === "2" || p === "3") return `<b style="color:#15803d">${p}</b>`;
  if (p === "D" || p === "A" || p === "T") return `<b style="color:#b91c1c">${p}</b>`;
  if (p === "0") return `<span style="color:#9ca3af">0</span>`;
  return echapper(p);
}

/** Tableau des musiques de tous les chevaux (option A, décision de Steph du 07/10/2026). */
function tableauMusiques(lignes: LigneMusique[]): string {
  if (lignes.length === 0) return "";
  const th = (t: string) => `<th style="text-align:left;padding:3px 8px;border-bottom:1px solid #ccc">${t}</th>`;
  const td = (t: string) => `<td style="padding:3px 8px;border-bottom:1px solid #eee">${t}</td>`;
  const entete = ["N°", "Cheval", "Cote", "Marché", "7 dernières", "Fautes", "Retenu"].map(th).join("");
  const corps = lignes.map((l) => "<tr>" + [
    td(String(l.numero)),
    td(echapper(l.nom)),
    td(l.nonPartant ? "non partant" : l.cote === null ? "—" : coteFr(l.cote)),
    td(l.rang === null ? "—" : `${l.rang}${l.exAequo ? "=" : ""}`),
    td(l.places === null ? "inconnue" : l.places.map(placeHtml).join(" ")),
    td(l.fautes === null ? "—" : String(l.fautes)),
    td(l.retenu ? echapper(l.retenu) : ""),
  ].join("") + "</tr>").join("");
  return `<h3 style="margin:20px 0 4px">Musiques des partants</h3>`
    + `<p style="margin:0 0 6px;font-size:12px;color:#555">7 dernières courses, de la plus récente à la plus ancienne. 0 = au-delà du 9e ; D = disqualifié, A = arrêté, T = tombé. « = » : même cote qu'un autre partant.</p>`
    + `<table style="border-collapse:collapse;font-size:13px">${entete}${corps}</table>`;
}

/** Textes prévus, à copier tels quels : lignes conservées (décision de Steph du 08/10/2026). */
function blocTextes(t: ResumeBrouillons["textes"]): string {
  const bloc = (titre: string, texte: string) => `<h4 style="margin:12px 0 4px">${titre}</h4>`
    + `<div style="white-space:pre-wrap;font-size:13px;border:1px solid #ddd;padding:8px">${echapper(texte)}</div>`;
  return `<h3 style="margin:20px 0 4px">Textes prévus pour les brouillons</h3>`
    + bloc("Analyse courte (aperçu public)", t.courte)
    + bloc("Analyse complète — Pro", t.pro)
    + bloc("Analyse complète — Elite", t.elite);
}

function blocLiens(l: LiensBrouillons): string {
  const liens: string[] = [];
  if (l.pro) liens.push(`<a href="${echapper(l.pro)}">Ouvrir le brouillon Pro</a>`);
  if (l.elite) liens.push(`<a href="${echapper(l.elite)}">Ouvrir le brouillon Elite</a>`);
  return liens.length > 0 ? `<p>${liens.join(" · ")}</p>` : "";
}

/** « prêts » (avec liens) ou essai à blanc (`liens = null`). */
export function emailBrouillons(r: ResumeBrouillons, liens: LiensBrouillons | null): { subject: string; html: string } {
  const subject = liens === null
    ? `[ESSAI À BLANC] Brouillons du Quinté+ — ${r.prix}`
    : `Brouillons du Quinté+ prêts — ${r.prix} (${r.heureGmt} GMT)`;
  const morceaux = [
    `<p><strong>${echapper(r.prix)}</strong> — ${echapper(r.hippodrome)} (R${r.reunion}C${r.course}), départ ${r.heureGmt} GMT.</p>`,
    `<p>${r.releve ? `Cotes PMU relevées à ${r.releve} GMT` : "Cotes PMU"} · confiance proposée : ${LIBELLES_CONFIANCE[r.confiance]}.</p>`,
    blocSelection("Pro (6 chevaux)", r.pro),
    blocSelection("Elite (6 chevaux)", r.elite),
  ];
  if (r.elite.ecartes.length > 0) {
    morceaux.push(`<p>Non retenus pour leurs fautes : ${chevaux(r.elite.ecartes, null)}.</p>`);
  }
  if (r.elite.completeAvecFautifs) {
    morceaux.push("<p>⚠️ Moins de 3 values sans fautes : l'Elite a été complété avec des chevaux fautifs. À vérifier.</p>");
  }
  if (liens === null) {
    morceaux.push("<p>Rien n'a été créé : l'interrupteur BROUILLONS_QUINTE_ENABLED est fermé.</p>");
    morceaux.push(blocTextes(r.textes));
  } else {
    morceaux.push(blocLiens(liens));
    morceaux.push("<p>Rien n'est publié : relisez, puis cliquez « Publier ».</p>");
  }
  morceaux.push(tableauMusiques(r.partants));
  return { subject, html: morceaux.filter(Boolean).join("\n") };
}

/** Les brouillons existent mais l'e-mail « prêts » n'est pas parti : rappel court avec les liens. */
export function emailRelance(e: { prix: string; heureGmt: string; liens: LiensBrouillons }): { subject: string; html: string } {
  return {
    subject: `Brouillons du Quinté+ prêts — ${e.prix} (${e.heureGmt} GMT)`,
    html: [
      `<p>Les brouillons du Quinté+ (${echapper(e.prix)}, départ ${e.heureGmt} GMT) sont prêts ; le premier envoi de cet e-mail a échoué.</p>`,
      blocLiens(e.liens),
      "<p>Rien n'est publié : relisez, puis cliquez « Publier ».</p>",
    ].filter(Boolean).join("\n"),
  };
}

export function emailEchec(e: { jour: string; prix: string; heureGmt: string; raison: RaisonEchec; detail?: string | null }): { subject: string; html: string } {
  const raison = RAISONS_LISIBLES[e.raison];
  const lignes = [
    `<p>Les brouillons du Quinté+ (${echapper(e.prix)}, départ ${e.heureGmt} GMT) n'ont pas pu être préparés : ${raison}.</p>`,
  ];
  if (e.detail) lignes.push(`<p>Détail : ${echapper(e.detail)}</p>`);
  lignes.push("<p>Publiez à la main comme d'habitude (Admin → Pronostics → « Nouveau pronostic »).</p>");
  return { subject: `Brouillons du Quinté+ NON préparés — ${raison}`, html: lignes.join("\n") };
}
