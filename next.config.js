// build-trigger: 2026-05-05T15:37:39.684Z
// build-trigger: 2026-05-05T13:42:33.816Z
// build-trigger: 2026-05-06T13:45:00.000Z (Sentry token rotation)
// build-trigger: 2026-05-08T10:00:00.000Z (Sentry 504 unhandledRejection swallow)

// ── Sentry CLI unhandledRejection swallow ────────────────────────────────────
// sentry-cli (child process spawné par @sentry/nextjs) peut throw un
// unhandledRejection quand l'API Sentry retourne 504/503 (gateway timeout).
// Ce throw échappe à l'errorHandler du plugin Webpack et fait tomber TOUT le
// build Next.js (déjà arrivé 2× : 2026-05-06 et 2026-05-08). On l'attrape
// globalement pour ne plus jamais bloquer un déploiement à cause de Sentry.
process.on("unhandledRejection", (reason) => {
  const msg = String(reason && (reason.message || reason));
  if (msg.includes("sentry-cli") || msg.includes("sentry reported an error")) {
    // eslint-disable-next-line no-console
    console.warn("⚠️ Sentry CLI unhandledRejection swallowed (non-fatal):", msg);
    return;
  }
  // Autres unhandledRejection : on re-throw pour ne pas masquer de vrais bugs
  throw reason;
});

/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    // OpenNext + Cloudflare Workers : l'endpoint /_next/image retourne 500
    // par défaut (issue connue, le runtime Cloudflare ne supporte pas les
    // dépendances Node natives utilisées par Next pour l'optimisation Sharp).
    //
    // Solution : désactiver l'optimization Next et laisser Cloudflare CDN
    // servir les images directement. CF fait déjà du cache agressif global,
    // et nos images locales (/images/heroes/*) sont raisonnablement compressées.
    //
    // Quand on aura besoin d'image optimization avancée, on activera un
    // image loader custom utilisant Cloudflare Image Resizing :
    // https://developers.cloudflare.com/images/transform-images/
    unoptimized: true,
    domains: ["images.unsplash.com", "cpzjjnmszbyizeqhgrat.supabase.co"],
  },

  // ── Build ID dérivé du commit + timestamp ─────────────────────────────────
  // Force Webpack/Next à régénérer un nouveau buildId à chaque build, ce qui
  // invalide les hashs des bundles statiques côté client. Évite que les
  // utilisateurs (et les CDN) servent un bundle stale après une update de
  // variables NEXT_PUBLIC_* (ex : rotation de clé Supabase anon → publishable).
  generateBuildId: async () => {
    const sha = process.env.CF_PAGES_COMMIT_SHA
      || process.env.GITHUB_SHA
      || process.env.VERCEL_GIT_COMMIT_SHA
      || "";
    const ts = Date.now();
    return sha ? `${sha.slice(0, 7)}-${ts}` : String(ts);
  },

  // ── Redirection non-www → www (permanent 308) ─────────────────────────────
  // Évite les chaînes de redirections détectées par Google Search Console
  // et consolide le domaine canonique sur https://www.elite-turf.fr
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "^elite-turf\\.fr$" }],
        destination: "https://www.elite-turf.fr/:path*",
        permanent: true, // 308 → Google transfère le PageRank
      },
    ];
  },
};

// ── Sentry wrapper ──────────────────────────────────────────────────────────
// Active uniquement si SENTRY_AUTH_TOKEN est défini (CI/build). Sinon export
// direct de nextConfig pour ne pas casser les builds dev/preview sans Sentry.
const { withSentryConfig } = require("@sentry/nextjs");

const sentryEnabled = !!process.env.SENTRY_AUTH_TOKEN
  && !!process.env.NEXT_PUBLIC_SENTRY_DSN;

module.exports = sentryEnabled
  ? withSentryConfig(nextConfig, {
      // Org/projet : à remplir dans Cloudflare env vars (build-time)
      org:     process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // Silence les logs verbeux du wrapper en build CI
      silent:  true,
      // Source maps : upload uniquement en prod, supprimés du bundle final
      widenClientFileUpload:    true,
      hideSourceMaps:           true,
      disableLogger:            true,
      // Pas de release auto Vercel
      automaticVercelMonitors:  false,
      // Désactive la création de release Sentry (sentry-cli releases new) qui
      // est exactement le call qui timeout en 504 sur les builds cassés. On
      // garde le sourcemap upload (utile pour stack traces lisibles) mais on
      // skip la release management qui n'est pas critique.
      release: {
        create:   false,
        finalize: false,
      },
      // Sourcemaps best-effort : si Sentry API a un hoquet transitoire (504,
      // quota épuisé, réseau CI flaky), on ne casse PAS le build pour autant.
      // Le sourcemaps upload sera tenté au prochain build. Précédents incidents :
      // 2026-05-06 build #14 et 2026-05-08 build cassés par
      // "gateway timeout (http status: 504)" sur sentry-cli releases new.
      errorHandler: (err) => {
        // eslint-disable-next-line no-console
        console.warn("⚠️ Sentry build plugin error (non-fatal):", err.message || err);
      },
    })
  : nextConfig;
