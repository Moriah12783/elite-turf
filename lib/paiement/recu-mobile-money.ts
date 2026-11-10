/**
 * Reçu d'un paiement Orange Money / Wave — règles PURES (demande de Steph du
 * 10/11/2026) : après l'activation, l'admin télécharge un reçu JPG et l'envoie
 * lui-même à l'abonné sur WhatsApp. Rien n'est envoyé automatiquement.
 *
 * Le reçu est construit UNIQUEMENT à partir de ce qui est enregistré en base
 * (ligne `transactions`, sa ligne `abonnements`, le profil) : il ne peut pas
 * contredire la comptabilité. Seuls les paiements enregistrés par le
 * formulaire « Activer un paiement Orange Money / Wave »
 * (`metadata.source = "admin_mobile_money"`) ont un reçu : les plus anciens
 * n'ont pas la formule payée.
 *
 * Dessin du JPG : components/admin/recu/dessinerRecu.ts.
 */
import { PLAN_CONFIG } from "@/types";
import { PAYS_MOBILE_MONEY } from "@/lib/paiement/mobile-money";
import { OPERATEURS, palierDeFormule, type Operateur, type Palier } from "@/lib/paiement/activation-mobile-money";
import { estAdresseTechnique } from "@/lib/abonnements/sans-email";

/** Ce que la route lit en base pour un paiement. */
export interface DonneesRecu {
  /** transactions.reference_operateur (ET-MM-…) : numéro du reçu */
  reference: string;
  statut: string;
  methode: string;
  montantFcfa: number;
  /** transactions.date_transaction (ISO) */
  dateTransaction: string;
  metadata: Record<string, unknown> | null;
  /** abonnements.date_debut / date_fin (YYYY-MM-DD, date_fin = dernier jour d'accès) */
  abonnement: { dateDebut: string; dateFin: string } | null;
  abonne: { nom: string | null; telephone: string | null; email: string | null };
}

export interface LigneRecu {
  libelle: string;
  valeur: string;
  /** true = référence, affichée en chasse fixe */
  code?: boolean;
}

/** Tout le texte du reçu, prêt à dessiner. */
export interface Recu {
  numero: string;
  date: string;
  montant: string;
  moyen: string;
  niveau: Palier;
  duree: string;
  periode: string | null;
  mention: string | null;
  lignes: LigneRecu[];
  note: string[];
  nomFichier: string;
}

export type RefusRecu = "STATUT" | "SOURCE" | "OPERATEUR" | "FORMULE";

/** Message montré à l'admin quand un paiement n'a pas de reçu. */
export const MESSAGES_REFUS: Record<RefusRecu, string> = {
  STATUT: "Ce paiement n'est pas validé : pas de reçu.",
  SOURCE: "Reçu disponible seulement pour les paiements enregistrés avec « Activer un paiement Orange Money / Wave ».",
  OPERATEUR: "Reçu disponible seulement pour Orange Money et Wave.",
  FORMULE: "Formule payée inconnue pour ce paiement : pas de reçu.",
};

const UTC = { timeZone: "UTC" } as const;

/** « 42 500 » (espace insécable : le montant ne se coupe jamais). */
export function montantLisible(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** « 10 novembre 2026 » (date UTC = heure d'Abidjan). */
function dateLongue(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", ...UTC });
}

/** Jour (YYYY-MM-DD) lu en UTC, pour ne jamais glisser d'un jour. */
function jour(ymd: string): Date {
  return new Date(`${ymd.slice(0, 10)}T00:00:00Z`);
}

/**
 * « Du mercredi 11 au mardi 17 novembre 2026 inclus ». Le mois (et l'année)
 * du début ne sont écrits que s'ils diffèrent de ceux de la fin.
 */
export function periodeLisible(dateDebut: string, dateFin: string): string {
  const d = jour(dateDebut);
  const f = jour(dateFin);
  const memeAnnee = d.getUTCFullYear() === f.getUTCFullYear();
  const memeMois = memeAnnee && d.getUTCMonth() === f.getUTCMonth();
  const debut = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    ...(memeMois ? {} : { month: "long" }),
    ...(memeAnnee ? {} : { year: "numeric" }),
    ...UTC,
  });
  const fin = f.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", ...UTC });
  return `Du ${debut} au ${fin} inclus`;
}

