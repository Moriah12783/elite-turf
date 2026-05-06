/**
 * GET /api/cron/welcome-emails
 *
 * Cron horaire qui orchestre la welcome email series J1/J3/J7.
 *
 * Logique :
 *  - Récupère les utilisateurs récemment inscrits (J1 à J8) qui n'ont pas
 *    encore reçu l'email de la séquence correspondante.
 *  - Envoie le bon template selon l'âge du compte.
 *  - Loggue dans email_sent_log pour idempotence (UNIQUE user_id + type).
 *
 * Fenêtres :
 *  - J1 : compte créé entre 24h et 48h ago → envoyer WELCOME_J1
 *  - J3 : compte créé entre 72h et 96h ago → envoyer WELCOME_J3
 *  - J7 : compte créé entre 168h et 192h ago → envoyer WELCOME_J7
 *
 * Note : J0 (welcome immédiat) est déjà envoyé à l'inscription, pas par ce cron.
 *
 * Schedule recommandé : 1× / heure pour avoir une bonne granularité sans spam.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmailDetailed } from "@/lib/email";
import { logCronStart } from "@/lib/cron-logger";
import { logger } from "@/lib/observability/logger";
import { templateWelcomeJ1 } from "@/lib/email/templates/welcome-series-j1";
import { templateWelcomeJ3 } from "@/lib/email/templates/welcome-series-j3";
import { templateWelcomeJ7 } from "@/lib/email/templates/welcome-series-j7";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

type EmailType = "WELCOME_J1" | "WELCOME_J3" | "WELCOME_J7";

interface Profile {
  id:               string;
  email:            string;
  nom_complet:      string;
  date_inscription: string;
}

/** Configuration : nombre d'heures écoulées depuis l'inscription pour chaque step. */
const STEPS: Array<{ type: EmailType; minHours: number; maxHours: number; render: (p: Profile) => { subject: string; html: string } }> = [
  {
    type:     "WELCOME_J1",
    minHours: 24,
    maxHours: 48,
    render:   (p) => templateWelcomeJ1({ nomComplet: p.nom_complet }),
  },
  {
    type:     "WELCOME_J3",
    minHours: 72,
    maxHours: 96,
    render:   (p) => templateWelcomeJ3({ nomComplet: p.nom_complet }),
  },
  {
    type:     "WELCOME_J7",
    minHours: 168,
    maxHours: 192,
    render:   (p) => templateWelcomeJ7({ nomComplet: p.nom_complet }),
  },
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronLog = logCronStart("welcome-emails");
  const supabase = createServiceClient();
  const stats = { processed: 0, sent: 0, failed: 0, skipped: 0 };
  const now = Date.now();

  try {
    // Récupérer les profils créés dans la fenêtre globale (24h - 192h)
    const minDate = new Date(now - 200 * 3600 * 1000).toISOString();
    const maxDate = new Date(now - 23 * 3600 * 1000).toISOString();

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, email, nom_complet, date_inscription")
      .gte("date_inscription", minDate)
      .lte("date_inscription", maxDate)
      .not("email", "is", null);

    if (error) {
      await cronLog.finish("failure", { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = (profiles ?? []) as Profile[];

    for (const profile of list) {
      stats.processed++;
      if (!profile.email) continue;

      const ageHours = (now - new Date(profile.date_inscription).getTime()) / 3600000;

      // Trouver le step correspondant à l'âge actuel
      const step = STEPS.find((s) => ageHours >= s.minHours && ageHours < s.maxHours);
      if (!step) {
        stats.skipped++;
        continue;
      }

      // Vérifier qu'on n'a pas déjà envoyé ce type d'email
      const { data: existing } = await supabase
        .from("email_sent_log")
        .select("id")
        .eq("user_id", profile.id)
        .eq("type", step.type)
        .maybeSingle();
      if (existing) {
        stats.skipped++;
        continue;
      }

      // Render + send
      const { subject, html } = step.render(profile);
      const sendRes = await sendEmailDetailed({
        to:      profile.email,
        subject,
        html,
      });

      // Log envoi (success ou échec)
      const { error: logErr } = await supabase
        .from("email_sent_log")
        .insert({
          user_id: profile.id,
          email:   profile.email,
          type:    step.type,
          status:  sendRes.ok ? "SENT" : "FAILED",
          error:   sendRes.error,
        });

      if (sendRes.ok) {
        stats.sent++;
        if (logErr) logger.warn("welcome-emails", `Insert log failed: ${logErr.message}`, { user_id: profile.id });
      } else {
        stats.failed++;
        logger.error("welcome-emails", `Send failed: ${sendRes.error}`, { user_id: profile.id, type: step.type });
      }
    }

    await cronLog.finish(stats.failed > 0 ? "failure" : "success", stats);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("welcome-emails", err, {});
    await cronLog.finish("failure", { error: msg, ...stats });
    return NextResponse.json({ error: msg, ...stats }, { status: 500 });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
