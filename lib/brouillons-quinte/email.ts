/**
 * lib/brouillons-quinte/email.ts — e-mails à Steph seul (spec §9).
 * PUR : objet + HTML. L'envoi et le journal (une fois par genre et par jour)
 * sont faits par la route.
 */
import type { Confiance } from "./selection";
import type { RaisonArgon } from "./argon";

export type RaisonEchec =
  | RaisonArgon
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
  cotes_indisponibles: "des chevaux n'ont pas de cote PMU",
  erreur: "erreur technique",
  argon_injoignable: "Argon ne répond pas",
  argon_format_inattendu: "la réponse d'Argon n'a pas le format attendu",
  argon_course_introuvable: "Argon ne connaît pas ce Quinté+",
  argon_non_scelle: "l'édition T-90 d'Argon n'a pas été scellée à temps",
  argon_partants_incoherents: "les chevaux d'Argon ne correspondent pas aux partants du PMU",
  argon_partants_insuffisants: "moins de 6 chevaux d'Argon sont partants",
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
  /** « Base ⭐ », « Base », « Value Pro », « Value Elite », « Value Pro + Elite », « Associé » ou « Value Pro · Associé » ; null sinon. */
  retenu: string | null;
  /** Allocations (euros) des dernières courses, de la plus récente à la plus ancienne ; null si inconnues. */
  allocations: Array<number | null> | null;
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
  /** Allocation de la course du jour (euros) ; null si inconnue. */
  allocationJour: number | null;
  pro: { base: ChevalResume[]; values: ChevalResume[] };
  elite: { base: ChevalResume[]; values: ChevalResume[]; associes: ChevalResume[] };
  /** Avis d'Argon, recopié pour information (jamais posé dans les brouillons). */
  argon: {
    /** Heure GMT du scellement de l'édition T-90, « 16:45 » ; null si Argon ne la donne pas. */
    lockGmt: string | null;
    argon8: ChevalResume[];
    etoiles: number;
    /** Argon déconseille de jouer la course. */
    deconseillee: boolean;
    decision: string | null;
    /** Chevaux d'Argon non partants selon le PMU. */
    nonPartants: ChevalResume[];
  };
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

function blocSelection(niveau: "Pro" | "Elite", sel: { base: ChevalResume[]; values: ChevalResume[]; associes?: ChevalResume[] }): string {
  const pivot = sel.base.length > 0 ? sel.base[0].numero : null;
  const associes = sel.associes ?? [];
  const total = sel.base.length + sel.values.length + associes.length;
  return `<h3 style="margin:16px 0 4px">${niveau} (${total} chevaux)</h3>`
    + `<p style="margin:0">★ Base : ${chevaux(sel.base, pivot)}<br>◇ Values : ${chevaux(sel.values, null)}`
    + (associes.length > 0 ? `<br>🤝 Associés : ${chevaux(associes, null)}` : "")
    + "</p>";
}

/** « n°6 » ; « n°6 et n°7 ». */
function numerosEt(liste: ChevalResume[]): string {
  const n = liste.map((c) => `n°${c.numero}`);
  return n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} et ${n[n.length - 1]}`;
}

/** Alerte en tête : un cheval d'Argon est non partant, l'Elite est incomplet. */
function alerteNonPartants(r: ResumeBrouillons): string {
  const np = r.argon.nonPartants;
  if (np.length === 0) return "";
  const total = r.elite.base.length + r.elite.values.length + r.elite.associes.length;
  return `<p><strong>⚠️ ${numerosEt(np)} ${np.length > 1 ? "non partants" : "non partant"} : Elite à ${total} chevaux, ajoute un cheval avant de publier.</strong></p>`;
}

/** Avis d'Argon, pour information : Steph choisit le couplé lui-même. */
function blocAvisArgon(a: ResumeBrouillons["argon"]): string {
  const scellee = a.lockGmt ? `Édition T-90 scellée à ${echapper(a.lockGmt)} GMT` : "Édition T-90 scellée";
  const etoiles = `${a.etoiles} ${a.etoiles > 1 ? "étoiles" : "étoile"}`;
  return `<h3 style="margin:16px 0 4px">Avis d'Argon (pour information)</h3>`
    + `<p style="margin:0">${scellee} : ${a.argon8.map((c) => c.numero).join(" · ")}<br>${etoiles}`
    + (a.decision ? ` · ${echapper(a.decision)}` : "")
    + "</p>";
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

