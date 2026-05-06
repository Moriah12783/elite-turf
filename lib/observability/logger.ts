/**
 * Observability — logger structuré + alerting Slack + capture Sentry.
 *
 * Pipeline triple :
 *  1. console.log structuré → Cloudflare Workers Observability dashboard
 *  2. Sentry.captureException (rich tracking : stack traces déminifiées,
 *     breadcrumbs, perf, sessions). Active uniquement si SENTRY_DSN est défini.
 *  3. Slack webhook → alertes humaines temps réel pour error + critical
 *     (SLACK_WEBHOOK_ALERTES en prod uniquement)
 *
 * Sentry s'enregistre via instrumentation.ts (Next 14 hook). Si la DSN n'est
 * pas configurée, captureException no-op silencieusement → aucun coût.
 *
 * Usage :
 *   import { logger } from "@/lib/observability/logger";
 *   try { ... }
 *   catch (err) {
 *     logger.error("paystack-webhook", err, { reference, userId });
 *   }
 */

import * as Sentry from "@sentry/nextjs";

type LogLevel = "info" | "warn" | "error" | "critical";

interface LogContext {
  [key: string]: unknown;
}

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_ALERTES || "";

/** Mode : production envoie Slack ; dev affiche console seulement */
const IS_PROD = process.env.NODE_ENV === "production";

const LEVEL_EMOJI: Record<LogLevel, string> = {
  info:     "ℹ️",
  warn:     "⚠️",
  error:    "❌",
  critical: "🚨",
};

/** Sérialise une erreur de manière sûre (pas de circular ref) */
function serializeError(err: unknown): { message: string; stack?: string; name?: string } {
  if (err instanceof Error) {
    return {
      name:    err.name,
      message: err.message,
      stack:   err.stack?.split("\n").slice(0, 8).join("\n"), // limite 8 lignes
    };
  }
  if (typeof err === "string") return { message: err };
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}

/** Construit le payload Slack pour un message d'alerte */
function buildSlackPayload(
  level: LogLevel,
  scope: string,
  message: string,
  ctx: LogContext,
): { text: string; blocks: unknown[] } {
  const emoji = LEVEL_EMOJI[level];
  const ctxLines = Object.entries(ctx)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `*${k}*: \`${typeof v === "object" ? JSON.stringify(v).slice(0, 200) : String(v).slice(0, 200)}\``)
    .join("\n");

  return {
    text: `${emoji} [${scope}] ${message}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `${emoji} *${level.toUpperCase()}* — \`${scope}\`\n${message}` },
      },
      ...(ctxLines
        ? [{ type: "section", text: { type: "mrkdwn", text: ctxLines } }]
        : []),
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `_${new Date().toISOString()}_ · prod : <https://www.elite-turf.fr|elite-turf.fr>` },
        ],
      },
    ],
  };
}

/** Envoie une alerte Slack (best-effort, ne bloque pas le caller) */
async function sendToSlack(
  level: LogLevel,
  scope: string,
  message: string,
  ctx: LogContext,
): Promise<void> {
  if (!SLACK_WEBHOOK || !IS_PROD) return;
  try {
    const payload = buildSlackPayload(level, scope, message, ctx);
    // Timeout court pour ne pas bloquer le worker (3s max)
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    await fetch(SLACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
  } catch {
    // Silent : on ne veut pas qu'un problème de logging casse l'app
  }
}

/** Format console structuré pour `wrangler tail` / Cloudflare Logs */
function logToConsole(
  level: LogLevel,
  scope: string,
  message: string,
  ctx: LogContext,
  err?: unknown,
): void {
  const line = {
    level,
    scope,
    message,
    ...ctx,
    ...(err ? { error: serializeError(err) } : {}),
    timestamp: new Date().toISOString(),
  };
  const fn = level === "error" || level === "critical" ? console.error
           : level === "warn" ? console.warn
           : console.log;
  fn(`[${level}][${scope}]`, JSON.stringify(line));
}

/** Best-effort capture Sentry. No-op si DSN absente. Ne throw jamais. */
function captureToSentry(
  level: LogLevel,
  scope: string,
  message: string,
  ctx: LogContext,
  err?: unknown,
): void {
  try {
    Sentry.withScope((s) => {
      s.setTag("scope", scope);
      // Map LogLevel → Sentry SeverityLevel (différent enum)
      const sentryLevel = level === "critical" ? "fatal"
                        : level === "warn"     ? "warning"
                        : level; // "info" | "error" passent tels quels
      s.setLevel(sentryLevel);
      // Filtre les valeurs trop volumineuses pour éviter le 200KB cap Sentry
      const safeCtx: LogContext = {};
      for (const [k, v] of Object.entries(ctx)) {
        const str = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
        safeCtx[k] = str.length > 1000 ? str.slice(0, 1000) + "…[truncated]" : v;
      }
      s.setContext("logger_ctx", safeCtx as Record<string, unknown>);
      if (err) Sentry.captureException(err);
      else      Sentry.captureMessage(`[${scope}] ${message}`);
    });
  } catch {
    // Silent : Sentry pas dispo (dev local, DSN non set, ou runtime CF avec
    // problème d'init) → on ne casse pas le logger principal.
  }
}

export const logger = {
  info(scope: string, message: string, ctx: LogContext = {}): void {
    logToConsole("info", scope, message, ctx);
  },
  warn(scope: string, message: string, ctx: LogContext = {}): void {
    logToConsole("warn", scope, message, ctx);
    // warn n'envoie pas à Slack par défaut (trop bruyant) — pass ctx.alert=true pour forcer
    if (ctx.alert === true) {
      void sendToSlack("warn", scope, message, ctx);
      captureToSentry("warn", scope, message, ctx);
    }
  },
  /** Erreur applicative — console + Sentry + Slack (prod) */
  error(scope: string, err: unknown, ctx: LogContext = {}): void {
    const message = err instanceof Error ? err.message : String(err);
    logToConsole("error", scope, message, ctx, err);
    captureToSentry("error", scope, message, ctx, err);
    void sendToSlack("error", scope, message, ctx);
  },
  /** Erreur critique — toujours Sentry + Slack + tag spécial alerte */
  critical(scope: string, message: string, ctx: LogContext = {}): void {
    logToConsole("critical", scope, message, ctx);
    captureToSentry("critical", scope, message, ctx);
    void sendToSlack("critical", scope, message, ctx);
  },
};

/**
 * Helper pour wrapper proprement un async handler avec logger.
 * Re-throw l'erreur après logging pour que la route puisse retourner 500 etc.
 */
export async function withErrorLogging<T>(
  scope: string,
  fn: () => Promise<T>,
  ctx: LogContext = {},
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logger.error(scope, err, ctx);
    throw err;
  }
}
