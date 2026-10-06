/**
 * E-mail de confirmation d'abonnement envoyé à la main + sa trace dans
 * `email_sent_log` — partagé par le bouton « ✉ Confirmation »
 * (/api/admin/renvoyer-confirmation) et le bouton « Activer » Orange Money /
 * Wave (/api/admin/abonnements/activer-mobile-money). Même e-mail qu'un
 * paiement automatique (template confirmation-pack, « mode d'emploi » compris).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmailDetailed } from "@/lib/email";
import { templateConfirmationPack } from "@/lib/email/templates/confirmation-pack";

/**
 * Type journalisé dans `email_sent_log`. Distinct des types des crons
 * (WELCOME_*, LEAD_*) pour que l'historique reste lisible : on voit d'un coup
 * d'œil ce qui a été envoyé à la main et ce qui est parti tout seul.
 */
export const TYPE_JOURNAL_CONFIRMATION = "CONFIRMATION_ABONNEMENT";

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

  /**
   * JOURNALISATION — ajoutée le 29/08/2026.
   *
   * La route d'origine envoyait sans laisser AUCUNE trace : impossible de
   * savoir qui avait reçu sa confirmation.
   *
   * 🔴 UPSERT et non INSERT : `email_sent_log` porte UNIQUE(email, type) ET
   * UNIQUE(user_id, type) — des garde-fous d'idempotence conçus pour des crons
   * « une fois et jamais plus ». Un INSERT ferait donc échouer tout SECOND
   * envoi, alors que renvoyer est précisément le but. On conserve une ligne par
   * (utilisateur, type), portant le DERNIER envoi. Ne pas relâcher ces
   * contraintes : les crons welcome et lead-sequence s'en servent.
   *
   * L'échec de journalisation n'annule PAS l'envoi : l'e-mail est parti, le
   * dire serait plus faux que de perdre une ligne de journal. Il est remonté à
   * l'appelant, qui l'affiche.
   */
  const { error: logErr } = await admin
    .from("email_sent_log")
    .upsert(
      {
        user_id: d.id,
        email:   d.email,
        type:    TYPE_JOURNAL_CONFIRMATION,
        status:  envoi.ok ? "SENT" : "FAILED",
        error:   envoi.error ?? null,
        sent_at: new Date().toISOString(),
      },
      { onConflict: "user_id,type" },
    );

  return {
    ok: envoi.ok,
    erreur: envoi.error,
    subject,
    planNom,
    journalise: !logErr,
    ...(logErr ? { erreurJournal: logErr.message } : {}),
  };
}
