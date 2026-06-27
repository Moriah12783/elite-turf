/**
 * GET /api/leads/desabonnement?id=<uuid>
 *
 * Désabonnement d'un lead du drip de bienvenue. Le lien est posé dans les emails
 * (lead-upgrade-j2 / lead-proof-j5) avec l'`id` du lead = UUID v4 aléatoire qui
 * sert de jeton de capacité (non devinable). Pose `leads.unsubscribed_at` ; le
 * cron lead-sequence saute ensuite ce lead. Renvoie une page de confirmation.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function page(message: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="fr"><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Désabonnement — Elite Turf</title>
</head>
<body style="margin:0;background:#F3F4F6;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:480px;margin:60px auto;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:32px;text-align:center;">
    <p style="font-family:Georgia,serif;font-size:22px;font-weight:700;margin:0 0 8px;color:#C9A84C;">ELITE <span style="color:#1E3A5F;">TURF</span></p>
    <p style="color:#1F2937;font-size:15px;line-height:1.6;margin:16px 0 0;">${message}</p>
    <a href="https://www.elite-turf.fr" style="display:inline-block;margin-top:24px;color:#C9A84C;font-weight:700;text-decoration:none;">Retour sur Elite Turf →</a>
  </div>
</body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function confirmPage(id: string): NextResponse {
  const action = `/api/leads/desabonnement?id=${encodeURIComponent(id)}`;
  const html = `<!DOCTYPE html>
<html lang="fr"><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Désabonnement — Elite Turf</title>
</head>
<body style="margin:0;background:#F3F4F6;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:480px;margin:60px auto;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:32px;text-align:center;">
    <p style="font-family:Georgia,serif;font-size:22px;font-weight:700;margin:0 0 8px;color:#C9A84C;">ELITE <span style="color:#1E3A5F;">TURF</span></p>
    <p style="color:#1F2937;font-size:15px;line-height:1.6;margin:16px 0 24px;">Confirmez que vous ne souhaitez plus recevoir nos emails de rappel.</p>
    <form method="POST" action="${action}" style="margin:0;">
      <button type="submit" style="display:inline-block;border:0;cursor:pointer;background:#C9A84C;color:#1E3A5F;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;">Confirmer le désabonnement</button>
    </form>
    <a href="https://www.elite-turf.fr" style="display:inline-block;margin-top:20px;color:#9CA3AF;font-size:13px;text-decoration:none;">Annuler et retourner sur Elite Turf</a>
  </div>
</body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// GET = page de confirmation UNIQUEMENT. On ne mute pas l'état sur un GET pour
// éviter les désabonnements automatiques par les prefetchers/scanners de liens
// des messageries (Outlook SafeLinks, proxy Gmail, antivirus) qui suivent les GET.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return page("Lien de désabonnement invalide.");
  return confirmPage(id);
}

// POST = désabonnement réel (déclenché par le bouton de confirmation).
export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return page("Lien de désabonnement invalide.");

  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("leads")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("id", id)
      .is("unsubscribed_at", null);

    if (error) {
      return page("Une erreur s'est produite. Réessayez plus tard ou écrivez à contact@elite-turf.fr.");
    }
    return page("Vous êtes désabonné de nos rappels par email — vous ne recevrez plus ces messages. À bientôt sur Elite Turf !");
  } catch {
    return page("Une erreur s'est produite. Réessayez plus tard ou écrivez à contact@elite-turf.fr.");
  }
}