/** « Prolongé jusqu'au mardi 17 décembre 2026 inclus » (abonné encore actif qui repaie). */
export function prolongationLisible(dateFin: string): string {
  const f = jour(dateFin).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", ...UTC });
  return `Prolongé jusqu'au ${f} inclus`;
}

/** « Elite » pour ELITE. */
function titre(palier: Palier): string {
  return palier.charAt(0) + palier.slice(1).toLowerCase();
}

function texte(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** « Pare Yancinthe » → « Pare-Yancinthe » (sans accents ni caractères spéciaux). */
function segmentFichier(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function construireRecu(d: DonneesRecu): Recu | { erreur: RefusRecu } {
  if (d.statut !== "SUCCES") return { erreur: "STATUT" };
  if (d.metadata?.source !== "admin_mobile_money") return { erreur: "SOURCE" };
  if (d.methode !== "ORANGE_MONEY" && d.methode !== "WAVE") return { erreur: "OPERATEUR" };
  const formule = texte(d.metadata?.formule);
  const plan = PLAN_CONFIG.find((p) => p.id === formule);
  const palierPaye = formule ? palierDeFormule(formule) : null;
  if (!plan || !palierPaye) return { erreur: "FORMULE" };

  const operateur = OPERATEURS[d.methode as Operateur];
  const accorde = palierDeFormule(String(d.metadata?.niveau_accorde ?? "").toLowerCase());
  const niveau = accorde ?? palierPaye;
  const pays = PAYS_MOBILE_MONEY.find((p) => p.code === d.metadata?.pays)?.nom ?? null;
  const prolongation = d.metadata?.prolongation === true;

  const periode = d.abonnement
    ? prolongation
      ? prolongationLisible(d.abonnement.dateFin)
      : periodeLisible(d.abonnement.dateDebut, d.abonnement.dateFin)
    : null;

  const lignes: LigneRecu[] = [];
  const nom = texte(d.abonne.nom);
  const telephone = texte(d.abonne.telephone);
  const referencePaiement = texte(d.metadata?.reference_paiement);
  if (nom) lignes.push({ libelle: "Abonné", valeur: nom });
  if (telephone) lignes.push({ libelle: "Téléphone", valeur: telephone });
  lignes.push({ libelle: "Formule payée", valeur: `${plan.nom} · ${plan.duree_jours} jours` });
  if (referencePaiement) lignes.push({ libelle: `Référence ${operateur}`, valeur: referencePaiement, code: true });

  // Abonné sans e-mail (adresse technique) : suivi sur WhatsApp. Sinon : le site.
  const note = estAdresseTechnique(d.abonne.email)
    ? ["Chaque jour, votre pronostic vous est envoyé sur WhatsApp,", "avant le départ de la course."]
    : ["Chaque jour, votre pronostic vous attend sur elite-turf.fr,", "avant le départ de la course."];

  const jourPaiement = d.dateTransaction.slice(0, 10);
  return {
    numero: d.reference,
    date: dateLongue(d.dateTransaction),
    montant: montantLisible(d.montantFcfa),
    moyen: pays ? `${operateur} · ${pays}` : operateur,
    niveau,
    duree: `${plan.duree_jours} jours`,
    periode,
    mention: accorde && accorde !== palierPaye ? `Offert : l'offre ${titre(accorde)} à la place du ${plan.nom} payé.` : null,
    lignes,
    note,
    nomFichier: `Recu-Elite-Turf-${(nom && segmentFichier(nom)) || "abonne"}-${jourPaiement}.jpg`,
  };
}
