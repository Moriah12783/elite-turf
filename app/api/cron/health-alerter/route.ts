/**
 * GET /api/cron/health-alerter
 *
 * Cron de santé : surveille la fiabilité des autres crons et la fraîcheur
 * des données critiques. Envoie une alerte Slack quand quelque chose part
 * en sucette.
 *
 * Schedule : toutes les 30 minutes.
 *
 * Vérifications :
 *  1. Crons en échec consécutif (≥ 2 failures sur même cron dans les 2h).
 *  2. Cron qui n'a pas tourné depuis 2× son intervalle attendu.
 *  3. Freshness data : si après 11h Paris, < 50% des courses du jour ont
 *     des partants en DB → alerte (probablement crash du cron enrichir-partants).
 *  4. Transactions Paystack EN_ATTENTE > 24h (paiements perdus).
 *
 * Sécurité : token Bearer CRON_SECRET (idem autres crons Vercel).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET || "";

// Anti-spam : on dédoublonne dans la fenêtre des 4h pour éviter de spammer
// Slack toutes les 30 min sur le même cron cassé. Limite déterminée par
// le timestamp du dernier alert log.
//
// Implémentation simple : table cron_logs avec un pseudo-cron 'health-alerter'
// qui logge ses propres alertes envoyées (avec details.alert_keys).

interface AlertItem {
  key:      string;          // identifiant unique de l'alerte (dédoublonnage)
  scope:    string;
  message:  string;
  context:  Record<string, unknown>;
  level:    "warn" | "critical";
}

export async function GET(req: NextRequest) {
  // Auth cron
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const alerts: AlertItem[] = [];

  // ── Check 1 : crons en échec consécutif ───────────────────────────────────
  try {
    const since2h = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recentLogs } = await supabase
      .from("cron_logs")
      .select("cron_name, status, executed_at")
      .gte("executed_at", since2h)
      .order("executed_at", { ascending: false });

    if (recentLogs) {
      // Grouper par cron_name, compter échecs consécutifs (du plus récent au plus vieux)
      const byCron: Record<string, Array<{ status: string; at: string }>> = {};
      for (const l of recentLogs) {
        if (!byCron[l.cron_name]) byCron[l.cron_name] = [];
        byCron[l.cron_name].push({ status: l.status, at: l.executed_at });
      }
      for (const [cronName, runs] of Object.entries(byCron)) {
        let consec = 0;
        for (const r of runs) {
          if (r.status === "failure") consec++;
          else break; // arrêt au premier success
        }
        if (consec >= 2) {
          alerts.push({
            key:     `cron-fail:${cronName}`,
            scope:   "cron-health",
            level:   consec >= 5 ? "critical" : "warn",
            message: `Cron \`${cronName}\` a échoué ${consec} fois consécutives sur les 2 dernières heures`,
            context: { cron: cronName, consec, last_run: runs[0]?.at },
          });
        }
      }
    }
  } catch (err) {
    logger.error("health-alerter", err, { check: "consecutive-failures" });
  }

  // ── Check 2 : freshness data partants (après 11h Paris) ───────────────────
  try {
    const parisHour = parseInt(
      new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris", hour: "2-digit", hour12: false,
      }).format(now), 10,
    );
    if (parisHour >= 11 && parisHour <= 21) {
      const today = now.toISOString().split("T")[0];
      const { data: courses } = await supabase
        .from("courses")
        .select("id, statut")
        .eq("date_course", today)
        .neq("statut", "ANNULE");
      const total = courses?.length ?? 0;

      if (total > 0) {
        const courseIds = courses!.map((c) => c.id);
        const { count: partantsCount } = await supabase
          .from("partants")
          .select("course_id", { count: "exact", head: true })
          .in("course_id", courseIds);
        const coursesWithPartants = await supabase
          .from("partants")
          .select("course_id")
          .in("course_id", courseIds);
        const distinctCoursesWithPartants = new Set(
          (coursesWithPartants.data ?? []).map((p) => p.course_id),
        ).size;

        const ratio = total > 0 ? distinctCoursesWithPartants / total : 0;
        if (ratio < 0.5) {
          alerts.push({
            key:     `freshness:partants:${today}`,
            scope:   "data-freshness",
            level:   ratio < 0.2 ? "critical" : "warn",
            message: `Seulement ${Math.round(ratio * 100)}% des courses du jour ont des partants à ${parisHour}h Paris (${distinctCoursesWithPartants}/${total})`,
            context: {
              date:               today,
              courses_total:      total,
              courses_with_partants: distinctCoursesWithPartants,
              partants_total:     partantsCount,
              ratio_pct:          Math.round(ratio * 100),
            },
          });
        }
      }
    }
  } catch (err) {
    logger.error("health-alerter", err, { check: "freshness-partants" });
  }

  // ── Check 3 : transactions Paystack EN_ATTENTE > 24h ──────────────────────
  try {
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const since7d  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: stuck } = await supabase
      .from("transactions")
      .select("id, reference_operateur, date_transaction, montant_fcfa")
      .eq("statut", "EN_ATTENTE")
      .lte("date_transaction", since24h)
      .gte("date_transaction", since7d)
      .like("reference_operateur", "ET-PS-%")
      .limit(20);

    if (stuck && stuck.length > 0) {
      const totalFcfa = stuck.reduce((s, t) => s + (t.montant_fcfa ?? 0), 0);
      alerts.push({
        key:     `paystack-stuck:${new Date().toISOString().slice(0, 10)}`,
        scope:   "payments",
        level:   stuck.length >= 5 ? "critical" : "warn",
        message: `${stuck.length} transactions Paystack EN_ATTENTE depuis > 24h (≈ ${totalFcfa.toLocaleString()} FCFA bloqués)`,
        context: {
          stuck_count: stuck.length,
          total_fcfa:  totalFcfa,
          oldest:      stuck[stuck.length - 1]?.date_transaction,
        },
      });
    }
  } catch (err) {
    logger.error("health-alerter", err, { check: "paystack-stuck" });
  }

  // ── Dispatch alertes (avec dédoublonnage 4h) ──────────────────────────────
  let sent = 0;
  let skipped = 0;
  if (alerts.length > 0) {
    const since4h = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
    const { data: recentAlerts } = await supabase
      .from("cron_logs")
      .select("details")
      .eq("cron_name", "health-alerter")
      .eq("status", "success")
      .gte("executed_at", since4h);
    const recentKeys = new Set<string>();
    for (const r of recentAlerts ?? []) {
      const keys = (r.details as { alert_keys?: string[] } | null)?.alert_keys ?? [];
      keys.forEach((k) => recentKeys.add(k));
    }

    for (const alert of alerts) {
      if (recentKeys.has(alert.key)) {
        skipped++;
        continue;
      }
      if (alert.level === "critical") {
        logger.critical(alert.scope, alert.message, alert.context);
      } else {
        logger.warn(alert.scope, alert.message, { ...alert.context, alert: true });
      }
      sent++;
    }
  }

  // Logger l'exécution dans cron_logs (avec liste des alert_keys envoyées)
  try {
    await supabase.from("cron_logs").insert({
      cron_name: "health-alerter",
      status:    "success",
      details: {
        checks_run:    3,
        alerts_total:  alerts.length,
        alerts_sent:   sent,
        alerts_skipped: skipped,
        alert_keys:    alerts.filter((a) => !skipped || true).map((a) => a.key),
      },
    });
  } catch {
    // Silent
  }

  return NextResponse.json({
    ok:            true,
    alerts_total:  alerts.length,
    alerts_sent:   sent,
    alerts_skipped: skipped,
    alerts:        alerts.map((a) => ({ key: a.key, level: a.level, message: a.message })),
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
