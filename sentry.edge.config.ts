/**
 * sentry.edge.config.ts — Init Sentry pour Edge runtime (middleware Next.js).
 *
 * Identique au server config mais V8-isolate-friendly (pas de require dynamique).
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
  });
}
