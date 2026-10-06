/**
 * Journal des e-mails transactionnels envoyés — table `email_sent_log`.
 *
 * Pourquoi (06/10/2026) : l'e-mail de confirmation d'un paiement par CARTE
 * (lib/stripe/activate.ts) partait sans laisser de trace ; en cas d'échec, il
 * ne restait qu'un console.error. Impossible de savoir si un abonné Elite payé
 * par carte avait reçu sa confirmation. Même journal que les envois manuels
 * (lib/abonnements/confirmation.ts).
 *
 * 🔴 UPSERT sur (user_id, type), jamais INSERT : la table porte UNIQUE(user_id,
 * type) ET UNIQUE(email, type), garde-fous d'idempotence des crons « une fois
 * et jamais plus » (welcome, lead-sequence) — ne pas les relâcher. Un INSERT
 * ferait échouer tout second envoi du même type ; on garde une ligne par
 * (utilisateur, type), portant le DERNIER envoi.
 *
 * Ne lance JAMAIS d'exception : le journal ne doit ni bloquer une activation,
 * ni empêcher un envoi. L'erreur éventuelle est RENVOYÉE (null = journalisé).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Types distincts des crons (WELCOME_*, LEAD_*) : l'historique se lit d'un coup d'œil. */
export const TYPES_JOURNAL = {
  /** Envoi ou renvoi manuel : bouton « ✉ Confirmation », bouton « Activer », « Valider ». */
  CONFIRMATION_ABONNEMENT: "CONFIRMATION_ABONNEMENT",
  /** Activation automatique après un paiement par carte (Stripe). */
  CONFIRMATION_PAIEMENT_CARTE: "CONFIRMATION_PAIEMENT_CARTE",
  /** Renouvellement automatique par carte (facture Stripe payée). */
  CONFIRMATION_RENOUVELLEMENT_CARTE: "CONFIRMATION_RENOUVELLEMENT_CARTE",
} as const;

export type TypeJournal = (typeof TYPES_JOURNAL)[keyof typeof TYPES_JOURNAL];

export interface EntreeJournal {
  userId: string;
  email: string;
  type: TypeJournal;
  /** L'envoi a-t-il été accepté par le fournisseur d'e-mail ? */
  ok: boolean;
  erreur?: string | null;
}

export async function journaliserEmail(admin: SupabaseClient, e: EntreeJournal): Promise<string | null> {
  try {
    const { error } = await admin.from("email_sent_log").upsert(
      {
        user_id: e.userId,
        email:   e.email,
        type:    e.type,
        status:  e.ok ? "SENT" : "FAILED",
        error:   e.erreur ?? null,
        sent_at: new Date().toISOString(),
      },
      { onConflict: "user_id,type" },
    );
    return error ? error.message : null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