/** 50900 → « 50 900 ». */
function milliers(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** 19200 → « 19 » (milliers d'euros) ; en gras si la course valait au moins celle du jour. */
function allocationHtml(a: number | null, jour: number | null): string {
  if (a === null) return "?";
  const k = Math.round(a / 1000);
  const t = k < 1 ? "&lt;1" : String(k);
  return jour !== null && a >= jour ? `<b>${t}</b>` : t;
}

/**
 * Tableau des musiques de tous les chevaux (option A, décision de Steph du
 * 07/10/2026) ; allocations des dernières courses ajoutées le 12/10/2026 pour
 * voir qui monte ou descend de catégorie.
 */
function tableauMusiques(lignes: LigneMusique[], allocationJour: number | null): string {
  if (lignes.length === 0) return "";
  const avecAllocations = lignes.some((l) => l.allocations !== null);
  const th = (t: string) => `<th style="text-align:left;padding:3px 8px;border-bottom:1px solid #ccc">${t}</th>`;
  const td = (t: string) => `<td style="padding:3px 8px;border-bottom:1px solid #eee">${t}</td>`;
  const colonnes = ["N°", "Cheval", "Cote", "Marché", "7 dernières", "Fautes"]
    .concat(avecAllocations ? ["Alloc. (k€)"] : [])
    .concat(["Retenu"]);
  const corps = lignes.map((l) => "<tr>" + [
    td(String(l.numero)),
    td(echapper(l.nom)),
    td(l.nonPartant ? "non partant" : l.cote === null ? "—" : coteFr(l.cote)),
    td(l.rang === null ? "—" : `${l.rang}${l.exAequo ? "=" : ""}`),
    td(l.places === null ? "inconnue" : l.places.map(placeHtml).join(" ")),
    td(l.fautes === null ? "—" : String(l.fautes)),
  ].concat(avecAllocations
    ? [td(l.allocations === null ? "—" : l.allocations.map((a) => allocationHtml(a, allocationJour)).join(" · "))]
    : [],
  ).concat([
    td(l.retenu ? echapper(l.retenu) : ""),
  ]).join("") + "</tr>").join("");
  const legendeAllocations = !avecAllocations
    ? ""
    : ` Alloc. : allocation des dernières courses en milliers d'euros, de la plus récente à la plus ancienne${
      allocationJour === null ? "" : ` ; en gras, au moins celle du jour (${milliers(allocationJour)} €)`}.`;
  return `<h3 style="margin:20px 0 4px">Musiques des partants</h3>`
    + `<p style="margin:0 0 6px;font-size:12px;color:#555">7 dernières courses, de la plus récente à la plus ancienne. 0 = au-delà du 9e ; D = disqualifié, A = arrêté, T = tombé. « = » : même cote qu'un autre partant.${legendeAllocations}</p>`
    + `<table style="border-collapse:collapse;font-size:13px">${colonnes.map(th).join("")}${corps}</table>`;
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
  const objet = liens === null
    ? `[ESSAI À BLANC] Brouillons du Quinté+ — ${r.prix}`
    : `Brouillons du Quinté+ prêts — ${r.prix} (${r.heureGmt} GMT)`;
  const subject = r.argon.deconseillee ? `⚠️ Argon déconseille de jouer cette course — ${objet}` : objet;
  const morceaux = [
    alerteNonPartants(r),
    `<p><strong>${echapper(r.prix)}</strong> — ${echapper(r.hippodrome)} (R${r.reunion}C${r.course}), départ ${r.heureGmt} GMT.</p>`,
    `<p>${r.releve ? `Cotes PMU relevées à ${r.releve} GMT` : "Cotes PMU"} · confiance proposée : ${LIBELLES_CONFIANCE[r.confiance]}.</p>`,
    blocSelection("Pro", r.pro),
    blocSelection("Elite", r.elite),
    blocAvisArgon(r.argon),
  ];
  if (liens === null) {
    morceaux.push("<p>Rien n'a été créé : l'interrupteur BROUILLONS_QUINTE_ENABLED est fermé.</p>");
    morceaux.push(blocTextes(r.textes));
  } else {
    morceaux.push(blocLiens(liens));
    morceaux.push("<p>Rien n'est publié : relisez, puis cliquez « Publier ».</p>");
  }
  morceaux.push(tableauMusiques(r.partants, r.allocationJour));
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
