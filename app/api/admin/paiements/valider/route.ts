import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { templateConfirmationPack } from "@/lib/email/templates/confirmation-pack";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

function redirect(path: string) {
  return NextResponse.redirect(`${APP_URL}${path}`, { status: 302 });
}

/**
 * POST /api/admin/paiements/valider
 * Valide un paiement EN_ATTENTE :
 *  1. Transaction → SUCCES
 *  2. Abonnement  → ACTIF + dates recalculées
 *  3. Profile     → statut_abonnement PREMIUM ou VIP + date_expiration
 *  4. Email       → confirmation pack envoyée à l'abonné
 */
export async function POST(req: NextRequest) {
  // ── Auth admin ──────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/connexion?redirect=/admin/paiements");

  const admin = createServiceClient();
  const { data: adminProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "ADMIN") return redirect("/");

  // ── Récupérer l'ID transaction ───────────────────────────────────────────
  const formData = await req.formData();
  const txId = formData.get("id") as string | null;

  if (!txId) return redirect("/admin/paiements?error=id_manquant");

  // ── Récupérer la transaction (+ abonnement + plan) ───────────────────────
  const { data: tx, error: txErr } = await admin
    .from("transactions")
    .select(`
      id, user_id, statut, abonnement_id,
      abonnement:abonnement_id (
        id, plan_id,
        plan:plan_id (
          nom, duree_jours, acces_vip, acces_premium, nb_alertes
        )
      )
    `)
    .eq("id", txId)
    .single();

  if (txErr || !tx) {
    console.error("[Valider] Transaction introuvable:", txErr?.message);
    return redirect("/admin/paiements?error=transaction_introuvable");
  }

  if (tx.statut === "SUCCES") {
    return redirect("/admin/paiements?error=deja_valide");
  }

  // ── Récupérer le profil de l'abonné (email + nom) ───────────────────────
  const { data: memberProfile } = await admin
    .from("profiles")
    .select("email, nom_complet")
    .eq("id", tx.user_id)
    .single();

  // ── 1. Mettre la transaction à SUCCES ───────────────────────────────────
  const { error: txUpdateErr } = await admin
    .from("transactions")
    .update({ statut: "SUCCES" })
    .eq("id", txId);

  if (txUpdateErr) {
    console.error("[Valider] Erreur update transaction:", txUpdateErr.message);
    return redirect("/admin/paiements?error=erreur_transaction");
  }

  // ── 2. Mettre à jour l'abonnement ───────────────────────────────────────
  const abonnement    = tx.abonnement as any;
  const plan          = abonnement?.plan as any;
  const dureeJours: number = plan?.duree_jours ?? 30;
  const acces_vip: boolean = plan?.acces_vip    ?? false;
  const nbAlertes: number  = plan?.nb_alertes   ?? 5;
  const planNom: "Starter" | "Pro" | "Elite" =
    (["Starter", "Pro", "Elite"].includes(plan?.nom) ? plan.nom : "Pro") as "Starter" | "Pro" | "Elite";

  const dateDebut = new Date();
  const dateFin   = new Date(dateDebut);
  dateFin.setDate(dateFin.getDate() + dureeJours);

  const dateDebutISO = dateDebut.toISOString().split("T")[0];
  const dateFinISO   = dateFin.toISOString().split("T")[0];

  let abonnementId: string | null = tx.abonnement_id ?? null;

  if (abonnementId) {
    await admin
      .from("abonnements")
      .update({ statut: "ACTIF", date_debut: dateDebutISO, date_fin: dateFinISO })
      .eq("id", abonnementId);
  } else if (abonnement?.plan_id) {
    const { data: newAbo } = await admin
      .from("abonnements")
      .insert({
        user_id:             tx.user_id,
        plan_id:             abonnement.plan_id,
        date_debut:          dateDebutISO,
        date_fin:            dateFinISO,
        statut:              "ACTIF",
        auto_renouvellement: false,
        transaction_id:      txId,
      })
      .select("id")
      .single();

    abonnementId = newAbo?.id ?? null;

    if (abonnementId) {
      await admin
        .from("transactions")
        .update({ abonnement_id: abonnementId })
        .eq("id", txId);
    }
  }

  // ── 3. Mettre à jour le profil utilisateur ───────────────────────────────
  const statutAbonnement = acces_vip ? "VIP" : "PREMIUM";

  await admin
    .from("profiles")
    .update({
      statut_abonnement:          statutAbonnement,
      date_expiration_abonnement: dateFinISO,
    })
    .eq("id", tx.user_id);

  // ── 4. Envoyer l'email de confirmation à l'abonné ───────────────────────
  if (memberProfile?.email) {
    const { subject, html } = templateConfirmationPack({
      nomComplet:     memberProfile.nom_complet || memberProfile.email.split("@")[0],
      email:          memberProfile.email,
      planNom,
      dateExpiration: dateFinISO,
      nbAlertes:      nbAlertes === -1 ? 999 : nbAlertes,
    });

    await sendEmail({ to: memberProfile.email, subject, html });

    console.log(
      `[Valider] ✓ Email "${subject}" envoyé à ${memberProfile.email}`
    );
  }

  console.log(
    `[Valider] ✓ Transaction ${txId} validée → user ${tx.user_id} → ${statutAbonnement} jusqu'au ${dateFinISO}`
  );

  return redirect(`/admin/paiements?success=${statutAbonnement}&expire=${dateFinISO}`);
}
