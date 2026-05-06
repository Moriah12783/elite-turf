// build-trigger: 2026-05-05T15:37:39.684Z
// build-trigger: 2026-05-05T13:42:33.816Z
/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
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
      // Sourcemaps best-effort : si Sentry API a un hoquet transitoire (504,
      // quota épuisé, réseau CI flaky), on ne casse PAS le build pour autant.
      // Le sourcemaps upload sera tenté au prochain build. Précédent incident :
      // 2026-05-06 build #14 cassé par "gateway timeout (http status: 504)" sur
      // sentry-cli releases new.
      errorHandler: (err) => {
        // eslint-disable-next-line no-console
        console.warn("⚠️ Sentry build plugin error (non-fatal):", err.message || err);
      },
    })
  : nextConfig;
