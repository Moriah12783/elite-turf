/**
 * lib/http/requete-interne.ts
 *
 * Fabrique une requête destinée à un handler de route de CETTE application,
 * appelé EN PROCESSUS — sans passer par le réseau.
 *
 * ⚠️ POURQUOI CE MODULE EXISTE — NE PAS REVENIR À UN `fetch`
 * ----------------------------------------------------------
 * Un Worker Cloudflare ne peut pas s'appeler lui-même par son nom d'hôte
 * public : la sous-requête reboucle sur l'edge, qui détecte la boucle et
 * renvoie sa page « error code: 522 ».
 *
 * Ce n'est PAS un dépassement de délai, malgré ce que le code 522 laisse
 * croire : la réponse arrive en 126 à 653 ms, quand un vrai « connection
 * timed out » prendrait environ 90 secondes.
 *
 * Constaté du 27/07 au 02/08/2026 : 10 échecs, **0 succès**, sur les trois
 * seuls crons qui procédaient ainsi (`pronostic-gratuit`,
 * `ia-auto-publish-v2`, `ia-rapport-soir`). Tous les autres crons, qui font
 * leur travail en processus, réussissent — y compris `resultats-pronostics`
 * qui tourne 36 secondes. Les routes visées sont saines : interrogées depuis
 * l'extérieur, elles répondent 401 en 0,3 seconde.
 *
 * Conséquences concrètes de la panne : aucun pronostic gratuit publié pendant
 * six jours (le haut de l'entonnoir d'acquisition), et aucun brouillon IA
 * auto-publié.
 *
 * L'hôte `https://interne.invalid` n'est jamais résolu : il ne sert qu'à
 * satisfaire le constructeur d'URL. Aucune requête ne quitte le Worker.
 */

import { NextRequest } from "next/server";

const HOTE_FICTIF = "https://interne.invalid";

/**
 * Construit la requête à passer directement au handler.
 *
 * L'en-tête `Authorization: Bearer CRON_SECRET` est posé parce que
 * `requireAdminAuth` court-circuite sur ce jeton avant toute lecture de
 * cookie — un appel en processus n'a pas de session navigateur.
 */
export function requeteInterne(chemin: string, corps?: unknown): NextRequest {
  const entetes: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.CRON_SECRET || ""}`,
  };

  return new NextRequest(new URL(chemin, HOTE_FICTIF), {
    method: "POST",
    headers: entetes,
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
}

/**
 * Lit la réponse d'un handler appelé en processus.
 *
 * Les handlers renvoient toujours du JSON, mais on ne le suppose pas : une
 * route qui échoue peut renvoyer du texte, et c'est précisément ce qui rendait
 * l'ancien message d'erreur illisible (« Unexpected token 'e' … is not valid
 * JSON » — le corps était en réalité « error code: 522 »).
 */
export async function lireReponse(
  reponse: Response,
): Promise<{ ok: boolean; statut: number; donnees: any; texte?: string }> {
  const statut = reponse.status;
  const texte = await reponse.text();
  try {
    return { ok: reponse.ok, statut, donnees: JSON.parse(texte) };
  } catch {
    return { ok: reponse.ok, statut, donnees: null, texte: texte.slice(0, 300) };
  }
}
