/**
 * lib/cron-logger.ts
 *
 * Logger pour les cron jobs Elite Turf.
 * - Enregistre chaque exécution dans la table `cron_logs` (Supabase)
 * - Envoie une alerte Telegram si le cron ÉCHOUE
 *
 * Variables d'environnement requises pour les alertes :
 *   TELEGRAM_BOT_TOKEN=xxxx:yyyy
 *   TELEGRAM_CHAT_ID=-100xxxxxxx
 */

import { createServiceClient } from "@/lib/supabase/server";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || "";
const APP_URL            = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

// ── Telegram alert ──────────────────────────────────────────────────────────

async function sendTelegramAlert(cronName: string, error: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const text = [
    `🚨 *[Elite Turf] CRON FAILED*`,
    ``,
    `📛 Cron : \`${cronName}\``,
    `❌ Erreur : ${error}`,
    `🕐 Heure : ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`,
    `🔗 Admin : ${APP_URL}/admin`,
  ].join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch {
    // Ne jamais faire crasher le cron à cause d'un échec Telegram
  }
}

// ── Logger principal ────────────────────────────────────────────────────────

export interface CronLogger {
  finish(
    status:  "success" | "failure" | "skip",
    details?: Record<string, unknown>,
  ): Promise<void>;
}

/**
 * Démarre le timer pour un cron job.
 * Appeler `logger.finish("success"|"failure"|"skip", details)` à la fin.
 *
 * @example
 * const logger = logCronStart("pmu-sync");
 * try {
 *   const result = await doWork();
 *   await logger.finish("success", result);
 * } catch (err) {
 *   await logger.finish("failure", { error: err?.message });
 * }
 */
export function logCronStart(cronName: string): CronLogger {
  const startMs = Date.now();

  return {
    async finish(status, details = {}) {
      const duration_ms = Date.now() - startMs;

      // 1. Sauvegarder dans Supabase (silencieux si la table n'existe pas encore)
      try {
        const supabase = createServiceClient();
        await supabase.from("cron_logs").insert({
          cron_name:   cronName,
          status,
          details,
          duration_ms,
        });
      } catch {
        // Table pas encore créée — ne pas crasher
      }

      // 2. Alerte Telegram si échec
      if (status === "failure") {
        const errorMsg = (details?.error as string) ?? "Erreur inconnue";
        await sendTelegramAlert(cronName, errorMsg);
      }

      // 3. Log console pour Vercel logs
      const emoji = status === "success" ? "✅" : status === "skip" ? "⏭️" : "❌";
      console.log(
        `${emoji} [${cronName}] ${status.toUpperCase()} — ${duration_ms}ms`,
        Object.keys(details).length ? details : "",
      );
    },
  };
}
