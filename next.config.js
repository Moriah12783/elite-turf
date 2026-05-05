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

module.exports = nextConfig;
