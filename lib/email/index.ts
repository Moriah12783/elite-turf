import { Resend } from "resend";

export const FROM_EMAIL = "Elite Turf <noreply@elite-turf.fr>";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
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
