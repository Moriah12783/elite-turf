/**
 * sentry.client.config.ts — Init Sentry côté client (browser).
 *
 * Capturé : erreurs JS uncaught, unhandled promise rejections, breadcrumbs UI,
 * navigations Next.js, performance Core Web Vitals.
 *
 * DSN configuré via NEXT_PUBLIC_SENTRY_DSN (build-time embedded). Désactivé si
 * la DSN n'est pas définie (dev local sans Sentry, ou si on désactive
 * temporairement).
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    // Performance : sample rate adaptatif (10 % en prod, tout en dev)
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Replay : utile pour debug UX, mais coûteux. On le coupe pour l'instant.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1, // session replay déclenchée uniquement à l'erreur
    // Filtrage : on ignore les erreurs qui polluent (network du user, extensions browser)
    ignoreErrors: [
      // Extensions Chrome/FF qui injectent du code et plantent
      "Non-Error promise rejection captured",
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      // Réseau utilisateur instable (Côte d'Ivoire/Sénégal mobile peut générer beaucoup de bruit)
      "Network request failed",
      "NetworkError",
      "Failed to fetch",
      // OneSignal SDK qui plante parfois
      "OneSignalDeferred is not defined",
      // Warning interne OneSignal SDK service worker (sw.ts:21) — pas notre code
      "Event handler of 'message' event must be added on the initial evaluation",
      // ChunkLoadError : Next.js retombe gracieusement sur browser navigation,
      // donc pas un vrai bug user-impacting (juste cache CDN stale temporaire)
      "ChunkLoadError",
      "Loading chunk",
      // Vercel Analytics 404 (script orphelin enlevé dans cette PR)
      "Failed to load script",
    ],
    // Environnement : permet de filtrer prod vs preview Cloudflare dans l'UI Sentry
    environment: process.env.NODE_ENV,
    // Release : identifie chaque déploiement (utilise le commit SHA si dispo)
    release: process.env.NEXT_PUBLIC_CF_PAGES_COMMIT_SHA?.slice(0, 7) || "unknown",
  });
}
