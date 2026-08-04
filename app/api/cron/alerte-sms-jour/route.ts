/**
 * GET /api/cron/alerte-sms-jour
 *
 * Alerte SMS QUOTIDIENNE aux abonnés PAYANTS : « vos analyses du jour sont
 * disponibles ». Remplace le SMS écrit/collé/envoyé à la main.
 *
 * Déclenché plusieurs fois par jour par le cron-worker (dédup 1/jour) mais
 * n'envoie QUE si au moins un pronostic payant (PRO/ELITE) a été publié
 * aujourd'hui — donc rien à annoncer = rien envoyé.
 *
 * Double garde-fou coût : flag SMS_ALERTE_JOUR_ENABLED (opt-in explicite) +
 * Twilio configuré. OFF par défaut.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isTwilioConfigured } from "@/lib/sms-helpers";
import { sendDailyPronosticAlertSms } from "@/lib/sms-alerte-jour";
import { logCronStart } from "@/lib/cron-logger";
import { canalSmsActif, drapeauDe } from "@/lib/sms/canaux";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ⚠️ Le journal est ouvert AVANT les garde-fous, volontairement.
  // Auparavant `logCronStart` venait après : quand le canal était fermé, la
  // route sortait sans laisser la moindre trace. Ce cron tournait donc deux
  // fois par jour depuis des semaines sans rien envoyer ET sans que rien ne
  // le signale — constaté le 04/08/2026, `cron_logs` ne contenait aucune
  // ligne « alerte-sms-jour ». Un canal fermé doit être VISIBLE.
  const cronLog = logCronStart("alerte-sms-jour");

  // Opt-in explicite (le SMS coûte de l'argent) + Twilio configuré.
  if (!canalSmsActif("ALERTE_JOUR")) {
    await cronLog.finish("success", {
      skipped: "canal_ferme",
      drapeau_a_poser: drapeauDe("ALERTE_JOUR"),
    });
    return NextResponse.json({ ok: true, skipped: "canal_ferme", drapeau: drapeauDe("ALERTE_JOUR") });
  }
  if (!isTwilioConfigured()) {
    await cronLog.finish("success", { skipped: "twilio_not_configured" });
    return NextResponse.json({ ok: true, skipped: "twilio_not_configured" });
  }

  const supabase = createServiceClient();

  try {
    const today = new Date().toISOString().slice(0, 10); // AAAA-MM-JJ (UTC)
    const startOfDay = `${today}T00:00:00.000Z`;

    // Au moins un pronostic PAYANT publié aujourd'hui ? Sinon rien à annoncer.
    const { data: pronos } = await supabase
      .from("pronostics")
      .select("id")
      .eq("publie", true)
      .in("niveau_acces", ["PRO", "ELITE"])
      .gte("date_publication", startOfDay)
      .limit(1);

    if (!pronos || pronos.length === 0) {
      await cronLog.finish("success", { skipped: "no_paying_pronostic_today" });
      return NextResponse.json({ ok: true, skipped: "no_paying_pronostic_today" });
    }

    const stats = await sendDailyPronosticAlertSms(today);
    await cronLog.finish(stats.failed > 0 ? "failure" : "success", { ...stats });
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await cronLog.finish("failure", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
