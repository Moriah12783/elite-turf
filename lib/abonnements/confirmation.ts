/**
 * E-mail de confirmation d'abonnement envoyé à la main + sa trace dans
 * `email_sent_log` — partagé par le bouton « ✉ Confirmation »
 * (/api/admin/renvoyer-confirmation) et le bouton « Activer » Orange Money /
 * Wave (/api/admin/abonnements/activer-mobile-money). Même e-mail qu'un
 * paiement automatique (template confirmation-pack, « mode d'emploi » compris).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmailDetailed } from "@/lib/email";
import { journaliserEmail, TYPES_JOURNAL } from "@/lib/email/journal";
import { templateConfirmationPack } from "@/lib/email/templates/confirmation-pack";

/** Type journalisé dans `email_sent_log` pour les envois manuels (cf. lib/email/journal.ts). */
export const TYPE_JOURNAL_CONFIRMATION = TYPES_JOURNAL.CONFIRMATION_ABONNEMENT;

export type PalierPayant = "STARTER" | "PRO" | "ELITE";

/** Alertes du palier (-1 = illimitées). */
export function nbAlertes(palier: PalierPayant): number {
  return palier === "ELITE" ? -1 : palier === "PRO" ? 20 : 5;
}

export interface DestinataireConfirmation {
  id: string;
  email: string;
  nomComplet: string | null;
  palier: PalierPayant;
  /** Date de fin (ISO ou YYYY-MM-DD) : seule la partie date est affichée. */
  expiration: string;
}

export interface ResultatConfirmation {
  ok: boolean;
  erreur?: string;
  subject: string;
  planNom: "Starter" | "Pro" | "Elite";
  journalise: boolean;
  erreurJournal?: string;
}

export async function envoyerConfirmationAbonnement(
  admin: SupabaseClient,
  d: DestinataireConfirmation,
): Promise<ResultatConfirmation> {
  const planNom = d.palier === "ELITE" ? "Elite" : d.palier === "PRO" ? "Pro" : "Starter";

  const { subject, html } = templateConfirmationPack({
    nomComplet:     d.nomComplet || "Champion",
    email:          d.email,
    planNom,
    dateExpiration: String(d.expiration).slice(0, 10),
    nbAlertes:      nbAlertes(d.palier),
  });

  const envoi = await sendEmailDetailed({ to: d.email, subject, html });

  // JOURNALISATION (depuis le 29/08/2026) : upsert sur (user_id, type), jamais
  // d'exception — cf. lib/email/journal.ts. Un échec de journal n'annule PAS
  // l'envoi : il est remonté à l'appelant, qui l'affiche.
  const erreurJournal = await journaliserEmail(admin, {
    userId: d.id,
    email:  d.email,
    type:   TYPE_JOURNAL_CONFIRMATION,
    ok:     envoi.ok,
    erreur: envoi.error,
  });

  return {
    ok: envoi.ok,
    erreur: envoi.error,
    subject,
    planNom,
    journalise: !erreurJournal,
    ...(erreurJournal ? { erreurJournal } : {}),
  };
}
