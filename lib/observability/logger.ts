/**
 * Observability MVP — logger structuré avec alerting Slack.
 *
 * Conçu pour Cloudflare Workers + Next.js. Pas de dépendance externe lourde
 * (vs Sentry SDK). Couvre 80% des besoins critiques :
 *  - Errors/warnings tracés avec contexte (scope, request_id, user, etc.)
 *  - Critical errors → POST Slack webhook (SLACK_WEBHOOK_ALERTES)
 *  - Logs lisibles via `wrangler tail` ou Cloudflare Observability dashboard
 *
 * À migrer vers @sentry/cloudflare le jour où on veut rich error tracking
 * (stack traces déminifiées, breadcrumbs, performance, etc.).
 *
 * Usage :
 *   import { logger } from "@/lib/observability/logger";
 *   try { ... }
 *   catch (err) {
 *     logger.error("paystack-webhook", err, { reference, userId });
 *   }
 *
 *   logger.critical("cron-health", "Data freshness degraded", { ... });
 */

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

export const logger = {
  info(scope: string, message: string, ctx: LogContext = {}): void {
    logToConsole("info", scope, message, ctx);
  },
  warn(scope: string, message: string, ctx: LogContext = {}): void {
    logToConsole("warn", scope, message, ctx);
    // warn n'envoie pas à Slack par défaut (trop bruyant) — pass ctx.alert=true pour forcer
    if (ctx.alert === true) void sendToSlack("warn", scope, message, ctx);
  },
  /** Erreur applicative — loggée + Slack en prod */
  error(scope: string, err: unknown, ctx: LogContext = {}): void {
    const message = err instanceof Error ? err.message : String(err);
    logToConsole("error", scope, message, ctx, err);
    void sendToSlack("error", scope, message, ctx);
  },
  /** Erreur critique — toujours Slack + tag spécial pour alerte */
  critical(scope: string, message: string, ctx: LogContext = {}): void {
    logToConsole("critical", scope, message, ctx);
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
