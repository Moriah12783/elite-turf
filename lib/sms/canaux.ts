/**
 * lib/sms/canaux.ts
 *
 * Politique d'envoi SMS — SOURCE UNIQUE. Chaque canal est explicitement
 * autorisé ou non, en un seul endroit consultable d'un coup d'œil.
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * Décision du porteur (04/08/2026) : ne plus envoyer de SMS À PART l'alerte
 * de publication aux abonnés PAYANTS. Le relevé du jour montrait l'exact
 * inverse — sur sept jours, `sms_log` ne contenait que des `WELCOME`,
 * `SEQUENCE_J2` et `SEQUENCE_J5`, tous vers des NON-abonnés, et pas une seule
 * alerte vers un abonné payant.
 *
 * FERMÉ PAR DÉFAUT. Un drapeau absent vaut « désactivé ». Un déploiement
 * suffit donc à couper un canal : il n'y a rien à configurer côté Cloudflare,
 * et un oubli de variable ne peut pas rouvrir un canal par accident. C'est le
 * sens de la comparaison stricte à "true".
 *
 * PUR (aucune E/S), testé.
 */

export type CanalSms =
  /** Alerte quotidienne « vos analyses du jour sont disponibles » — abonnés PAYANTS. */
  | "ALERTE_JOUR"
  /** Séquence de nurturing J2/J5 vers les inscrits NON abonnés. */
  | "SEQUENCE"
  /** SMS de bienvenue à l'inscription. */
  | "BIENVENUE";

/** Variable d'environnement qui autorise chaque canal. */
const DRAPEAU: Record<CanalSms, string> = {
  ALERTE_JOUR: "SMS_ALERTE_JOUR_ENABLED",
  SEQUENCE:    "SMS_SEQUENCE_ENABLED",
  BIENVENUE:   "SMS_WELCOME_ENABLED",
};

/** Nom de la variable à poser pour rouvrir un canal — utile dans les messages. */
export function drapeauDe(canal: CanalSms): string {
  return DRAPEAU[canal];
}

/**
 * Ce canal a-t-il le droit d'envoyer ?
 *
 * `env` est injectable pour les tests ; en production c'est `process.env`.
 */
export function canalSmsActif(
  canal: CanalSms,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[DRAPEAU[canal]] === "true";
}
