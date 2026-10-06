import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";
import { resolvePlanUuid } from "@/lib/plans/resolve";
import {
  palierDeFormule,
  calculerPeriode,
  avertissements,
  formuleDeTransaction,
  estPaiementCarte,
} from "@/lib/paiement/activation-mobile-money";
import { envoyerConfirmationAbonnement } from "@/lib/abonnements/confirmation";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

function redirect(path: string) {
  return NextResponse.redirect(`${APP_URL}${path}`, { status: 302 });
}

const erreur = (code: string) => redirect(`/admin/paiements?error=${code}`);

/**
 * POST /api/admin/paiements/valider — bouton « ✓ Valider » de /admin/paiements.
 *
 * Valide un paiement Mobile Money resté EN_ATTENTE (ancien circuit Paystack)
 * dont l'argent a bien été reçu. Les nouveaux paiements Orange Money / Wave
 * passent par le bouton « Activer » de /admin/utilisateurs (PR #370).
 *
 * Corrigé le 06/10/2026 (GO de Steph) : la formule était lue par
 * `transactions.abonnement_id`, qu'aucune route d'initiation n'écrit — toujours
 * null —, donc « PRO, 30 jours » était appliqué à TOUT paiement (un Starter
 * validé devenait 30 jours de Pro, e-mail « Pro » compris). Désormais :
 *   - formule = celle enregistrée avec le paiement (`metadata.plan_id`) ;
 *     inconnue → refus, on ne devine pas ;
 *   - mêmes règles que le bouton « Activer » (lib/paiement/activation-mobile-money.ts) :
 *     abonné encore actif → jours ajoutés après sa date de fin ; refus si
 *     paiement par carte, renouvellement par carte en cours, accès permanent ;
 *   - la transaction est RÉSERVÉE (EN_ATTENTE → SUCCES, mise à jour
 *     conditionnelle) avant l'activation : un double clic ne valide pas deux
 *     fois. Si l'activation du profil échoue, elle repasse EN_ATTENTE et
 *     l'admin peut réessayer (avant : SUCCES écrit d'abord, réessai bloqué) ;
 *   - e-mail de confirmation journalisé (lib/abonnements/confirmation.ts).
 */
