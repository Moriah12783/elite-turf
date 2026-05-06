/**
 * sentry.server.config.ts — Init Sentry côté serveur (RSC + route handlers).
 *
 * Note Cloudflare Workers : on tourne sur OpenNext qui simule Node via
 * `nodejs_compat`. @sentry/nextjs a besoin d'un init Node-like — ça marche en
 * OpenNext mais on le configure défensivement (try/catch dans logger.ts).
 *
 * DSN via SENTRY_DSN (env runtime, pas NEXT_PUBLIC_*).
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    environment: process.env.NODE_ENV,
    release: process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7)
      || process.env.GITHUB_SHA?.slice(0, 7)
      || "unknown",
    // En prod sur CF Workers, on évite les transactions trop verbeuses
    enableTracing: process.env.NODE_ENV === "production",
  });
}
