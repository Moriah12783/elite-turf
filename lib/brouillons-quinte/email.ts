/**
 * lib/brouillons-quinte/email.ts — e-mails à Steph seul (spec §9).
 * PUR : objet + HTML. L'envoi et le journal (une fois par genre et par jour)
 * sont faits par la route.
 */
import type { Confiance } from "./selection";

export type RaisonEchec =
  | "pmu_injoignable"
  | "course_pmu_non_reconnue"
  | "cotes_factices"
  | "cotes_indisponibles"
  | "erreur";

export const RAISONS_LISIBLES: Record<RaisonEchec, string> = {
  pmu_injoignable: "le PMU ne répond pas",
  course_pmu_non_reconnue: "la course PMU ne correspond pas à la nôtre (chevaux différents)",
  cotes_factices: "les cotes PMU semblent factices",
  cotes_indisponibles: "moins de 8 chevaux ont une cote PMU",
  erreur: "erreur technique",
};

export interface ChevalResume {
  numero: number;
  nom: string;
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
  } else {
    morceaux.push(blocLiens(liens));
    morceaux.push("<p>Rien n'est publié : relisez, puis cliquez « Publier ».</p>");
  }
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