export async function POST(req: NextRequest) {
  // ── Auth admin ──────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/connexion?redirect=/admin/paiements");

  const admin = createServiceClient();
  const { data: adminProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!adminProfile || adminProfile.role !== "ADMIN") return redirect("/");

  // ── Transaction ─────────────────────────────────────────────────────────
  const formData = await req.formData();
  const txId = formData.get("id") as string | null;
  if (!txId) return erreur("id_manquant");

  const { data: tx, error: txErr } = await admin
    .from("transactions")
    .select("id, user_id, statut, methode, reference_operateur, metadata")
    .eq("id", txId)
    .single();
  if (txErr || !tx) {
    console.error("[Valider] Transaction introuvable:", txErr?.message);
    return erreur("transaction_introuvable");
  }
  if (tx.statut === "SUCCES") return erreur("deja_valide");
  if (tx.statut !== "EN_ATTENTE") return erreur("statut_invalide");
  if (estPaiementCarte(tx)) return erreur("paiement_carte");

  const formule = formuleDeTransaction(tx.metadata);
  const plan = formule ? PLAN_CONFIG.find((p) => p.id === formule) : undefined;
  const palier = formule ? palierDeFormule(formule) : null;
  if (!plan || !palier) return erreur("formule_inconnue");

  // ── Abonné ──────────────────────────────────────────────────────────────
  const { data: profil, error: errProfil } = await admin
    .from("profiles")
    .select("id, email, nom_complet, statut_abonnement, date_expiration_abonnement")
    .eq("id", tx.user_id)
    .single();
  if (errProfil || !profil) return erreur("membre_introuvable");

  const { data: aboCarte, error: errCarte } = await admin
    .from("abonnements")
    .select("id")
    .eq("user_id", profil.id)
    .eq("statut", "ACTIF")
    .eq("auto_renouvellement", true)
    .not("stripe_subscription_id", "is", null)
    .limit(1);
  if (errCarte) return erreur("erreur_controle");
  if (aboCarte && aboCarte.length > 0) return erreur("renouvellement_carte");

  const maintenant = new Date();
  const etat = { statut: profil.statut_abonnement ?? null, expiration: profil.date_expiration_abonnement ?? null };
  const periode = calculerPeriode(etat, plan.duree_jours, maintenant);
  if ("erreur" in periode) return erreur("acces_permanent");
  // « Valider » agit en un clic, sans aperçu : pas de passage silencieux à une
  // formule inférieure pour un abonné encore actif. « Activer » (Gérer les
  // membres) affiche l'avertissement et laisse l'admin décider.
  if (avertissements(etat, palier, maintenant).length > 0) return erreur("retrogradation");

  const planUuid = await resolvePlanUuid(plan);
  if (!planUuid) return erreur("formule_absente_en_base");

  // ── Réservation : EN_ATTENTE → SUCCES, seulement si personne ne l'a fait ─
  const { data: reservee, error: errReserve } = await admin
    .from("transactions")
    .update({ statut: "SUCCES" })
    .eq("id", txId)
    .eq("statut", "EN_ATTENTE")
    .select("id");
  if (errReserve) {
    console.error("[Valider] Erreur update transaction:", errReserve.message);
    return erreur("erreur_transaction");
  }
  if (!reservee || reservee.length === 0) return erreur("deja_valide");

  // ── 1. Le profil (l'accès) ──────────────────────────────────────────────
  const { error: errAcces } = await admin
    .from("profiles")
    .update({
      statut_abonnement:          palier,
      date_expiration_abonnement: periode.fin,
      date_debut_abonnement:      periode.debut,
      plan_id:                    plan.id,
    })
    .eq("id", profil.id);
  if (errAcces) {
    console.error("[Valider] Activation du profil impossible:", errAcces.message);
    // Rien n'est activé : la transaction redevient validable… si ce retour
    // arrière réussit. Sinon elle reste « Validé » sans accès ouvert, et le
    // bouton disparaît : il faut le dire, pas annoncer un réessai possible.
    const { error: errRetour } = await admin
      .from("transactions")
      .update({ statut: "EN_ATTENTE" })
      .eq("id", txId)
      .eq("statut", "SUCCES");
    if (errRetour) {
      console.error(
        `[Valider] INCOHÉRENCE : transaction ${txId} SUCCES, profil ${profil.id} NON activé :`,
        errRetour.message,
      );
      return erreur("incoherence_activation");
    }
    return erreur("erreur_activation");
  }

  // ── 2. La ligne `abonnements` (lue par le cron d'expiration) ────────────
  // Anciennes lignes ACTIF clôturées AVANT l'insertion : cf. le bouton
  // « Activer » (/api/admin/abonnements/activer-mobile-money).
  const { error: errCloture } = await admin
    .from("abonnements")
    .update({ statut: "EXPIRE" })
    .eq("user_id", profil.id)
    .eq("statut", "ACTIF");
  const { data: abonnement, error: errAbo } = await admin
    .from("abonnements")
    .insert({
      user_id:             profil.id,
      plan_id:             planUuid,
      date_debut:          periode.debut.slice(0, 10),
      date_fin:            periode.fin.slice(0, 10),
      statut:              "ACTIF",
      auto_renouvellement: false,
      transaction_id:      txId,
    })
    .select("id")
    .single();
  if (abonnement?.id) {
    await admin.from("transactions").update({ abonnement_id: abonnement.id }).eq("id", txId);
  }
  if (errCloture || errAbo) {
    console.error("[Valider] Ligne abonnements:", errCloture?.message, errAbo?.message);
  }

  // ── 3. L'e-mail de confirmation (journalisé) ────────────────────────────
  const envoi = await envoyerConfirmationAbonnement(admin, {
    id:         profil.id,
    email:      profil.email,
    nomComplet: profil.nom_complet ?? null,
    palier,
    expiration: periode.fin,
  });

  console.log(
    `[Valider] ✓ Transaction ${txId} validée → user ${profil.id} → ${palier} jusqu'au ${periode.fin}` +
      (periode.prolongation ? " (prolongation)" : ""),
  );

  const params = new URLSearchParams({ success: palier, expire: periode.fin.slice(0, 10) });
  if (periode.prolongation) params.set("prolonge", "1");
  if (!envoi.ok) params.set("email", "echec");
  if (errAbo) params.set("abonnement", errCloture ? "echec_risque" : "echec");
  return redirect(`/admin/paiements?${params.toString()}`);
}
