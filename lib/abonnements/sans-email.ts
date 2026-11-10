/**
 * Abonnés sans e-mail (abonnés WhatsApp, Afrique) — règles PURES.
 *
 * Beaucoup d'abonnés qui paient par Orange Money / Wave n'ont pas d'e-mail.
 * Steph les inscrit depuis /admin/utilisateurs (carte « Inscrire un abonné sans
 * e-mail », route POST /api/admin/abonnes/inscrire-sans-email) avec une adresse
 * TECHNIQUE, puis active leur paiement avec le formulaire habituel. Décisions de
 * Steph du 10/11/2026 :
 *   - adresse générée `prenom.nom@elite-turf.fr` (homonyme → `prenom.nom2@`…),
 *     non modifiable ;
 *   - AUCUN e-mail automatique vers ces adresses (bienvenue J1/J3/J7, rappel
 *     d'expiration, « Notifier », newsletter, confirmation d'abonnement) :
 *     Steph suit ces abonnés sur WhatsApp.
 *
 * `estAdresseTechnique` est la seule règle qui reconnaît ces comptes : elle
 * couvre aussi le premier abonné inscrit à la main le 10/11, sans migration.
 */

export const DOMAINE_ADRESSE_TECHNIQUE = "elite-turf.fr";

/**
 * Un morceau d'adresse : minuscules, sans accents, apostrophes supprimées,
 * espaces/tirets/autres signes → « - ». « Jean Baptiste » → « jean-baptiste ».
 */
export function segmentAdresse(texte: string): string {
  return texte
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`ʼ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * `prenom.nom@elite-turf.fr` (rang 1), `prenom.nom2@…` (rang 2)…
 * Prénom ET nom obligatoires : l'adresse contient toujours un point, elle ne
 * peut donc jamais être `contact@`, `support@` ou une autre adresse de service.
 */
export function adresseTechnique(prenom: string, nom: string, rang = 1): string | null {
  const p = segmentAdresse(prenom);
  const n = segmentAdresse(nom);
  if (!p || !n) return null;
  return `${p}.${n}${rang > 1 ? rang : ""}@${DOMAINE_ADRESSE_TECHNIQUE}`;
}

/** Au moins un point dans la partie locale, domaine elite-turf.fr exactement. */
const RE_ADRESSE_TECHNIQUE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+@elite-turf\.fr$/;

/** Adresse technique d'un abonné sans e-mail : aucun e-mail ne doit y partir. */
export function estAdresseTechnique(email: string | null | undefined): boolean {
  return typeof email === "string" && RE_ADRESSE_TECHNIQUE.test(email.trim().toLowerCase());
}

/** Plus petit rang dont l'adresse n'est pas déjà prise (casse ignorée). */
export function premierRangLibre(prenom: string, nom: string, prises: readonly string[]): number {
  const deja = new Set(prises.map((e) => e.trim().toLowerCase()));
  let rang = 1;
  while (deja.has(adresseTechnique(prenom, nom, rang) ?? "")) rang++;
  return rang;
}

/**
 * Numéro au format international : « +226 70 00 00 01 » ou « 00226… » →
 * « +22670000001 ». Sans indicatif (+ ou 00), ou hors 10–15 chiffres : null.
 */
export function telephoneInternational(saisie: string): string | null {
  const texte = saisie.trim();
  const chiffres = texte.replace(/\D/g, "");
  let numero: string;
  if (texte.startsWith("+")) numero = chiffres;
  else if (chiffres.startsWith("00")) numero = chiffres.slice(2);
  else return null;
  if (numero.length < 10 || numero.length > 15) return null;
  return `+${numero}`;
}

/**
 * Même numéro, quel que soit le format enregistré (« +226 70… », « 0022670… »,
 * « 70 00… ») : les 8 derniers chiffres sont identiques.
 */
export function memeNumero(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = (a ?? "").replace(/\D/g, "");
  const cb = (b ?? "").replace(/\D/g, "");
  if (ca.length < 8 || cb.length < 8) return false;
  return ca.slice(-8) === cb.slice(-8);
}
