/**
 * lib/payments/activate-core.ts
 *
 * Cœur d'activation d'abonnement, AGNOSTIQUE du provider (Paystack, CinetPay…).
 *
 * Travaille sur la ligne `transactions` créée à l'initiation, repérée par
 * `reference_operateur`. Idempotent : si la transaction est déjà `SUCCES`, ne
 * refait rien. Crée l'abonnement, met à jour le profil, marque la transaction,
 * envoie l'email de confirmation.
 *
 * NB : `lib/paystack/activate.ts` garde pour l'instant sa propre copie (chemin
 * de revenu en prod — on n'y touche pas). TODO : migrer Paystack vers ce cœur
 * partagé une fois CinetPay éprouvé (DRY).
 */
import { createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";
import { sendEmail } from "@/lib/email";
import { templateConfirmationPaiement } from "@/lib/email/templates/confirmation-paiement";

export type ActivationOutcome =
  | { ok: true; alreadyActivated: boolean; abonnementId: string | null }
  | { ok: false; reason: string };

/** Valeurs acceptées par la contrainte CHECK `transactions.methode`. */
export type Methode = "ORANGE_MONEY" | "MTN_MOMO" | "WAVE" | "STRIPE";

export async function activateSubscriptionCore(params: {
  reference: string;
  methode: Methode;
  paidAt?: string | null;
  providerMeta?: Record<string, unknown>;
}): Promise<ActivationOutcome> {
  const { reference, methode, paidAt, providerMeta } = params;
  const supabase = createServiceClient();

  const { data: transaction } = await supabase
    .from("transactions")
    .select("*")
    .eq("reference_operateur", reference)
    .single();

  if (!transaction) {
    return { ok: false, reason: `Transaction introuvable pour reference ${reference}` };
  }

  // Idempotence : déjà activé
  if (transaction.statut === "SUCCES") {
    return { ok: true, alreadyActivated: true, abonnementId: transaction.abonnement_id ?? null };
  }

  const metadata = transaction.metadata as { plan_id?: string } | null;
  const plan = PLAN_CONFIG.find((p) => p.id === metadata?.plan_id);
  if (!plan) {
    return { ok: false, reason: `Plan introuvable: ${metadata?.plan_id}` };
  }

  const userId: string = transaction.user_id;
  const now = new Date();
  const dateDebut = now.toISOString();
  const dateFin = new Date(now.getTime() + plan.duree_jours * 24 * 60 * 60 * 1000).toISOString();

  const statutAbonnement: "STARTER" | "PRO" | "ELITE" = plan.acces_elite
    ? "ELITE"
    : plan.id === "starter"
      ? "STARTER"
      : "PRO";

  // 1. Désactiver les anciens abonnements actifs
  await supabase
    .from("abonnements")
    .update({ statut: "EXPIRE" })
    .eq("user_id", userId)
    .eq("statut", "ACTIF");

  // 2. Créer le nouvel abonnement
  const { data: newAbonnement, error: abErr } = await supabase
    .from("abonnements")
    .insert({
      user_id: userId,
      plan_id: plan.id,
      date_debut: dateDebut,
      date_fin: dateFin,
      statut: "ACTIF",
      auto_renouvellement: false,
    })
    .select()
    .single();

  if (abErr) {
    return { ok: false, reason: `Insert abonnement: ${abErr.message}` };
  }

  // 3. Mettre à jour le profil
  await supabase
    .from("profiles")
    .update({
      statut_abonnement: statutAbonnement,
      date_expiration_abonnement: dateFin,
      plan_id: plan.id,
      date_debut_abonnement: dateDebut,
    })
    .eq("id", userId);

  // 4. Marquer la transaction comme réussie + enrichir metadata provider
  await supabase
    .from("transactions")
    .update({
      statut: "SUCCES",
      methode,
      abonnement_id: newAbonnement?.id,
      date_transaction: paidAt ?? now.toISOString(),
      metadata: { ...(transaction.metadata as Record<string, unknown> | null), ...(providerMeta ?? {}) },
    })
    .eq("reference_operateur", reference);

  console.log(
    `[activate-core] Abonnement ${plan.nom} activé pour ${userId} jusqu'au ${dateFin} (methode=${methode})`,
  );

  // 5. Email de confirmation (best-effort — non bloquant)
  try {
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email;
    const { data: profile } = await supabase
      .from("profiles")
      .select("nom_complet")
      .eq("id", userId)
      .single();

    if (userEmail) {
      const { subject, html } = templateConfirmationPaiement({
        nomComplet: (profile?.nom_complet as string) || "Champion",
        email: userEmail,
        planNom: plan.nom,
        montantEur: plan.prix_eur,
        dateDebut,
        dateFin,
        statutAbonnement,
      });
      await sendEmail({ to: userEmail, subject, html });
    }
  } catch (emailErr) {
    console.error("[activate-core] Email confirmation échoué (non bloquant):", emailErr);
  }

  return { ok: true, alreadyActivated: false, abonnementId: newAbonnement?.id ?? null };
}
