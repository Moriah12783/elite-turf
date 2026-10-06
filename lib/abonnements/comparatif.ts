/**
 * Fiches « à cases » des formules (demande de Steph du 01/10/2026) : Free,
 * Starter, Pro et Elite listent les MÊMES lignes, cochées ou non, pour se
 * comparer d'un coup d'œil. Utilisé par /abonnements et la section tarifs de
 * l'accueil.
 *
 * Offre (décisions de Steph du 06/10/2026) :
 *   - Starter, Pro et Elite : le pronostic expert du jour en 6 chevaux. Son
 *     public africain préfère 6 chevaux à 8 (le PRO publié ce jour-là en
 *     comptait 8, que la fiche a brièvement annoncés : PR #375) ;
 *   - Elite en plus : le PLAN DE JEU = ce qui est publié au niveau ELITE —
 *     6 chevaux, la base de 3 pour le champ réduit ou total, et les values.
 * Starter accède au niveau PRO (lib/auth/access.ts) : Starter = Pro sur 7 jours.
 *
 * Du 02/10 au 06/10/2026, les fiches annonçaient un plan de jeu Elite en
 * 8 chevaux avec le couplé et les associés. Jamais publié sous cette forme :
 * aucun couplé ni associé coché. Ne les remettre qu'une fois publiés
 * (garde-fou dans comparatif.test.ts).
 *
 * PUR, ES5-safe, testé.
 */

export type IdFormule = "free" | "starter" | "pro" | "elite";

/** true = inclus · false = non inclus · texte = inclus, avec une précision. */
export type Case = boolean | string;

export interface LigneFiche {
  id: string;
  libelle: string;
  detail: string;
  cases: Record<IdFormule, Case>;
}

export interface GroupeFiche {
  titre: string;
  lignes: LigneFiche[];
}

/** Accroche de chaque fiche, sous le nom de la formule. */
export const ACCROCHES: Record<IdFormule, string> = {
  free: "Accès gratuit permanent",
  starter: "Le galop d'essai",
  pro: "Le mois complet",
  elite: "Le plan de jeu en plus",
};

const POUR_TOUS: Record<IdFormule, Case> = { free: true, starter: true, pro: true, elite: true };
const ABONNES: Record<IdFormule, Case> = { free: false, starter: true, pro: true, elite: true };

/**
 * @param offreEliteJusquau fin de l'offre « Starter = accès Elite » en toutes
 *   lettres (« 27 août ») quand elle court, sinon null.
 */
export function fichesFormules(offreEliteJusquau: string | null = null): GroupeFiche[] {
  return [
    {
      titre: "Chaque jour",
      lignes: [
        {
          id: "selection-stats",
          libelle: "La Sélection stats",
          detail: "Notre lecture statistique de chaque course du programme",
          cases: POUR_TOUS,
        },
        {
          id: "pronostic-expert",
          libelle: "Le pronostic expert du jour",
          detail: "Tiercé, Quarté+, Quinté+ : 6 chevaux classés par confiance, avec l'analyse",
          cases: ABONNES,
        },
        {
          id: "plan-de-jeu-elite",
          libelle: "Le plan de jeu Elite",
          detail: "6 chevaux : la base de 3 pour le champ réduit ou total, et les values",
          cases: {
            free: false,
            starter: offreEliteJusquau ? `Offert jusqu'au ${offreEliteJusquau}` : false,
            pro: false,
            elite: true,
          },
        },
      ],
    },
    {
      titre: "Vos garanties",
      lignes: [
        {
          id: "resultats-publics",
          libelle: "Tous nos résultats publiés",
          detail: "Les bons comme les moins bons, course par course",
          cases: POUR_TOUS,
        },
        {
          id: "garantie-premier-pronostic",
          libelle: "1er pronostic perdant : 7 jours offerts",
          detail: "Votre accès est prolongé d'une semaine",
          cases: ABONNES,
        },
        {
          id: "sans-engagement",
          libelle: "Sans engagement",
          detail: "Rien n'est reconduit sans votre accord",
          cases: POUR_TOUS,
        },
      ],
    },
  ];
}

/** 152 € sur 30 jours → « 5,07 € par jour ». */
export function prixParJour(prixEur: number, dureeJours: number): string {
  if (!(dureeJours > 0)) return "";
  const euros = (Math.round((prixEur / dureeJours) * 100) / 100).toFixed(2).replace(".", ",");
  return `${euros} € par jour`;
}
