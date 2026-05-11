import { Resend } from "resend";

export const FROM_EMAIL = "Elite Turf <noreply@elite-turf.fr>";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

/**
 * Rate-limit Resend par défaut pour les envois en bulk.
 *
 * Plans Resend :
 *   - Free  : 2 emails/seconde (100 emails/jour)
 *   - Pro   : 10 emails/seconde
 *
 * Default = 5/sec : safe pour Pro (50% du max, marge anti-burst) ; trop
 * agressif pour Free. Les appelants sur Free doivent passer `ratePerSecond: 2`.
 */
export const DEFAULT_BULK_RATE_PER_SECOND = 5;

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export interface BulkEmailRequest {
  to:       string;
  subject:  string;
  html:     string;
  replyTo?: string;
  /** Métadonnée passée tel quel dans les details du résultat (ex: user_id). */
  meta?:    Record<string, unknown>;
}

export interface BulkEmailResult {
  sent:        number;
  failed:      number;
  total:       number;
  duration_ms: number;
  details:     Array<{
    email: string;
    ok:    boolean;
    error?: string;
    meta?:  Record<string, unknown>;
  }>;
}

/** Promise-based sleep, utile pour throttling. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envoie un email via Resend et retourne { ok, error? } avec le message Resend si échec.
 * Utilisé pour les envois en masse où on veut connaître la raison exacte de l'échec.
 */
export async function sendEmailDetailed(opts: SendEmailOptions): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const isConfigured = apiKey && apiKey !== "your_resend_api_key" && apiKey.startsWith("re_");

  if (!isConfigured) {
    console.log("[Email sandbox] À:", opts.to);
    return { ok: true };
  }

  const resend = new Resend(apiKey);
  try {
    const { error } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html:    opts.html,
      replyTo: opts.replyTo ?? "contact@elite-turf.fr",
    });
    if (error) return { ok: false, error: (error as any).message || JSON.stringify(error) };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erreur inconnue" };
  }
}

/**
 * Envoi en MASSE avec throttling rate-limit Resend respecté.
 *
 * Pourquoi : avant, 4 endpoints avaient chacun leur propre logique de batch :
 *   - newsletter/send       : Promise.all 10 + delay 1s (~10/sec, dépasse Free)
 *   - pronostics/notifier   : séquentiel + 200ms toutes les 10 (inégal)
 *   - cron/rappel-expiration: séquentiel zéro pause (burst risk)
 *   - cron/welcome-emails   : séquentiel zéro pause (burst risk)
 *
 * Ce helper unifie le pattern : envois séquentiels avec délai EXACT entre
 * chaque pour respecter `ratePerSecond`. Pas de Promise.all (qui peut
 * déclencher des bursts au-delà du rate-limit).
 *
 * @param emails  Liste des emails à envoyer
 * @param options.ratePerSecond Vitesse max (default 5/sec, voir DEFAULT_BULK_RATE_PER_SECOND)
 *
 * @returns Stats : { sent, failed, total, duration_ms, details[] }
 *
 * @example
 *   const result = await sendEmailBatch(
 *     destinataires.map((d) => ({ to: d.email, subject, html: render(d) })),
 *     { ratePerSecond: 5 },
 *   );
 *   console.log(`Envoyés : ${result.sent}/${result.total} (${result.duration_ms}ms)`);
 */
export async function sendEmailBatch(
  emails: BulkEmailRequest[],
  options: { ratePerSecond?: number } = {},
): Promise<BulkEmailResult> {
  const rate = Math.max(1, options.ratePerSecond ?? DEFAULT_BULK_RATE_PER_SECOND);
  const delayMs = Math.ceil(1000 / rate);
  const t0 = Date.now();

  const result: BulkEmailResult = {
    sent:        0,
    failed:      0,
    total:       emails.length,
    duration_ms: 0,
    details:     [],
  };

  for (let i = 0; i < emails.length; i++) {
    const e = emails[i];
    const { ok, error } = await sendEmailDetailed({
      to:      e.to,
      subject: e.subject,
      html:    e.html,
      ...(e.replyTo ? { replyTo: e.replyTo } : {}),
    });

    if (ok) result.sent++;
    else    result.failed++;

    result.details.push({
      email: e.to,
      ok,
      ...(error ? { error } : {}),
      ...(e.meta  ? { meta: e.meta } : {}),
    });

    // Throttle entre envois (sauf après le dernier)
    if (i < emails.length - 1) await sleep(delayMs);
  }

  result.duration_ms = Date.now() - t0;
  return result;
}

/**
 * Envoie un email via Resend.
 * En mode sandbox (clé manquante ou placeholder), logue uniquement dans la console.
 * Resend est instancié à l'intérieur pour éviter l'erreur "Missing API key" au build.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const isConfigured =
    apiKey &&
    apiKey !== "your_resend_api_key" &&
    apiKey.startsWith("re_");

  if (!isConfigured) {
    console.log("[Email sandbox] À:", opts.to);
    console.log("[Email sandbox] Sujet:", opts.subject);
    return true;
  }

  // Instanciation lazy — jamais au niveau module
  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo ?? "contact@elite-turf.fr",
    });

    if (error) {
      console.error("[Resend error]", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[sendEmail]", err);
    return false;
  }
}
