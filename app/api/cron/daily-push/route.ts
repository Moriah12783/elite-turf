/**
 * GET /api/cron/daily-push
 *
 * Envoie 2 push notifications par jour via OneSignal :
 *  - 7h00 Paris (= 6h UTC en été, 5h UTC en hiver) : "Pronostic Quinté+ du jour disponible"
 *    → Cible : abonnés (segment "STARTER", "PRO" ou "ELITE")
 *
 *  - 19h00 Paris (= 17h UTC été, 18h UTC hiver) : "Bilan du jour : ROI cumulé"
 *    → Cible : tous les opt-in (segment "Subscribed Users")
 *
 * Ce cron se déclenche aux deux heures et détermine quel push envoyer en
 * fonction de l'heure UTC actuelle. Vercel cron configuré pour 6h + 17h UTC
 * (heure d'été — l'écart heure d'hiver est acceptable, +1h envoi).
 *
 * Variables :
 *   ONESIGNAL_REST_API_KEY (Secret) - Clé API REST OneSignal
 *   NEXT_PUBLIC_ONESIGNAL_APP_ID    - App ID
 */

import { NextRequest, NextResponse } from "next/server";
import { logCronStart } from "@/lib/cron-logger";
import { logger } from "@/lib/observability/logger";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET   = process.env.CRON_SECRET || "";
const ONESIGNAL_APP = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";
const ONESIGNAL_KEY = process.env.ONESIGNAL_REST_API_KEY || "";
const APP_URL       = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface OneSignalNotificationOpts {
  title:    string;
  message:  string;
  url:      string;
  /** Segments OneSignal à cibler. Default "Subscribed Users". */
  segments?: string[];
}

async function sendOneSignalNotification(opts: OneSignalNotificationOpts): Promise<{ ok: boolean; error?: string; recipients?: number }> {
  if (!ONESIGNAL_APP || !ONESIGNAL_KEY) {
    return { ok: false, error: "ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY missing" };
  }

  const body = {
    app_id:                ONESIGNAL_APP,
    headings:              { fr: opts.title, en: opts.title },
    contents:              { fr: opts.message, en: opts.message },
    url:                   opts.url,
    included_segments:     opts.segments ?? ["Subscribed Users"],
    web_push_topic:        "elite-turf-daily",
    chrome_web_icon:       `${APP_URL}/og-image.jpg`,
    chrome_web_badge:      `${APP_URL}/og-image.jpg`,
  };

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.errors) {
      return { ok: false, error: JSON.stringify(data.errors || data) };
    }
    return { ok: true, recipients: data.recipients ?? 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronLog = logCronStart("daily-push");
  const nowUtc  = new Date();
  const hourUtc = nowUtc.getUTCHours();

  // Identifie quel push envoyer selon l'heure UTC
  // 6h UTC ≈ 7h Paris été / 8h Paris hiver
  // 17h UTC ≈ 19h Paris été / 18h Paris hiver
  // Tolérance ±1h
  const isMorningSlot = hourUtc >= 5 && hourUtc <= 7;
  const isEveningSlot = hourUtc >= 16 && hourUtc <= 18;

  if (!isMorningSlot && !isEveningSlot) {
    await cronLog.finish("skip", { reason: `Hors slot 5-7h ou 16-18h UTC (actuel: ${hourUtc}h)` });
    return NextResponse.json({ ok: true, skipped: true, hour_utc: hourUtc });
  }

  try {
    let result;

    if (isMorningSlot) {
      // ── Push matin : pronostic Quinté+ du jour ────────────────
      result = await sendOneSignalNotification({
        title:    "🏇 Pronostic Quinté+ du jour disponible",
        message:  "Notre analyse du Quinté+ a été publiée. Découvrez la sélection de nos experts.",
        url:      `${APP_URL}/quinte-plus/${nowUtc.toISOString().split("T")[0]}`,
        // Note: les segments doivent être créés dans OneSignal dashboard.
        // "Subscribed Users" est le segment par défaut (tous opt-in).
        // Pour ne cibler que les abonnés, créer un segment "Abonnés" basé sur
        // un tag user (à setter via OneSignal SDK lors de l'abonnement).
        segments: ["Subscribed Users"],
      });
    } else {
      // ── Push soir : récap arrivée + ROI cumulé ────────────────
      // On va chercher le ROI cumulé du mois (réutilise /api/stats)
      const sc = createServiceClient();
      const monthStart = new Date(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1).toISOString();
      const { data: monthlyPros } = await sc
        .from("pronostics")
        .select("resultat, gains_theoriques, rapport_gagnant")
        .eq("publie", true)
        .neq("resultat", "EN_ATTENTE")
        .gte("date_publication", monthStart);
      const list = monthlyPros ?? [];
      const totalMises = list.length;
      const totalGains = list.reduce((acc: number, p: any) => {
        if (p.resultat === "GAGNANT")   return acc + (p.gains_theoriques ?? p.rapport_gagnant ?? 0);
        if (p.resultat === "PARTIEL")   return acc + (p.gains_theoriques ?? p.rapport_gagnant ?? 0) * 0.3;
        return acc;
      }, 0);
      const roiMois = totalMises > 0
        ? Math.round(((totalGains - totalMises) / totalMises) * 100)
        : 0;
      const roiSign = roiMois >= 0 ? "+" : "";
      const message = totalMises > 0
        ? `ROI cumulé du mois : ${roiSign}${roiMois}% sur ${totalMises} pronostics. Bilan détaillé sur Elite Turf.`
        : "Bilan du jour disponible. Consultez les arrivées et le ROI sur Elite Turf.";

      result = await sendOneSignalNotification({
        title:    "📊 Bilan du jour Elite Turf",
        message,
        url:      `${APP_URL}/arrivees/${nowUtc.toISOString().split("T")[0]}`,
        segments: ["Subscribed Users"],
      });
    }

    if (!result.ok) {
      await cronLog.finish("failure", { error: result.error, slot: isMorningSlot ? "morning" : "evening" });
      logger.error("daily-push", `OneSignal API error: ${result.error}`, { slot: isMorningSlot ? "morning" : "evening" });
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    await cronLog.finish("success", {
      slot:      isMorningSlot ? "morning" : "evening",
      recipients: result.recipients,
    });
    return NextResponse.json({ ok: true, recipients: result.recipients });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("daily-push", err, {});
    await cronLog.finish("failure", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
