import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { templateRappelExpiration } from "@/lib/email/templates/rappel-expiration";
import { PLAN_CONFIG } from "@/types";

/**
 * Cron job — Rappels d'expiration d'abonnement
 * Planifié : chaque jour à 09h00 UTC (11h heure de Paris)
 * Vercel Cron : "0 9 * * *"
 *
 * Sécurisé par CRON_SECRET — Vercel l'envoie dans le header Authorization.
 */
export async function GET(req: NextRequest) {
  // Vérification du secret cron
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const results = { sent: 0, errors: 0, skipped: 0 };

  // Traiter les rappels à J-3, J-2, J-1
  for (const joursRestants of [3, 2, 1]) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + joursRestants);

    // Fenêtre : de minuit à minuit+1 du jour cible
    const dateDebut = new Date(targetDate);
    dateDebut.setHours(0, 0, 0, 0);
    const dateFin = new Date(targetDate);
    dateFin.setHours(23, 59, 59, 999);

    // Récupérer les abonnements actifs expirant ce jour-là
    const { data: abonnements, error } = await supabase
      .from("abonnements")
      .select(`
        id,
        plan_id,
        date_fin,
        user_id,
        profiles:user_id (
          nom_complet,
          email:id
        )
      `)
      .eq("statut", "ACTIF")
      .gte("date_fin", dateDebut.toISOString())
      .lte("date_fin", dateFin.toISOString());

    if (error) {
      console.error(`[cron/rappel] Erreur requête J-${joursRestants}:`, error);
      continue;
    }

    if (!abonnements?.length) {
      results.skipped += 0;
      continue;
    }

    for (const abo of abonnements) {
      try {
        // Récupérer l'email depuis auth.users via service client
        const { data: userData } = await supabase.auth.admin.getUserById(abo.user_id);
        const email = userData?.user?.email;
        const profile = abo.profiles as { nom_complet?: string } | null;
        const nomComplet = profile?.nom_complet || "Champion";

        if (!email) {
          results.skipped++;
          continue;
        }

        const plan = PLAN_CONFIG.find((p) => p.id === abo.plan_id);
        const planNom = plan?.nom ?? "Premium";
        const prixEur = plan?.prix_eur ?? 9.90;

        const { subject, html } = templateRappelExpiration({
          nomComplet,
          email,
          planNom,
          dateFin: abo.date_fin,
          joursRestants,
          prixEur,
        });

        const sent = await sendEmail({ to: email, subject, html });

        if (sent) {
          results.sent++;
        } else {
          results.errors++;
        }
      } catch (err) {
        console.error(`[cron/rappel] Email J-${joursRestants} échoué pour ${abo.user_id}:`, err);
        results.errors++;
      }
    }
  }

  console.log("[cron/rappel-expiration] Résultat:", results);

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    ...results,
  });
}
