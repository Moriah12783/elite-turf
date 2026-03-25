import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Cron job — Expiration automatique des abonnements
 * Planifié : chaque nuit à 01h00 UTC
 * Vercel Cron : "0 1 * * *"
 *
 * 1. Passe les abonnements expirés de ACTIF → EXPIRE
 * 2. Met à jour le statut_abonnement du profil → EXPIRE
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const PLACEHOLDER_VALUES = ["your_cron_secret_here", "dev_cron_secret_change_in_production"];
  const isSecretConfigured = cronSecret && !PLACEHOLDER_VALUES.includes(cronSecret);

  if (isSecretConfigured && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // 1. Trouver les abonnements actifs dont la date de fin est passée
  const { data: expiredAbos, error: fetchErr } = await supabase
    .from("abonnements")
    .select("id, user_id")
    .eq("statut", "ACTIF")
    .lt("date_fin", now);

  if (fetchErr) {
    console.error("[cron/expire] Erreur fetch:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!expiredAbos?.length) {
    return NextResponse.json({ success: true, expired: 0, timestamp: now });
  }

  const userIds = Array.from(new Set(expiredAbos.map((a) => a.user_id)));
  const aboIds = expiredAbos.map((a) => a.id);

  // 2. Marquer les abonnements comme EXPIRE
  const { error: updateAboErr } = await supabase
    .from("abonnements")
    .update({ statut: "EXPIRE" })
    .in("id", aboIds);

  if (updateAboErr) {
    console.error("[cron/expire] Erreur update abonnements:", updateAboErr);
  }

  // 3. Vérifier pour chaque user s'il a encore un abonnement actif
  //    Si non → passer son profil à EXPIRE
  let profilesUpdated = 0;

  for (const userId of userIds) {
    const { data: activeAbo } = await supabase
      .from("abonnements")
      .select("id")
      .eq("user_id", userId)
      .eq("statut", "ACTIF")
      .limit(1)
      .single();

    if (!activeAbo) {
      await supabase
        .from("profiles")
        .update({
          statut_abonnement: "EXPIRE",
          date_expiration_abonnement: null,
        })
        .eq("id", userId);

      profilesUpdated++;
    }
  }

  const result = {
    success: true,
    timestamp: now,
    abonnementsExpires: aboIds.length,
    profilesMisAJour: profilesUpdated,
  };

  console.log("[cron/expire-abonnements]", result);
  return NextResponse.json(result);
}
