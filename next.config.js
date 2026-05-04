/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    domains: ["images.unsplash.com", "cpzjjnmszbyizeqhgrat.supabase.co"],
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
