import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmailBatch, type BulkEmailRequest } from "@/lib/email";
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
  // On ignore la vérification si le secret est absent ou encore au placeholder
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const PLACEHOLDER_VALUES = ["your_cron_secret_here", "dev_cron_secret_change_in_production"];
  const isSecretConfigured = cronSecret && !PLACEHOLDER_VALUES.includes(cronSecret);

  if (isSecretConfigured && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  let skipped = 0;

  // ── Étape 1 : collecter tous les payloads (rendering + lookup email) ─────
  // On rassemble J-3, J-2, J-1 dans un SEUL batch envoyé d'un coup avec
  // throttling unifié — au lieu de 3 boucles avec sendEmail séquentiel zéro
  // pause qui pouvaient burst au-delà du rate-limit Resend.
  const payloads: BulkEmailRequest[] = [];

  for (const joursRestants of [3, 2, 1]) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + joursRestants);

    const dateDebut = new Date(targetDate);
    dateDebut.setHours(0, 0, 0, 0);
    const dateFin = new Date(targetDate);
    dateFin.setHours(23, 59, 59, 999);

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
    if (!abonnements?.length) continue;

    for (const abo of abonnements) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(abo.user_id);
        const email = userData?.user?.email;
        const profile = abo.profiles as { nom_complet?: string } | null;
        const nomComplet = profile?.nom_complet || "Champion";

        if (!email) {
          skipped++;
          continue;
        }

        const plan = PLAN_CONFIG.find((p) => p.id === abo.plan_id);
        const { subject, html } = templateRappelExpiration({
          nomComplet,
          email,
          planNom: plan?.nom     ?? "Pro",
          dateFin: abo.date_fin,
          joursRestants,
          prixEur: plan?.prix_eur ?? 9.90,
        });

        payloads.push({ to: email, subject, html, meta: { joursRestants, user_id: abo.user_id } });
      } catch (err) {
        console.error(`[cron/rappel] Prep J-${joursRestants} échouée pour ${abo.user_id}:`, err);
        skipped++;
      }
    }
  }

  // ── Étape 2 : envoi en batch avec throttling unifié ──────────────────────
  const result = await sendEmailBatch(payloads);

  // Log des échecs pour debug
  const echecs = result.details.filter((d) => !d.ok);
  if (echecs.length > 0) {
    console.error(`[cron/rappel] ${echecs.length} échecs Resend :`, echecs.slice(0, 5));
  }

  console.log(`[cron/rappel-expiration] Résultat: sent=${result.sent} errors=${result.failed} skipped=${skipped} duration_ms=${result.duration_ms}`);

  return NextResponse.json({
    success:     true,
    timestamp:   now.toISOString(),
    sent:        result.sent,
    errors:      result.failed,
    skipped,
    duration_ms: result.duration_ms,
  });
}
