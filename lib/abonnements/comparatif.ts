/**
 * Fiches « à cases » des formules (demande de Steph du 01/10/2026) : Free,
 * Starter, Pro et Elite listent les MÊMES lignes, cochées ou non, pour se
 * comparer d'un coup d'œil. Utilisé par /abonnements et la section tarifs de
 * l'accueil.
 *
 * Contenu = l'offre RÉELLE au 01/10/2026, vérifiée en base sur 15 jours :
 * chaque jour, 1 pronostic PRO (le Quinté+, 8 chevaux classés, analyse) et
 * 1 pronostic ELITE (le Quinté+, 6 chevaux, analyse). Starter accède au
 * niveau PRO (lib/auth/access.ts) : Starter = Pro sur 7 jours.
 *
 * À NE PAS ANNONCER AVANT LIVRAISON (décision de Steph du 01/10/2026) :
 *   - passage de Starter et Pro à 6 chevaux (date à fixer par Steph) ;
 *   - plan de jeu Elite : 8 chevaux, couplé en 2 chevaux, base de 3 chevaux
 *     pour champ réduit ou total, values, associés.
 * Le test « rien d'annoncé avant livraison » garde cette règle.
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
  elite: "Le pronostic Elite en plus",
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
          detail: "Tiercé, Quarté+, Quinté+ : 8 chevaux classés par confiance, avec l'analyse",
          cases: ABONNES,
        },
        {
          id: "pronostic-elite",
          libelle: "Le pronostic Elite",
          detail: "Une sélection resserrée en 6 chevaux, avec l'analyse",
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
