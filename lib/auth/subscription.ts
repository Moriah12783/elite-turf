import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Garde-fou « date_fin » : statut d'abonnement EFFECTIF, indépendant du cron.
 *
 * L'accès premium est gaté sur `profiles.statut_abonnement` (champ stocké). Si
 * le cron nocturne `expire-abonnements` n'a pas (encore) basculé un profil
 * expiré — ou si le profil a été mis à jour sans ligne `abonnements` ACTIF
 * correspondante (grant manuel / webhook) — l'utilisateur garderait son accès
 * premium au-delà de sa date de fin.
 * (Cas observé en prod le 2026-06-04 : 1 profil PRO expiré depuis le 30/04,
 * toujours marqué "PRO" → ~35 j de PRO gratuit.)
 *
 * Règle : un statut premium (STARTER/PRO/ELITE) dont la date d'expiration est
 * passée (<= maintenant) est traité comme "EXPIRE". Une date NULLE = pas
 * d'expiration connue (grant à vie / offert) → on conserve le statut.
 *
 * @param statutAbonnement  profiles.statut_abonnement
 * @param dateExpiration    profiles.date_expiration_abonnement (ISO ou null)
 * @param now               ISO courant (injectable pour les tests)
 */
export function effectiveSubscription(
  statutAbonnement: string | null | undefined,
  dateExpiration: string | null | undefined,
  now: string = new Date().toISOString(),
): string {
  const statut = statutAbonnement || "GRATUIT";
  if (statut === "GRATUIT" || statut === "EXPIRE") return statut;
  if (dateExpiration && dateExpiration <= now) return "EXPIRE";
  return statut;
}

/**
 * Source UNIQUE pour récupérer le statut d'abonnement effectif d'un utilisateur
 * (profil + garde-fou date_fin). À utiliser partout où l'on gate du premium,
 * plutôt que de lire `statut_abonnement` brut.
 */
export async function resolveUserSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("statut_abonnement, date_expiration_abonnement")
    .eq("id", userId)
    .single();
  return effectiveSubscription(
    data?.statut_abonnement,
    data?.date_expiration_abonnement,
  );
}
